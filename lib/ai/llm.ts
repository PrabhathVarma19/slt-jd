import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { JDSections, Tone, Seniority, AutocompleteRequest } from '@/types/jd';
import { CommsRequest, CommsSections } from '@/types/comms';

const openaiApiKey = process.env.OPENAI_API_KEY;
const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;
const anthropic = anthropicApiKey ? new Anthropic({ apiKey: anthropicApiKey }) : null;

// Fixed About Trianz content - used in all JDs
export const ABOUT_TRIANZ_CONTENT = `Trianz is a leading-edge technology platforms and services company that accelerates digital transformations in data & analytics, digital experiences, cloud infrastructure, and security. The company's "IP Led Transformations" vision, strategy, and business models are based on insights from a recent global study spanning 20+ industries and 5000+ companies worldwide. Trianz believes that companies around the world face three challenges in their digital transformation journeys - shrinking "time to transform" due to competition & AI, lack of digital-ready talent, and uncertain economic conditions. To help clients leapfrog over these challenges, Trianz has built IP and platforms that have transformed the adoption of the cloud, data, analytics & insights AI.

Trianz platforms are changing the way companies approach various transformation disciplines:

Concierto:
A fully automated platform to Migrate, Manage, and Maximize the multi & hybrid cloud. A zero code and SaaS platform, Concierto allows teams to migrate to AWS, Azure, and GCP and manage them efficiently from a single pane of glass.

Avrio:
Avrio is an enterprise AI-powered data platform that empowers companies to leverage their data and drive intelligent decision-making at scale. Avrio generates real-time analytics, insights, opportunities, risks, and recommendations from all your data through intuitive conversations. Avrio is purpose-built to accelerate digital transformation by streamlining complex processes, reducing costs, and speeding up delivery of insights.

Pulse:
Recognizing that workforces will be distributed, mobile, and fluid, Trianz has built a "future of work" digital workplace platform called Pulse.`;

// Fixed Diversity & Inclusion Statement content - used in all JDs
export const DIVERSITY_INCLUSION_STATEMENT = `At Trianz, we believe that diversity and inclusion are fundamental to our success. We are committed to creating an environment where all individuals are valued, respected, and empowered to contribute their unique perspectives and experiences.

Equal Employment Opportunity
Trianz is an Equal Opportunity Employer and does not discriminate on the basis of race, color, creed, national or ethnic origin, gender, religion, disability, age, political affiliation or belief, disabled veteran, veterans (except in those special circumstances permitted or mandated by law).

Trianz Privacy Notice
Trianz respects your privacy and wants to ensure we comply with the applicable Data Privacy Regulations as per local regulator's laws. Please review our privacy policy.`;

interface GenerateJDParams {
  job_title: string;
  context?: string;
  tone: Tone;
  seniority: Seniority;
  length: 'short' | 'standard' | 'detailed';
  edited_responsibilities?: string[];
  edited_required_skills?: string[];
  edited_preferred_skills?: string[];
}

/**
 * Formats short phrases into complete, professional sentences using AI
 */
