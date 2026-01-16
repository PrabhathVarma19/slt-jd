import { NextRequest, NextResponse } from 'next/server';
import { runAgent } from '@/lib/ai/agent-runner';
import { requireAuth } from '@/lib/auth/require-auth';
import { getAgentHistory, storeAgentMessages } from '@/lib/ai/agent-memory';
import { createAgentLog } from '@/lib/ai/agent-logs';
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

function extractKeyRules(answer: string): string | null {
  const raw = answer.replace(/\r\n/g, '\n');
  const sentences = raw
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const KEY_PATTERN = /\d|grade\s+\d+|day\b|days\b|hour\b|hours\b|inr\b|₹|per diem/i;

  const candidates = sentences.filter((s) => KEY_PATTERN.test(s));
  if (!candidates.length) return null;

  return candidates.slice(0, 4).join('\n');
}

// Small set of pre-reviewed "golden" answers for very common, high‑impact questions.
// These bypass the model for speed and consistency, but still return lightweight sources.
function getGoldenAnswer(question: string, mode?: string): {
  answer: string;
  sources?: Array<{ title?: string; section?: string; page?: number; link?: string | null }>;
} | null {
  const q = question.toLowerCase();
  const m = mode ?? 'default';

  // Return to Office expectations – days in office per week.
  if (
    (q.includes('return to office') || q.includes('rto')) &&
    (q.includes('how many') || q.includes('days') || q.includes('in office'))
  ) {
    const answer =
      'According to the Trianz India Return to Office (RTO) Policy, associates are expected to work from the office for a minimum of three (3) designated days per week as per the roster agreed with their manager. ' +
      'Standard working hours remain nine (9) hours per day, including a one‑hour lunch break. ' +
      'Exceptions for critical medical conditions or caregiving responsibilities can be approved case‑by‑case by HR and leadership for a defined period, after which they are reviewed. ' +
      'If you believe you need an exception, speak with your manager and HR before changing your working pattern.';

    return {
      answer,
      sources: [
        {
          title: 'Trianz India Return to Office Policy',
          section: '3. Expectations',
          page: 1,
          link: null,
        },
      ],
    };
  }

  // Travel modes / eligibility by grade.
  if (
    (q.includes('travel mode') ||
      q.includes('mode of transport') ||
      (q.includes('travel') && q.includes('grade'))) &&
    q.includes('policy')
  ) {
    const answer =
      'Under the Trianz India Travel Policy (domestic travel – “Mode of Transport – Eligibility”):\n\n' +
      '- Air: Economy class air travel is eligible for associates in Grade 5 and above. Associates who are not eligible for air travel may still travel by air with prior approval from the divisional or business head in situations such as emergencies, critical customer service, long rail/road journeys (18 hours or more), or where rail/road fare is greater than or equal to airfare.\n' +
      '- Rail: AC 2‑tier / AC Chair‑car / AC 2‑tier sleeper / AC‑3‑tier sleeper are allowed for all grades. Air‑conditioned 1st Class rail travel is typically allowed from Grade 9 and above.\n' +
      '- Road: Air‑conditioned coach / Luxury / Volvo buses are allowed for all grades.\n' +
      '- When convenient overnight public transport is available, associates in Salary Group 8 and below are expected to use it (for example, overnight trains on routes such as Bangalore–Chennai).\n\n' +
      'For any specific trip, you should still check the latest travel policy and obtain approvals where required (especially for air travel when your grade is normally not eligible).';

    return {
      answer,
      sources: [
        {
          title: 'Trianz India Travel Policy',
          section: '4.1 Mode of Transport – Eligibility',
          page: 1,
          link: null,
        },
      ],
    };
  }

  // Annual leave entitlement for India associates.
  if (
    (q.includes('leave days') || q.includes('annual leave') || q.includes('earned leave')) &&
    (q.includes('year') || q.includes('per year') || q.includes('in a year'))
  ) {
    const answer =
      'For Trianz India associates, the standard annual leave entitlements documented in the HR policies are:\n\n' +
      '- Earned Leave: 18 working days per year.\n' +
      '- Sick / Contingency Leave: 6 working days per year.\n' +
      '- Paternity Leave: 5 working days (where applicable).\n' +
      '- Adoption Leave: 10 working days (for eligible adoption cases).\n' +
      '- Bereavement Leave: 5 working days.\n\n' +
      'These numbers apply to full‑time India associates as per the current policy. Always check the latest HR communication or your offer letter for any role‑ or location‑specific differences, and speak with HR if you have a special case.';

    return {
      answer,
      sources: [
        {
          title: 'Trianz India HR Policies',
          section: 'Leave entitlements',
          page: 1,
          link: null,
        },
      ],
    };
  }

  // Probation period for new joiners.
  if (q.includes('probation') && (q.includes('period') || q.includes('how long'))) {
    const answer =
      'For most new Trianz India associates, the probation period defined in the HR policies is six (6) months from the date of joining, unless a different duration is explicitly mentioned in the offer letter or employment contract. ' +
      'During probation, performance, conduct, and cultural fit are reviewed; confirmation is communicated in writing once the probation period is successfully completed. ' +
      'If your offer letter or local law specifies a different probation duration, that specific document takes precedence over the generic policy.';

    return {
      answer,
      sources: [
        {
          title: 'Trianz India HR Policies',
          section: 'Probation and confirmation',
          page: 1,
          link: null,
        },
      ],
    };
  }

  // Default: no golden answer match.
  return null;
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
    const auth = await requireAuth();
    const body = await req.json();
    const mode: 'default' | 'new_joiner' | 'expenses' =
      (body?.mode as 'default' | 'new_joiner' | 'expenses') || 'default';
    const style: 'standard' | 'how_to' =
      (body?.style as 'standard' | 'how_to') || 'standard';
    const agentName =
      mode === 'new_joiner'
        ? 'new-joiner'
        : mode === 'expenses'
          ? 'expenses-coach'
          : 'policy-agent';

    const rawMessages = Array.isArray(body?.messages) ? body.messages : [];
    const bodyHistory: { role: 'user' | 'assistant'; content: string }[] = rawMessages
      .filter(
        (m: any) =>
          m &&
          (m.role === 'user' || m.role === 'assistant') &&
          typeof m.content === 'string'
      )
      .map((m: any) => ({ role: m.role, content: m.content }));

    const storedHistory = await getAgentHistory(auth.userId, agentName);
    const currentUserMessage =
      [...bodyHistory].reverse().find((m) => m.role === 'user') ||
      (body?.question
        ? { role: 'user' as const, content: body.question.toString() }
        : null);

    const history =
      storedHistory.length > 0
        ? [...storedHistory, ...(currentUserMessage ? [currentUserMessage] : [])]
        : bodyHistory;

    const lastUser = [...history].reverse().find((m) => m.role === 'user');
    const prevUser =
      [...history]
        .reverse()
        .filter((m) => m.role === 'user')
        .slice(1)[0] || null;
    const fallbackQuestion = (body?.question || '').toString();
    const question = (lastUser?.content || fallbackQuestion || '').trim();

    if (!question) {
      return NextResponse.json({ error: 'Missing question' }, { status: 400 });
    }
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 500 });
    }

    // Build an "effective question" for retrieval and answering so that short / ambiguous
    // follow-ups stay anchored to the previous topic.
    let retrievalQuestion = question;
    let effectiveQuestion = question;
    const lower = question.toLowerCase();
    const isVeryShort = question.split(/\s+/).filter(Boolean).length <= 6;
    const hasPronoun =
      /\b(it|they|them|that|this|there|those|these|how many|how much)\b/.test(lower);

    if (prevUser && (isVeryShort || hasPronoun)) {
      retrievalQuestion = `${prevUser.content}\nFollow-up question: ${question}`;
      effectiveQuestion = retrievalQuestion;
    }

    if (!prevUser && (isVeryShort || hasPronoun)) {
      const clarification =
        'Which policy or topic are you asking about? For example: Return to Office, travel eligibility, leave, or expenses.';
      await storeAgentMessages(auth.userId, agentName, [
        { role: 'user', content: question },
        { role: 'assistant', content: clarification },
      ]);
      await createAgentLog({
        userId: auth.userId,
        agent: agentName,
        input: question,
        intent: 'ask_followup',
        tool: 'none',
        response: clarification,
        success: true,
        metadata: { mode, style },
      });
      return NextResponse.json({ answer: clarification, keyRules: null, sources: [] });
    }

    // Check for a pre-reviewed "golden" answer first for very common FAQs.
    const golden = getGoldenAnswer(effectiveQuestion, mode);
    if (golden) {
      const keyRules = extractKeyRules(golden.answer);
      await createAgentLog({
        userId: auth.userId,
        agent: agentName,
        input: effectiveQuestion,
        intent: 'policy_qa',
        tool: 'kb_search',
        response: golden.answer,
        success: true,
        metadata: { mode, style, source: 'golden' },
      });
      return NextResponse.json({
        answer: golden.answer,
        keyRules,
        sources: golden.sources ?? [],
      });
    }

    const chunks = getPolicyChunks();
    if (!chunks.length) {
      return NextResponse.json({
        answer: 'No policy documents are available to search. Please add policy text files and try again.',
        sources: [],
      });
    }

    const topChunks = rankChunks(retrievalQuestion, chunks);
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

    const isRtoQuestion = /return to office|rto policy/i.test(effectiveQuestion);
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

      const basePrompt = `You are "Ask Beacon", an internal assistant for Trianz.
You answer questions about company policies, security/Infosec guidelines, and internal "how do I..." processes.
You must answer ONLY from the provided context and must not invent new policies, rules, or security exceptions.
Include citations like [1], [2] that refer to the sources list.
Always include concrete rules and quantitative details (such as number of days per week, required hours, eligibility levels, monetary limits, and key exceptions) when they are present in the context.
If the user asks for a specific number (for example "how many days", "how many hours", "what limit", "what per diem", "what INR amount") and the context does NOT clearly state that number, you MUST say that the policy text shown to you does not specify an exact value and you MUST NOT guess or assume a number.
For security or compliance topics (for example phishing, passwords, data classification, VPN, device usage), always choose the safest interpretation of the written guidance and never relax requirements beyond what is stated.
Respond in plain text only: no Markdown, no bold, no italics, no bullet symbols like "*" or "-".
When you describe a sequence of steps, use numbered lines (for example "1. ...", "2. ...") with each step on its own line.
If you cannot find a clear answer, explicitly say you do not know and, if appropriate, suggest that the user contact HR, InfoSec (infosec@trianz.com), their manager, or the relevant support team.`;

      const newJoinerAddendum =
        'You are currently helping a new joiner who may not know internal jargon. Keep answers short and friendly. ' +
        'Avoid deep policy history; focus on what they actually need to do now. ' +
        'Always end with one final sentence like: "If you are unsure, please confirm with your manager or HR at hr@trianz.com."';

      const expensesAddendum =
        'You are currently answering a question about expenses, reimbursements, travel claims, or Fusion expense entry. ' +
        'Focus on:\n' +
        '- What is reimbursable vs. non-reimbursable (e.g., hotels, per diem, client dinners, roaming, gym, etc.).\n' +
        '- City / country / grade specific limits for hotel stays and per diem amounts, when available in context.\n' +
        '- How to submit or categorise the expense correctly in Fusion (which type to choose, what description to use, and what receipts to attach).\n' +
        'Keep the answer practical so the user can directly follow it while filling Fusion.';

      const howToAddendum =
        'For this question the user prefers a HOW-TO style answer.\n' +
        '- Start with a single short summary sentence.\n' +
        '- Then add a blank line and give 3 to 8 numbered steps (1., 2., 3., ...) describing exactly what the user should do in order.\n' +
        '- Each step must be on its own line and start with the step number.\n' +
        '- Keep wording concrete and actionable (who to contact, which tool to use, where to click, what to include in a request).\n' +
        '- Do not add extra commentary outside the summary sentence and the numbered steps.\n';

      let systemPrompt = basePrompt;
      if (mode === 'new_joiner') {
        systemPrompt = `${systemPrompt}\n\n${newJoinerAddendum}`;
      } else if (mode === 'expenses') {
        systemPrompt = `${systemPrompt}\n\n${expensesAddendum}`;
      }
      if (style === 'how_to') {
        systemPrompt = `${systemPrompt}\n\n${howToAddendum}`;
      }

      const userPrompt = `Conversation so far:
${historyText}

New question: ${effectiveQuestion}

Context:
${context}

Respond with a concise answer and include citations [n] for every factual statement.`;

      const contractPrompt = `${systemPrompt}\n\nReturn a JSON object with keys: intent, confidence, extracted, missing_fields, proposed_action, requires_confirmation, assistant_message. Set intent to \"none\" and proposed_action to null. Put the answer (with citations) in assistant_message.`;

      const decision = await runAgent({
        systemPrompt: contractPrompt,
        message: userPrompt,
        history,
        model: DEFAULT_MODEL,
      });

      answer = decision.assistantMessage || 'No answer generated.';
    }

    let finalAnswer = answer;
    const qLower = effectiveQuestion.toLowerCase();
    const aLower = answer.toLowerCase();

    // If the user clearly asked for a numeric value but the answer contains no digits,
    // fall back to a conservative "not specified" message instead of letting the model guess.
    const numericQuestionPattern =
      /how many|how much|how long|what.*limit|per diem|per-diem|days?\b|hours?\b|inr\b|₹|rs\b/i;
    const numericQuestion = numericQuestionPattern.test(qLower);
    const answerHasDigit = /\d/.test(finalAnswer);

    if (numericQuestion && !answerHasDigit) {
      finalAnswer =
        'From the policy text available to Beacon, an exact number is not stated for this question. ' +
        'Please confirm the precise value with your manager, HR, or the relevant support team (such as InfoSec or the Travel Desk).';
    }

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

    const keyRules = extractKeyRules(finalAnswer);

    await storeAgentMessages(auth.userId, agentName, [
      { role: 'user', content: question },
      { role: 'assistant', content: finalAnswer },
    ]);
    await createAgentLog({
      userId: auth.userId,
      agent: agentName,
      input: question,
      intent: 'policy_qa',
      tool: 'kb_search',
      response: finalAnswer,
      success: true,
      metadata: { mode, style },
    });

    return NextResponse.json({ answer: finalAnswer, keyRules, sources });
  } catch (error: any) {
    console.error('Policy agent error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process request' }, { status: 500 });
  }
}
