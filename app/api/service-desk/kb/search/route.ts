import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import fs from 'fs';
import path from 'path';

const KB_DIR =
  process.env.POLICY_SOURCE_DIR || path.join(process.cwd(), 'data', 'policies', 'it');
const MAX_FILES = 200;
const MAX_CHUNKS = 6;
const CHUNK_CHAR_LIMIT = 1000;

type PolicyChunk = {
  id: string;
  filePath: string;
  title: string;
  content: string;
  index: number;
};

let cachedChunks: PolicyChunk[] | null = null;

function listPolicyFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];

  const files = new Map<string, string>();
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listPolicyFiles(full).forEach((p) => {
        const base = path.basename(p).toLowerCase();
        files.set(base, p);
      });
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.txt')) {
      const name = entry.name.toLowerCase();
      const base = name.endsWith('.normalized.txt')
        ? name.replace('.normalized.txt', '.txt')
        : name;

      if (!files.has(base) || name.endsWith('.normalized.txt')) {
        files.set(base, full);
      }
    }
  }

  return Array.from(files.values());
}

function chunkText(text: string, maxLen: number): string[] {
  const normalized = text.replace(/\r\n/g, '\n');
  const paragraphs = normalized.split(/\n\s*\n/g).map((p) => p.trim()).filter(Boolean);

  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    if (!current) {
      current = para;
      continue;
    }
    if ((current + '\n\n' + para).length <= maxLen) {
      current += '\n\n' + para;
    } else {
      chunks.push(current);
      current = para;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function tokenize(text: string): string[] {
  const STOP_WORDS = new Set([
    'the',
    'a',
    'an',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'being',
    'to',
    'of',
    'in',
    'on',
    'for',
    'and',
    'or',
    'with',
    'at',
    'by',
    'from',
    'this',
    'that',
    'these',
    'those',
    'it',
    'its',
    'as',
    'about',
    'into',
    'over',
    'under',
    'up',
    'down',
    'what',
    'who',
    'where',
    'when',
    'why',
    'how',
  ]);

  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((t) => t.trim())
    .filter((t) => t && !STOP_WORDS.has(t));
}

function extractSectionTitle(text: string): string | null {
  const lines = text.split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (/^\d+(\.\d+)*\s+/.test(line)) {
      return line;
    }

    if (/^[-*•]\s+/.test(line)) {
      continue;
    }

    if (/[A-Z]/.test(line) && line === line.toUpperCase() && line.length <= 80) {
      return line;
    }
  }
  return null;
}

function getPolicyChunks(): PolicyChunk[] {
  if (cachedChunks) return cachedChunks;

  const files = listPolicyFiles(KB_DIR).slice(0, MAX_FILES);
  const allChunks: PolicyChunk[] = [];

  files.forEach((filePath, fileIndex) => {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      if (!raw.trim()) return;

      const chunks = chunkText(raw, CHUNK_CHAR_LIMIT);
      const title =
        path.basename(filePath).replace(/\.txt$/i, '').replace(/[_]+/g, ' ');

      chunks.forEach((content, chunkIndex) => {
        allChunks.push({
          id: `${fileIndex}-${chunkIndex}`,
          filePath,
          title,
          content,
          index: chunkIndex,
        });
      });
    } catch (err) {
      console.error('Failed to read policy file', filePath, err);
    }
  });

  cachedChunks = allChunks;
  return allChunks;
}

function rankChunks(question: string, chunks: PolicyChunk[]): PolicyChunk[] {
  const terms = Array.from(new Set(tokenize(question)));
  if (terms.length === 0) return [];

  const scored = chunks
    .map((chunk) => {
      const text = chunk.content.toLowerCase();
      let score = 0;
      for (const term of terms) {
        if (!term) continue;
        const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
        const matches = text.match(re);
        if (matches) score += matches.length;
      }
      return { chunk, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return [];

  const maxScore = scored[0].score;
  const minScore = Math.max(1, Math.floor(maxScore * 0.5));

  const filtered = scored.filter((item) => item.score >= minScore);
  return filtered.slice(0, MAX_CHUNKS).map((item) => item.chunk);
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = await req.json();
    const { query } = body;

    const question = (query || '').toString().trim();
    if (!question) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const chunks = getPolicyChunks();
    if (!chunks.length) {
      return NextResponse.json({
        message: 'No knowledge base documents are available to search.',
        results: [],
      });
    }

    const topChunks = rankChunks(question, chunks);
    if (!topChunks.length) {
      return NextResponse.json({
        message: 'No relevant sections found. Please refine your query.',
        results: [],
      });
    }

    const results = topChunks.map((chunk) => {
      const section = extractSectionTitle(chunk.content);
      const snippet = chunk.content.slice(0, 400);
      return {
        title: chunk.title,
        section,
        snippet,
        source: chunk.filePath,
      };
    });

    return NextResponse.json({
      message: `Found ${results.length} relevant section(s).`,
      results,
    });
  } catch (error: any) {
    console.error('KB search error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to search knowledge base' },
      { status: 500 }
    );
  }
}