export async function formatPhrasesIntoSentences(
  items: string[],
  job_title: string,
  context: string | undefined,
  tone: Tone,
  seniority: Seniority,
  type: 'responsibility' | 'skill'
): Promise<string[]> {
  // If no items, return empty array
  if (!items || items.length === 0) return [];

  console.log(`LLM: formatPhrasesIntoSentences called with ${items.length} ${type}s`);
  
  // Check if items are already complete sentences
  const needsFormatting = items.filter(item => {
    const trimmed = item.trim();
    // If it's already a complete sentence (has period, question mark, or is long enough), keep as-is
    if (trimmed.length > 50 && (trimmed.includes('.') || trimmed.includes('?') || trimmed.includes('!'))) {
      return false;
    }
    // If it's a short phrase (less than 30 chars), format it
    return trimmed.length < 30;
  });

  console.log(`LLM: ${needsFormatting.length} items need formatting out of ${items.length}`);
  console.log(`LLM: Items that need formatting:`, needsFormatting);

  // Always format ALL items to ensure consistency and proper formatting
  // This ensures short phrases get expanded and all items are consistently formatted
  console.log(`LLM: Formatting all ${items.length} items for consistency`);

  // Format short phrases using AI
  const systemPrompt = `You format short phrases into complete, professional sentences for job descriptions.
You maintain the user's core intent and meaning.
You respond with a JSON array of formatted sentences, one per input item.
If an item is already a complete sentence, return it as-is with minor improvements if needed.
If an item is a short phrase, expand it into a complete, professional sentence that matches the job role and tone.`;

  const userPrompt = `Job Title: ${job_title}
Context: ${context || 'None'}
Tone: ${tone}
Seniority: ${seniority}
Type: ${type === 'responsibility' ? 'Key Responsibility' : 'Required Skill'}

Format these ${type}s into complete, professional sentences. Return a JSON object with an "items" array containing the formatted sentences.
Items to format:
${items.map((item, i) => `${i + 1}. ${item}`).join('\n')}

Return JSON object: {"items": ["formatted sentence 1", "formatted sentence 2", ...]}`;

  // Try OpenAI first
  if (openai) {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.5,
      });

      const content = completion.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        // Handle different response formats
        const formatted = parsed.items || parsed.formatted || parsed.results;
        if (Array.isArray(formatted) && formatted.length === items.length) {
          console.log(`LLM: Successfully formatted ${formatted.length} items using OpenAI`);
          return formatted;
        } else {
          console.warn(`LLM: OpenAI returned ${formatted?.length || 0} items, expected ${items.length}`);
        }
      }
    } catch (error) {
      console.error('OpenAI format error:', error);
    }
  }

  // Fallback to Anthropic
  if (anthropic) {
    try {
      const message = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt + '\n\nRespond with valid JSON only, no markdown formatting.',
          },
        ],
      });

      const content = message.content[0];
      if (content.type === 'text') {
        const text = content.text.trim();
        const jsonText = text.replace(/^```json\n?/i, '').replace(/\n?```$/i, '');
        const parsed = JSON.parse(jsonText);
        const formatted = parsed.items || parsed.formatted || parsed.results;
        if (Array.isArray(formatted) && formatted.length === items.length) {
          console.log(`LLM: Successfully formatted ${formatted.length} items using Anthropic`);
          return formatted;
        } else {
          console.warn(`LLM: Anthropic returned ${formatted?.length || 0} items, expected ${items.length}`);
        }
      }
    } catch (error) {
      console.error('Anthropic format error:', error);
    }
  }

  // If AI formatting fails, return original items (better than failing completely)
  console.warn(`LLM: Formatting failed, returning original items`);
  return items;
}

