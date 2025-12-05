import { NextRequest, NextResponse } from 'next/server';
import { generateJD, formatPhrasesIntoSentences } from '@/lib/ai/llm';
import { supabaseServer } from '@/lib/supabase/server';
import { formatJDText } from '@/lib/utils';
import { GenerateJDRequest } from '@/types/jd';

export async function POST(request: NextRequest) {
  try {
    const body: GenerateJDRequest = await request.json();

    // Validate request body
    if (!body.job_title || !body.tone || !body.seniority || !body.length) {
      return NextResponse.json(
        { error: 'Missing required fields: job_title, tone, seniority, length' },
        { status: 400 }
      );
    }

    // Step 1: Format user edits BEFORE generating JD
    let formattedResponsibilities = body.edited_responsibilities;
    let formattedSkills = body.edited_required_skills;

    if (body.edited_responsibilities && body.edited_responsibilities.length > 0) {
      console.log('API: Formatting user responsibilities...', body.edited_responsibilities.length, 'items');
      console.log('API: Original responsibilities:', body.edited_responsibilities);
      formattedResponsibilities = await formatPhrasesIntoSentences(
        body.edited_responsibilities,
        body.job_title,
        body.context,
        body.tone,
        body.seniority,
        'responsibility'
      );
      console.log('API: Formatted responsibilities:', formattedResponsibilities.length);
      console.log('API: Formatted responsibilities content:', formattedResponsibilities);
    }

    if (body.edited_required_skills && body.edited_required_skills.length > 0) {
      console.log('API: Formatting user skills...', body.edited_required_skills.length, 'items');
      formattedSkills = await formatPhrasesIntoSentences(
        body.edited_required_skills,
        body.job_title,
        body.context,
        body.tone,
        body.seniority,
        'skill'
      );
      console.log('API: Formatted skills:', formattedSkills.length);
    }

    // Step 2: Generate JD using AI (with formatted edits)
    const sections = await generateJD({
      job_title: body.job_title,
      context: body.context,
      tone: body.tone,
      seniority: body.seniority,
      length: body.length,
      edited_responsibilities: formattedResponsibilities,
      edited_required_skills: formattedSkills,
    });

    // Step 3: CRITICAL - Force-replace sections with formatted user edits to ensure they're always included
    // Only force-replace sections that the user actually edited
    // Let AI update the other section for consistency
    if (formattedResponsibilities && formattedResponsibilities.length > 0) {
      console.log('API: Force-replacing responsibilities with formatted user edits');
      console.log('API: Before replace - AI generated:', sections.key_responsibilities.length, 'items');
      console.log('API: Replacing with formatted:', formattedResponsibilities.length, 'items');
      sections.key_responsibilities = formattedResponsibilities;
      console.log('API: After replace - final responsibilities:', sections.key_responsibilities);
      // AI will update skills to align with new responsibilities
    }

    if (formattedSkills && formattedSkills.length > 0) {
      console.log('API: Force-replacing skills with formatted user edits');
      sections.required_skills = formattedSkills;
      // AI will update responsibilities to align with new skills
    }

    // Assemble full text
    const full_text = formatJDText(sections);

    // Save to database
    const { data, error } = await supabaseServer
      .from('jds')
      .insert({
        job_title: body.job_title,
        brief_context: body.context || null,
        tone: body.tone,
        seniority: body.seniority,
        length: body.length,
        sections,
        full_text,
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to save JD to database' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      jd_id: data.id,
      job_title: data.job_title,
      sections: data.sections,
      full_text: data.full_text,
    });
  } catch (error: any) {
    console.error('Generate JD error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate JD' },
      { status: 500 }
    );
  }
}

