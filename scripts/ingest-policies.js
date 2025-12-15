/**
 * Ingest local policy files into the policy_documents/policy_chunks tables.
 * Reads from POLICY_SOURCE_DIR (e.g., ./data), supports pdf/docx/md/txt.
 * Requires env: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY.
 */
/* eslint-disable no-console */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const matter = require('gray-matter');
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const { spawnSync } = require('child_process');

const SOURCE_DIR = process.env.POLICY_SOURCE_DIR || './data';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const EMBED_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-3-large';
const CHUNK_SIZE = parseInt(process.env.POLICY_CHUNK_SIZE || '1000', 10); // approx chars per chunk
const CHUNK_OVERLAP = parseInt(process.env.POLICY_CHUNK_OVERLAP || '100', 10);
const MAX_FILE_CHARS = parseInt(process.env.MAX_POLICY_FILE_CHARS || '200000', 10); // cap text to avoid OOM
const SKIP_PDFS = process.env.SKIP_PDFS === 'true';

if (!SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.OPENAI_API_KEY) {
  console.error('Missing env: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function readLimitedText(filePath) {
  const fd = fs.openSync(filePath, 'r');
  const chunk = 64 * 1024;
  let buf = Buffer.alloc(chunk);
  let total = '';
  let bytesRead = 0;
  while (total.length < MAX_FILE_CHARS) {
    bytesRead = fs.readSync(fd, buf, 0, chunk, null);
    if (!bytesRead) break;
    total += buf.slice(0, bytesRead).toString('utf8');
    if (bytesRead < chunk) break;
  }
  fs.closeSync(fd);
  if (total.length > MAX_FILE_CHARS) {
    console.warn(`Truncating large file (${total.length} chars) to ${MAX_FILE_CHARS} chars: ${filePath}`);
    total = total.slice(0, MAX_FILE_CHARS);
  }
  return total;
}

async function loadFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  // Prefer existing .txt alongside PDF
  if (ext === '.pdf') {
    const txtPath = filePath.replace(/\.pdf$/i, '.txt');
    if (fs.existsSync(txtPath)) {
      console.log(`Using existing TXT instead of PDF: ${txtPath}`);
      return readLimitedText(txtPath);
    }
    if (SKIP_PDFS) {
      console.warn(`Skipping PDF due to SKIP_PDFS=true: ${filePath}`);
      return '';
    }
  }

  if (ext === '.pdf') {
    // Try external pdftotext to temp file to avoid huge stdout
    const tmpPath = filePath + '.tmp.txt';
    let text = '';
    try {
      const res = spawnSync('pdftotext', ['-layout', filePath, tmpPath], { encoding: 'utf8' });
      if (res.status === 0 && !res.error && fs.existsSync(tmpPath)) {
        text = readLimitedText(tmpPath);
        fs.unlinkSync(tmpPath);
      }
    } catch (e) {
      // ignore and fall back
    }
    if (!text) {
      // Fallback to pdf-parse (may be heavy on large PDFs)
      const data = await pdfParse(fs.readFileSync(filePath));
      text = data.text || '';
      if (text.length > MAX_FILE_CHARS) {
        console.warn(`Truncating large PDF (${text.length} chars) to ${MAX_FILE_CHARS} chars: ${filePath}`);
        text = text.slice(0, MAX_FILE_CHARS);
      }
    }
    return text;
  }

  if (ext === '.docx') {
    const result = await mammoth.extractRawText({ buffer: fs.readFileSync(filePath) });
    let text = result.value || '';
    if (text.length > MAX_FILE_CHARS) {
      console.warn(`Truncating large DOCX (${text.length} chars) to ${MAX_FILE_CHARS} chars: ${filePath}`);
      text = text.slice(0, MAX_FILE_CHARS);
    }
    return text;
  }
  if (ext === '.md') {
    const raw = readLimitedText(filePath);
    const parsed = matter(raw);
    let text = parsed.content || '';
    if (text.length > MAX_FILE_CHARS) {
      console.warn(`Truncating large MD (${text.length} chars) to ${MAX_FILE_CHARS} chars: ${filePath}`);
      text = text.slice(0, MAX_FILE_CHARS);
    }
    return text;
  }
  if (ext === '.txt') {
    return readLimitedText(filePath);
  }
  return '';
}

function chunkText(text) {
  const clean = text.replace(/\r\n/g, '\n').trim();
  const chunks = [];
  let idx = 0;
  while (idx < clean.length) {
    const end = Math.min(clean.length, idx + CHUNK_SIZE);
    const slice = clean.slice(idx, end).trim();
    if (slice.length > 0) chunks.push(slice);
    idx = end - CHUNK_OVERLAP;
    if (idx < 0) idx = end;
  }
  return chunks;
}

async function embed(text) {
  const res = await openai.embeddings.create({
    model: EMBED_MODEL,
    input: text,
  });
  return res.data[0].embedding;
}

async function upsertDocument(title, relPath) {
  // delete existing by path to avoid duplicates
  await supabase.from('policy_documents').delete().eq('path', relPath);
  const { data, error } = await supabase
    .from('policy_documents')
    .insert({ title, path: relPath, version: 'v1' })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

async function ingestFile(fullPath) {
  const relPath = path.relative(SOURCE_DIR, fullPath);
  const title = path.basename(fullPath);
  console.log(`Ingesting ${relPath}`);
  const content = await loadFile(fullPath);
  if (!content.trim()) {
    console.warn(`No content parsed for ${relPath}, skipping.`);
    return;
  }
  const docId = await upsertDocument(title, relPath);
  const chunks = chunkText(content);
  console.log(`Chunks to process: ${chunks.length}`);

  // insert per chunk to avoid holding all embeddings in memory
  for (let i = 0; i < chunks.length; i++) {
    const embedding = await embed(chunks[i]);
    const row = {
      doc_id: docId,
      title,
      section: null,
      page: null,
      version: 'v1',
      chunk: chunks[i],
      embedding,
    };
    const { error } = await supabase.from('policy_chunks').insert(row);
    if (error) throw error;
  }
  console.log(`Inserted ${chunks.length} chunks for ${relPath}`);
}

function walk(dir) {
  const files = fs.readdirSync(dir);
  let results = [];
  files.forEach((file) => {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(full));
    } else {
      const ext = path.extname(full).toLowerCase();
      if (['.pdf', '.docx', '.md', '.txt'].includes(ext)) {
        results.push(full);
      }
    }
  });
  return results;
}

(async () => {
  try {
    const files = walk(SOURCE_DIR);
    if (files.length === 0) {
      console.warn(`No files found under ${SOURCE_DIR}`);
      process.exit(0);
    }
    for (const f of files) {
      await ingestFile(f);
    }
    console.log('Ingestion complete.');
    process.exit(0);
  } catch (err) {
    console.error('Ingestion failed:', err);
    process.exit(1);
  }
})();
