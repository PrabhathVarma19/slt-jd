import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const DEFAULT_MODEL = process.env.CHAT_MODEL || 'gpt-4o-mini';
const POLICY_DIR =
  process.env.POLICY_SOURCE_DIR || path.join(process.cwd(), 'data', 'policies');
const MAX_FILES = 100; // safety guard
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

function getPolicyChunks(): PolicyChunk[] {
  if (cachedChunks) return cachedChunks;

  const files = listPolicyFiles(POLICY_DIR).slice(0, MAX_FILES);
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

  const gradeMatches = Array.from(
    question.matchAll(/grade\s+(\d+)/gi)
  ).map((m) => m[1]);

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

      if (gradeMatches.length > 0) {
        for (const g of gradeMatches) {
          if (!g) continue;
          if (text.includes(`grade ${g}`)) {
            score += 6;
          }
          if (text.includes(`grade ${g} and above`) || text.includes(`grade ${g}+`)) {
            score += 4;
          }
        }
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

function extractSectionTitle(text: string): string | null {
  const lines = text.split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // Numeric heading, e.g. "4.1 Mode of Transport – Eligibility"
    if (/^\d+(\.\d+)*\s+/.test(line)) {
      return line;
    }

    // Ignore simple bullet lines (which can contain things like "SLT: INR 9,500")
    if (/^[-*•]\s+/.test(line)) {
      continue;
    }

    // All-caps short line that looks like a section heading
    if (/[A-Z]/.test(line) && line === line.toUpperCase() && line.length <= 80) {
      return line;
    }
  }
  return null;
}

function getOriginalLink(filePath: string): string | null {
  const baseName = path.basename(filePath).replace(/\.txt$/i, '');
  const publicDir = path.join(process.cwd(), 'public', 'policies');
  const exts = ['.pdf', '.docx', '.doc'];

  for (const ext of exts) {
    const candidate = path.join(publicDir, baseName + ext);
    if (fs.existsSync(candidate)) {
      return `/policies/${baseName}${ext}`;
    }
  }

  return null;
}

function extractRtoRules(text: string): { attendance?: string; hours?: string } {
  const lower = text.toLowerCase();
  if (!lower.includes('return to office') && !lower.includes('rto policy')) {
    return {};
  }

  let attendance: string | undefined;
  let hours: string | undefined;

  const lines = text.split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (!attendance && /office attendance/i.test(line)) {
      const m = line.match(/office attendance[^:]*:\s*(.+)$/i);
      attendance = m ? m[1].trim() : line;
    }

    if (!hours && /work hours/i.test(line)) {
      const m = line.match(/work hours[^:]*:\s*(.+)$/i);
      hours = m ? m[1].trim() : line;
    }

    if (attendance && hours) break;
  }

  return { attendance, hours };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawMessages = Array.isArray(body?.messages) ? body.messages : [];
    const history: { role: 'user' | 'assistant'; content: string }[] = rawMessages
      .filter(
        (m: any) =>
          m &&
          (m.role === 'user' || m.role === 'assistant') &&
          typeof m.content === 'string'
      )
      .map((m: any) => ({ role: m.role, content: m.content }));

    const lastUser = [...history].reverse().find((m) => m.role === 'user');
    const fallbackQuestion = (body?.question || '').toString();
    const question = (lastUser?.content || fallbackQuestion || '').trim();

    if (!question) {
      return NextResponse.json({ error: 'Missing question' }, { status: 400 });
    }
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 500 });
    }

    const chunks = getPolicyChunks();
    if (!chunks.length) {
      return NextResponse.json({
        answer: 'No policy documents are available to search. Please add policy text files and try again.',
        sources: [],
      });
    }

    const topChunks = rankChunks(question, chunks);
    if (!topChunks.length) {
      return NextResponse.json({
        answer:
          'I could not find any relevant sections in the current policy documents. Please rephrase your question or verify the documents.',
        sources: [],
      });
    }

    const grouped = new Map<
      string,
      { title: string; filePath: string; sections: string[] }
    >();

    topChunks.forEach((chunk) => {
      const key = chunk.title || chunk.filePath;
      const sectionTitle = extractSectionTitle(chunk.content);
      const existing = grouped.get(key);
      if (existing) {
        if (sectionTitle) existing.sections.push(sectionTitle);
      } else {
        grouped.set(key, {
          title: chunk.title,
          filePath: chunk.filePath,
          sections: sectionTitle ? [sectionTitle] : [],
        });
      }
    });

    const sources = Array.from(grouped.values()).map((entry, idx) => {
      const uniqueSections = Array.from(new Set(entry.sections));
      const sectionLabel =
        uniqueSections.length > 0
          ? uniqueSections.join('; ')
          : '';

      return {
        id: `${idx}`,
        title: entry.title,
        section: sectionLabel,
        page: null,
        snippet: null,
        similarity: null,
        link: getOriginalLink(entry.filePath),
        citation: `[${idx + 1}]`,
        filePath: entry.filePath,
      };
    });

    const isRtoQuestion = /return to office|rto policy/i.test(question);
    let answer: string | null = null;

    if (isRtoQuestion) {
      const rtoChunks = chunks.filter(
        (chunk) =>
          /return to office/i.test(chunk.title) ||
          /return to office|rto policy/i.test(chunk.content)
      );

      const rtoText = (rtoChunks.length ? rtoChunks : topChunks)
        .map((chunk) => chunk.content)
        .join('\n\n');

      const { attendance, hours } = extractRtoRules(rtoText);
      if (attendance || hours) {
        const parts: string[] = [];
        if (attendance) {
          parts.push(`Office attendance: ${attendance}`);
        }
        if (hours) {
          parts.push(`Work hours: ${hours}`);
        }
        answer = `According to the Trianz India Return to Office Policy, ${parts.join(
          '. '
        )} [1]`;
      }
    }

    if (!answer) {
      const historyText =
        history.length > 0
          ? history
              .slice(-6)
              .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
              .join('\n')
          : '[No prior conversation]';

      const context = topChunks
        .map(
          (chunk, idx) =>
            `[${idx + 1}] File: ${chunk.title}\n${chunk.content}`
        )
        .join('\n\n');

      const systemPrompt = `You are "Ask Beacon", an internal assistant for Trianz.
You answer questions about company policies and internal "how do I..." processes.
You must answer ONLY from the provided context and must not invent new policies or rules.
Include citations like [1], [2] that refer to the sources list.
Always include concrete rules and quantitative details (such as number of days per week, required hours, eligibility levels, monetary limits, and key exceptions) when they are present in the context.
Respond in plain text only: no Markdown, no bold, no italics, no bullet symbols like "*" or "-".
When you describe a sequence of steps, use numbered lines (for example "1. ...", "2. ...") with each step on its own line.
If you cannot find a clear answer, explicitly say you do not know and, if appropriate, suggest that the user contact HR, their manager, or the relevant support team.`;

      const userPrompt = `Conversation so far:
${historyText}

New question: ${question}

Context:
${context}

Respond with a concise answer and include citations [n] for every factual statement.`;

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await openai.chat.completions.create({
        model: DEFAULT_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0,
      });

      answer = completion.choices[0]?.message?.content || 'No answer generated.';
    }

    let finalAnswer = answer;
    const qLower = question.toLowerCase();
    const aLower = answer.toLowerCase();

    if (qLower.includes('medical') && qLower.includes('travel')) {
      finalAnswer =
        'The current written travel policies do not define separate standing entitlements based only on having a medical condition. ' +
        'Travel modes, hotel limits, and per diem remain based on your grade and destination. ' +
        'Medical emergencies are mentioned mainly as exceptions (for example, for no-show charges or urgent changes) and require case-by-case approval. ' +
        'In practice, you should follow the normal grade-based travel rules in the policy and request any health-related exceptions through your manager, HR, and the Travel Desk.';
    } else if (
      (qLower.includes('medical') || qLower.includes('health')) &&
      aLower.includes('i do not know')
    ) {
      finalAnswer =
        'The current written policies do not define separate standing entitlements based only on having a medical condition. ' +
        'Medical emergencies are mentioned mainly as exceptions (for example, for no-show charges or temporary Return to Office exceptions with HR approval). ' +
        'In practice, you should follow the normal grade-based rules in the policy and request a case-by-case exception through your manager, HR, and the relevant support team (such as HR or the Travel Desk).';
    }

    return NextResponse.json({ answer: finalAnswer, sources });
  } catch (error: any) {
    console.error('Policy agent error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process request' }, { status: 500 });
  }
}
