/**
 * Ingest local policy files into the policy_documents/policy_chunks tables.
 * Reads from POLICY_SOURCE_DIR (e.g., ./data), supports pdf/docx/md/txt.
 * Requires env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY.
 */
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const matter = require('gray-matter');
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

const SOURCE_DIR = process.env.POLICY_SOURCE_DIR || './data';
const EMBED_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-3-large';
const CHUNK_SIZE = 1800; // approx characters per chunk
const CHUNK_OVERLAP = 200;

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.OPENAI_API_KEY) {
  console.error('Missing env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY');
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function loadFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') {
    const data = await pdfParse(fs.readFileSync(filePath));
    return data.text || '';
  }
  if (ext === '.docx') {
    const result = await mammoth.extractRawText({ buffer: fs.readFileSync(filePath) });
    return result.value || '';
  }
  if (ext === '.md') {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = matter(raw);
    return parsed.content || '';
  }
  if (ext === '.txt') {
    return fs.readFileSync(filePath, 'utf8');
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
  const rows = [];
  for (let i = 0; i < chunks.length; i++) {
    const embedding = await embed(chunks[i]);
    rows.push({
      doc_id: docId,
      title,
      section: null,
      page: null,
      version: 'v1',
      chunk: chunks[i],
      embedding,
    });
  }
  // insert in batches
  const batchSize = 20;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from('policy_chunks').insert(batch);
    if (error) throw error;
  }
  console.log(`Inserted ${rows.length} chunks for ${relPath}`);
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
