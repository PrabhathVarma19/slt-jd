import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { OpenAIEmbeddings } from '@langchain/openai';
import { supabaseServer } from '@/lib/supabase/server';

const DEFAULT_MATCHES = 6;
const DEFAULT_MODEL = process.env.CHAT_MODEL || 'gpt-4o-mini';
const DEFAULT_EMBED_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-3-large';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const question = (body?.question || '').toString().trim();
    const filters = body?.filters || {};
    if (!question) {
      return NextResponse.json({ error: 'Missing question' }, { status: 400 });
    }
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 500 });
    }

    // Embed the question
    const embedder = new OpenAIEmbeddings({
      apiKey: process.env.OPENAI_API_KEY,
      modelName: DEFAULT_EMBED_MODEL,
    });
    const [queryEmbedding] = await embedder.embedDocuments([question]);

    // Retrieve similar chunks via Supabase RPC
    const { data, error } = await supabaseServer.rpc('match_policy_chunks', {
      query_embedding: queryEmbedding,
      match_count: DEFAULT_MATCHES,
      filter: {
        category: filters.category || null,
        access_level: filters.access_level || null,
        effective_date: filters.effective_date || null,
      },
    });

    if (error) {
      console.error('match_policy_chunks error:', error);
      return NextResponse.json({ error: 'Retrieval failed' }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        answer: 'No relevant policy sections found. Try adjusting filters or rephrasing.',
        sources: [],
      });
    }

    // Build context for the LLM with citations
    const context = data
      .map(
        (d: any, idx: number) =>
          `[${idx + 1}] Title: ${d.title || 'Untitled'}; Section: ${d.section || 'N/A'}; Page: ${
            d.page || 'N/A'
          }\n${d.chunk}`
      )
      .join('\n\n');

    const systemPrompt = `You are a strict policy assistant. Answer ONLY from the provided context. 
Include citations like [1], [2] that refer to the sources list. 
If you cannot find a clear answer, say you do not know.`;

    const userPrompt = `Question: ${question}

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

    const answer = completion.choices[0]?.message?.content || 'No answer generated.';

    const sources = data.map((d: any, idx: number) => ({
      id: d.id,
      title: d.title || 'Untitled',
      section: d.section || '',
      page: d.page,
      snippet: d.chunk,
      similarity: d.similarity,
      link: d.path || null,
      citation: `[${idx + 1}]`,
    }));

    return NextResponse.json({ answer, sources });
  } catch (error: any) {
    console.error('Policy agent error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process request' }, { status: 500 });
  }
}