export async function generateJD(params: GenerateJDParams): Promise<JDSections> {
  const { job_title, context, tone, seniority, length, edited_responsibilities, edited_required_skills, edited_preferred_skills } = params;

  // Note: User edits should be pre-formatted before calling this function
  // This function assumes edited_responsibilities and edited_required_skills are already formatted

  const systemPrompt = `You are an expert HR and talent partner at an IT consulting and digital transformation company called Trianz.
You write clear, inclusive, professional job descriptions.
You always produce output in clean JSON that matches the provided schema.
Avoid mentioning salary, internal job codes, or confidential client details.
Use neutral, inclusive language and avoid bias (no gendered terms, no age bias).`;

  let userPrompt = `Job Title: ${job_title}
Context (optional): ${context || 'None provided'}
Tone: ${tone} (one of: standard, executive, technical, client-facing)
Seniority: ${seniority} (junior, mid, senior, lead, director+)
Length: ${length} (short, standard, detailed)`;

  // Include formatted user edits in the prompt
  if (edited_responsibilities && edited_responsibilities.length > 0) {
    userPrompt += `\n\nCRITICAL: The user has manually edited the Key Responsibilities section. You MUST use EXACTLY these responsibilities (already formatted) in your response.
    
User's edited responsibilities (use these EXACTLY):
${edited_responsibilities.map((r, i) => `${i + 1}. ${r}`).join('\n')}`;
  }

  if (edited_required_skills && edited_required_skills.length > 0) {
    userPrompt += `\n\nCRITICAL: The user has manually edited the Required Skills & Qualifications section. You MUST use EXACTLY these skills (already formatted) in your response.
    
User's edited skills (use these EXACTLY):
${edited_required_skills.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
  }

  if (edited_preferred_skills && edited_preferred_skills.length > 0) {
    userPrompt += `\n\nCRITICAL: The user has manually edited the Preferred Skills section. You MUST use EXACTLY these skills (already formatted) in your response.
    
User's edited preferred skills (use these EXACTLY):
${edited_preferred_skills.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
  }

  userPrompt += `\n\nBased on this, generate a complete job description for a consulting / technology environment.`;
  
  if (edited_responsibilities || edited_required_skills || edited_preferred_skills) {
    userPrompt += `\n\nREGENERATION INSTRUCTIONS:
- Key Responsibilities: Use EXACTLY the edited responsibilities provided above. Do not modify, remove, or add to them.
- Required Skills: Use EXACTLY the edited skills provided above. Do not modify, remove, or add to them.
- Preferred Skills: Use EXACTLY the edited preferred skills provided above. Do not modify, remove, or add to them.
- CROSS-SECTION UPDATES: 
  * If responsibilities were edited, you SHOULD update Required Skills to align with the new responsibilities (add/remove/modify skills to match).
  * If skills were edited, you SHOULD update Key Responsibilities to align with the new skills (add/remove/modify responsibilities to match).
  * This ensures consistency between responsibilities and skills.
- Other sections: Generate new content (summary, behavioral competencies, etc.) that aligns with the edited responsibilities/skills.
- DO NOT skip or remove any edited items - use them exactly as provided.`;
  }
  
  userPrompt += `

Important requirements:
- Assume this is for a consulting company like Trianz (client projects, collaboration, delivery).
- Adjust responsibilities and scope to the seniority level.
- Adjust wording and emphasis to the tone.
- For length:
  - short → 3–4 key responsibilities, 4–6 required skills
  - standard → 6–8 key responsibilities, 6–10 required skills
  - detailed → more depth and detail in each section

Always include these sections:
- Job Summary
- Key Responsibilities
- Required Skills & Qualifications
- Preferred Skills
- Behavioral Competencies
- About Trianz (use the exact content provided below)
- Diversity & Inclusion Statement (use the exact content provided below)

CRITICAL: For the "About Trianz" section, you MUST use this EXACT content (do not modify, summarize, or change it):
${ABOUT_TRIANZ_CONTENT}

CRITICAL: For the "Diversity & Inclusion Statement" section, you MUST use this EXACT content (do not modify, summarize, or change it):
${DIVERSITY_INCLUSION_STATEMENT}

Output JSON only, matching this schema exactly:
{
  "job_title": "string",
  "summary": "string",
  "key_responsibilities": ["string", "string"],
  "required_skills": ["string", "string"],
  "preferred_skills": ["string", "string"],
  "behavioral_competencies": ["string", "string"],
  "about_company": "string",
  "diversity_statement": "string"
}`;

  // Try OpenAI first
  if (openai) {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      });

      const content = completion.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        // Force use the exact About Trianz content
        parsed.about_company = ABOUT_TRIANZ_CONTENT;
        // Force use the exact Diversity & Inclusion Statement
        parsed.diversity_statement = DIVERSITY_INCLUSION_STATEMENT;
        return parsed as JDSections;
      }
    } catch (error) {
      console.error('OpenAI error:', error);
      // Fall through to Anthropic
    }
  }

  // Fallback to Anthropic
  if (anthropic) {
    try {
      const message = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt + '\n\nRespond with valid JSON only, no markdown formatting.',
          },
        ],
      });

      const content = message.content[0];
      if (content.type === 'text') {
        const text = content.text.trim();
        // Remove markdown code blocks if present
        const jsonText = text.replace(/^```json\n?/i, '').replace(/\n?```$/i, '');
        const parsed = JSON.parse(jsonText);
        // Force use the exact About Trianz content
        parsed.about_company = ABOUT_TRIANZ_CONTENT;
        // Force use the exact Diversity & Inclusion Statement
        parsed.diversity_statement = DIVERSITY_INCLUSION_STATEMENT;
        return parsed as JDSections;
      }
    } catch (error) {
      console.error('Anthropic error:', error);
    }
  }

  throw new Error('No AI provider available. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY.');
}

