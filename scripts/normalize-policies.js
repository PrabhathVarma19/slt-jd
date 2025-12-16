/* eslint-disable no-console */

// Normalizes raw policy text files into AI-friendly text.
// For each .txt under POLICY_SOURCE_DIR, this script:
//  - Calls the OpenAI chat model on chunks of the file
//  - Asks it to rewrite tables / dense text into clear bullet-point rules
//  - Writes <basename>.normalized.txt alongside the original
//
// Usage:
//   OPENAI_API_KEY=... node scripts/normalize-policies.js
// or via npm script:
//   npm run normalize-policies

const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
require('dotenv').config();

const POLICY_DIR =
  process.env.POLICY_SOURCE_DIR || path.join(process.cwd(), 'data', 'policies');
const MODEL = process.env.CHAT_MODEL || 'gpt-4o-mini';

// Conservative to stay under model limits; we send multiple chunks if needed.
const MAX_INPUT_CHARS = 5000;

function listTextFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listTextFiles(full));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.txt')) {
      // Skip already-normalized files; we only start from raw exports.
      if (!entry.name.toLowerCase().endsWith('.normalized.txt')) {
        results.push(full);
      }
    }
  }
  return results;
}

function chunkText(text, maxLen) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    const slice = text.slice(i, i + maxLen);
    chunks.push(slice);
    i += maxLen;
  }
  return chunks;
}

async function normalizeChunk(openai, chunk, index, total) {
  const systemPrompt =
    'You are an assistant that rewrites raw text extracted from PDF policy documents into clean, explicit policy rules.\n' +
    '- Preserve important headings and numbering (e.g., "4.1 Mode of Transport – Eligibility").\n' +
    '- When you see tables that have been flattened into lines (for example MODE / CLASS / GRADE listed separately), rewrite them as clear bullet-point rules.\n' +
    '- Make relationships explicit. For example, convert rows into sentences like "For grade 5 and above, eligible travel modes are: AIR (Economy Class), RAIL (...), ROAD (...)." \n' +
    '- Do NOT invent new rules or numbers; only restate what is present, in clearer form.\n' +
    '- Keep the output concise and suitable for a question-answering system.';

  const userPrompt =
    `This is part ${index + 1} of ${total} from a single policy document.\n\n` +
    'Rewrite this text as described, keeping headings and converting any implicit tables into explicit rules:\n\n' +
    chunk;

  const completion = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  return completion.choices[0]?.message?.content || '';
}

async function normalizeFile(openai, filePath) {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath, '.txt');
  const outPath = path.join(dir, `${base}.normalized.txt`);

  if (fs.existsSync(outPath)) {
    console.log(`Skipping ${filePath} (normalized file already exists).`);
    return;
  }

  console.log(`Normalizing ${filePath} -> ${outPath}`);
  const raw = fs.readFileSync(filePath, 'utf8');
  if (!raw.trim()) {
    console.warn(`File is empty, skipping: ${filePath}`);
    return;
  }

  const chunks = chunkText(raw, MAX_INPUT_CHARS);
  const outputs = [];

  for (let i = 0; i < chunks.length; i += 1) {
    console.log(`  Chunk ${i + 1}/${chunks.length}...`);
    // sequential on purpose to avoid hitting rate limits too hard
    // eslint-disable-next-line no-await-in-loop
    const normalized = await normalizeChunk(openai, chunks[i], i, chunks.length);
    outputs.push(normalized.trim());
  }

  const finalText = outputs.join('\n\n').trim();
  fs.writeFileSync(outPath, finalText, 'utf8');
  console.log(`  Wrote normalized policy: ${outPath}`);
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('Missing OPENAI_API_KEY in environment.');
    process.exit(1);
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  console.log(`Scanning for raw policy text files in: ${POLICY_DIR}`);
  const files = listTextFiles(POLICY_DIR);

  if (!files.length) {
    console.log('No .txt policy files found.');
    return;
  }

  for (const file of files) {
    // eslint-disable-next-line no-await-in-loop
    await normalizeFile(openai, file);
  }

  console.log('Normalization complete.');
}

main().catch((err) => {
  console.error('Normalization failed:', err);
  process.exit(1);
});