export async function autocompleteJobTitle(partialTitle: string): Promise<string> {
  const systemPrompt = `You suggest job title completions and corrections.
You respond with only the suggested completion text, no quotes, no extra text.
If you notice an obvious typo (like "enginner" → "engineer", "direc" → "director"), suggest the corrected completion.
Keep suggestions concise - only the remaining part of the job title.
IMPORTANT: Only return an empty string if the input is a complete, well-known acronym (like "CIO", "CEO", "CTO") with exactly 3 letters.
For partial inputs like "CI", "CD", "SO", etc., suggest meaningful completions.
Examples:
- Input: "software engin" → Output: "eer"
- Input: "senior direc" → Output: "tor"
- Input: "product manag" → Output: "er"
- Input: "cloud architec" → Output: "t"
- Input: "CI" → Output: "O" (for CIO) or "/CD" (for CI/CD)
- Input: "CD" → Output: " Engineer" or similar
- Input: "CIO" → Output: "" (already complete 3-letter acronym)
- Input: "CEO" → Output: "" (already complete 3-letter acronym)`;

  const userPrompt = `Complete or correct this job title: "${partialTitle}"

If this is a complete 3-letter acronym (like "CIO", "CEO", "CTO"), return an empty string.
Otherwise, suggest the remaining part of a common job title, correcting any typos.
Only return the completion text, not the full title.`;

  // Try OpenAI first
  if (openai) {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 20,
        temperature: 0.3,
      });

      const content = completion.choices[0]?.message?.content?.trim();
      if (content) {
        return content.replace(/^["']|["']$/g, '').replace(/\.$/, '');
      }
    } catch (error) {
      console.error('OpenAI job title autocomplete error:', error);
    }
  }

  // Fallback to Anthropic
  if (anthropic) {
    try {
      const message = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 20,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      });

      const content = message.content[0];
      if (content.type === 'text') {
        return content.text.trim().replace(/^["']|["']$/g, '').replace(/\.$/, '');
      }
    } catch (error) {
      console.error('Anthropic job title autocomplete error:', error);
    }
  }

  return '';
}

export async function autocompleteSuggestion(params: AutocompleteRequest): Promise<string> {
  const { field, current_line, job_title, context, tone, seniority } = params;

  const systemPrompt = `You assist with short, natural text completions for job description bullet points.
You respond with only the suggested continuation, no bullet symbols, no quotes, no extra text.
Keep it under 7 words.
Do not start a new sentence.
Do not repeat the existing words that were already typed.
If you notice an obvious typo (like "willings" instead of "willing"), suggest the corrected continuation.
The goal is to help the user complete a single bullet in a job responsibility or skills list.`;

  let userPrompt: string;
  if (field === 'responsibility') {
    userPrompt = `Role: ${job_title}
Context: ${context || 'None'}
Seniority: ${seniority}
Tone: ${tone}

Complete this job responsibility bullet in under 7 more words.
If you notice an obvious typo (like "willings" → "willing", "enginner" → "engineer"), suggest the corrected continuation.
Existing text: ${current_line}

Suggest the next few words to complete this responsibility, correcting any typos if needed.`;
  } else {
    userPrompt = `Role: ${job_title}
Context: ${context || 'None'}
Seniority: ${seniority}
Tone: ${tone}

Suggest a short skill or competency phrase that would naturally complete or extend: ${current_line}.
If you notice an obvious typo, suggest the corrected continuation.
Reply with only the skill phrase, no bullet or punctuation.`;
  }

  // Try OpenAI first
  if (openai) {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 15,
        temperature: 0.7,
      });

      const content = completion.choices[0]?.message?.content?.trim();
      if (content) {
        // Clean up any quotes or punctuation
        return content.replace(/^["']|["']$/g, '').replace(/\.$/, '');
      }
    } catch (error) {
      console.error('OpenAI autocomplete error:', error);
      // Fall through to Anthropic
    }
  }

  // Fallback to Anthropic
  if (anthropic) {
    try {
      const message = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 15,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      });

      const content = message.content[0];
      if (content.type === 'text') {
        const text = content.text.trim();
        return text.replace(/^["']|["']$/g, '').replace(/\.$/, '');
      }
    } catch (error) {
      console.error('Anthropic autocomplete error:', error);
    }
  }

  return '';
}

export async function generateCommsOutput(request: CommsRequest): Promise<CommsSections> {
  const { mode, audience, formality, subject_seed, content, key_dates, actions_required, links, sections, include_deltas } = request;

  const systemPrompt = `You are an executive communications writer for a consulting/technology firm.
You create concise, structured emails/newsletters that are ready to send.
Always return valid JSON with subject, summary, sections array, html_body, text_body.
Do not add trailing colons to headings. Only include sections you can meaningfully populate.`;

  const modeLabel = mode === 'newsletter' ? 'Newsletter' : 'Single Team Update';
  const audienceLabel = audience === 'exec' ? 'CIO/SLT' : audience === 'org' ? 'Org-wide' : 'Team-level';
  const formalityLabel = formality === 'high' ? 'Formal' : formality === 'low' ? 'Casual' : 'Neutral';

  const defaultSections =
    mode === 'newsletter'
      ? ['Top Updates', 'AI/Tech Highlights', 'Company News', 'Risks & Actions', 'Upcoming Dates', 'Resources & Links']
      : ['Context', "What's changing", "Who is impacted", 'When', 'Actions required', 'Contacts'];

  const userPrompt = `Mode: ${modeLabel}
Audience: ${audienceLabel}
Formality: ${formalityLabel}
Subject seed: ${subject_seed || 'None'}
Key dates: ${key_dates || 'None'}
Actions required: ${actions_required || 'None'}
Links/resources: ${links || 'None'}
Include deltas vs last issue: ${include_deltas ? 'Yes' : 'No'}
Requested sections: ${(sections && sections.length > 0 ? sections : defaultSections).join(', ')}

Source content:
${content}

Instructions:
- Produce a concise subject line.
- Write a short exec-ready summary (2-3 sentences).
- Populate the sections with crisp bullets/paragraphs. If you cannot populate a section, omit it rather than leaving it blank.
- Return both HTML (basic tags, no inline CSS) and plain text variants.
- Keep tone aligned to the audience and formality.
- If include deltas is Yes, call out new vs ongoing vs resolved items where possible.`;

  // Try OpenAI first
  if (openai) {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.5,
      });

      const contentStr = completion.choices[0]?.message?.content;
      if (contentStr) {
        const parsed = JSON.parse(contentStr);
        return {
          subject: parsed.subject || subject_seed || '',
          summary: parsed.summary || '',
          sections: parsed.sections || [],
          html_body: parsed.html_body || '',
          text_body: parsed.text_body || '',
        };
      }
    } catch (error) {
      console.error('OpenAI comms error:', error);
    }
  }

  // Fallback to Anthropic
  if (anthropic) {
    try {
      const message = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt + '\n\nRespond with valid JSON only, no markdown formatting.',
          },
        ],
      });

      const contentObj = message.content[0];
      if (contentObj.type === 'text') {
        const text = contentObj.text.trim();
        const jsonText = text.replace(/^```json\n?/i, '').replace(/\n?```$/i, '');
        const parsed = JSON.parse(jsonText);
        return {
          subject: parsed.subject || subject_seed || '',
          summary: parsed.summary || '',
          sections: parsed.sections || [],
          html_body: parsed.html_body || '',
          text_body: parsed.text_body || '',
        };
      }
    } catch (error) {
      console.error('Anthropic comms error:', error);
    }
  }

  throw new Error('No AI provider available. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY.');
}

