import { Slide } from '@/types/pdf-to-ppt';
import OpenAI from 'openai';

const openaiApiKey = process.env.OPENAI_API_KEY;
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

export async function extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/7f74fb16-5e81-4704-9c2c-1a3dd73f3bf3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pdf-processor.ts:3',message:'extractTextFromPdf entry',data:{bufferSize:pdfBuffer.length,bufferStart:Array.from(pdfBuffer.slice(0,20)).map(b=>b.toString(16).padStart(2,'0')).join(' '),isValidPdfHeader:pdfBuffer.slice(0,4).toString()==='%PDF'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  try {
    // Dynamic import to avoid build-time issues with pdf-parse test files
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/7f74fb16-5e81-4704-9c2c-1a3dd73f3bf3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pdf-processor.ts:6',message:'Before dynamic import',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    const pdfParse = (await import('pdf-parse')).default;
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/7f74fb16-5e81-4704-9c2c-1a3dd73f3bf3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pdf-processor.ts:7',message:'After dynamic import',data:{pdfParseExists:!!pdfParse},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/7f74fb16-5e81-4704-9c2c-1a3dd73f3bf3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pdf-processor.ts:8',message:'Before pdfParse call',data:{bufferSize:pdfBuffer.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    const data = await pdfParse(pdfBuffer);
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/7f74fb16-5e81-4704-9c2c-1a3dd73f3bf3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pdf-processor.ts:9',message:'After pdfParse call',data:{textLength:data?.text?.length||0,hasText:!!data?.text,textPreview:data?.text?.substring(0,100)||''},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    return data.text || '';
  } catch (error: any) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/7f74fb16-5e81-4704-9c2c-1a3dd73f3bf3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pdf-processor.ts:10',message:'Error caught',data:{errorMessage:error?.message||'unknown',errorName:error?.name||'unknown',errorStack:error?.stack?.substring(0,200)||'',isEncrypted:error?.message?.toLowerCase().includes('password')||error?.message?.toLowerCase().includes('encrypted')||false,isTestFileError:error?.message?.includes('test')||error?.message?.includes('ENOENT')||false},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,C'})}).catch(()=>{});
    // #endregion
    
    // Handle pdf-parse internal test file access errors
    // pdf-parse sometimes tries to access test files during initialization
    if (error?.message?.includes('ENOENT') && error?.message?.includes('test')) {
      // Retry: re-import and parse (sometimes works after module initialization completes)
      try {
        const pdfParse = (await import('pdf-parse')).default;
        const data = await pdfParse(pdfBuffer);
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/7f74fb16-5e81-4704-9c2c-1a3dd73f3bf3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pdf-processor.ts:34',message:'Retry successful after test file error',data:{textLength:data?.text?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
        // #endregion
        return data.text || '';
      } catch (retryError: any) {
        // If retry also fails, provide helpful error message
        throw new Error(`PDF parsing failed due to library initialization issue. Please try uploading the file again, or ensure the PDF is not corrupted. Original error: ${retryError.message || error.message}`);
      }
    }
    
    // Handle other errors
    const errorMsg = error?.message || 'Unknown error';
    if (errorMsg.toLowerCase().includes('password') || errorMsg.toLowerCase().includes('encrypted')) {
      throw new Error('PDF is password-protected or encrypted. Please provide an unencrypted PDF.');
    }
    
    throw new Error(`Failed to extract text from PDF: ${errorMsg}. Please ensure the file is a valid, unencrypted PDF.`);
  }
}

// Helper functions for content analysis
function isQuote(text: string): boolean {
  return (text.startsWith('"') && text.endsWith('"')) || 
         (text.startsWith("'") && text.endsWith("'")) ||
         text.match(/^["'].*["']$/);
}

function isSectionHeader(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length < 60 && (
    trimmed.endsWith(':') ||
    trimmed === trimmed.toUpperCase() ||
    /^(Chapter|Section|Part|Module)\s+\d+/i.test(trimmed)
  );
}

function extractQuote(text: string): { quote: string; attribution?: string } | null {
  const quoteMatch = text.match(/["']([^"']+)["']\s*(?:[-–—]\s*(.+))?/);
  if (quoteMatch) {
    return {
      quote: quoteMatch[1],
      attribution: quoteMatch[2]?.trim()
    };
  }
  return null;
}

function splitIntoColumns(items: string[]): { left: string[]; right: string[] } {
  const mid = Math.ceil(items.length / 2);
  return {
    left: items.slice(0, mid),
    right: items.slice(mid)
  };
}

export function splitTextIntoSlides(text: string, filename: string): Slide[] {
  if (!text.trim()) {
    throw new Error('PDF appears to be empty or contains no extractable text.');
  }

  const slides: Slide[] = [];
  
  // Clean up the text
  const cleanedText = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Split by double newlines (paragraphs) or page breaks
  const sections = cleanedText.split(/\n\n+/).filter(section => section.trim().length > 0);

  if (sections.length === 0) {
    // Fallback: split by single newlines if no paragraphs found
    const lines = cleanedText.split('\n').filter(line => line.trim().length > 0);
    if (lines.length > 0) {
      createSlidesFromLines(lines, slides, filename);
    }
  } else {
    // Process sections intelligently
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i].trim();
      const lines = section.split('\n').map(line => line.trim()).filter(Boolean);
      
      if (lines.length === 0) continue;

      const firstLine = lines[0];
      const restLines = lines.slice(1);

      // Detect quote slides
      if (isQuote(firstLine) || (restLines.length === 0 && isQuote(section))) {
        const quoteData = extractQuote(section) || { quote: firstLine };
        slides.push({
          title: '',
          content: [],
          type: 'quote',
          quote: quoteData.quote,
          attribution: quoteData.attribution
        });
        continue;
      }

      // Detect section dividers (short headers)
      if (isSectionHeader(firstLine) && restLines.length === 0) {
        slides.push({
          title: firstLine.replace(/:$/, ''),
          content: [],
          type: 'section-divider'
        });
        continue;
      }

      // Title-only slides for very short sections or important headers
      if (restLines.length === 0 && firstLine.length < 80) {
        slides.push({
          title: firstLine,
          content: [],
          type: 'title',
          highlight: firstLine.length < 40
        });
        continue;
      }

      // Two-column layout for longer lists (6+ items)
      if (restLines.length >= 6 && restLines.every(line => line.length < 100)) {
        const columns = splitIntoColumns(restLines);
        slides.push({
          title: firstLine,
          content: restLines,
          type: 'two-column',
          leftContent: columns.left,
          rightContent: columns.right
        });
        continue;
      }

      // Highlight slides for important content (short title, medium content)
      if (firstLine.length < 50 && restLines.length >= 2 && restLines.length <= 5) {
        slides.push({
          title: firstLine,
          content: restLines,
          type: 'highlight',
          highlight: true
        });
        continue;
      }

      // Standard content slide
      slides.push({
        title: firstLine,
        content: restLines.length > 0 ? restLines : [firstLine],
        type: 'content'
      });
    }
  }

  // Ensure we have at least one slide
  if (slides.length === 0) {
    slides.push({
      title: filename.replace(/\.pdf$/i, ''),
      content: [cleanedText.substring(0, 500)],
      type: 'content'
    });
  }

  // Limit to reasonable number of slides (max 50)
  if (slides.length > 50) {
    return slides.slice(0, 50);
  }

  return slides;
}

function createSlidesFromLines(lines: string[], slides: Slide[], filename: string) {
  // Group lines intelligently
  let currentGroup: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Start new group on section headers or after 5 lines
    if (isSectionHeader(line) || (currentGroup.length >= 5 && line.length < 60)) {
      if (currentGroup.length > 0) {
        addGroupAsSlide(currentGroup, slides);
        currentGroup = [];
      }
      if (isSectionHeader(line)) {
        slides.push({
          title: line.replace(/:$/, ''),
          content: [],
          type: 'section-divider'
        });
        continue;
      }
    }
    
    currentGroup.push(line);
  }
  
  // Add remaining group
  if (currentGroup.length > 0) {
    addGroupAsSlide(currentGroup, slides);
  }
}

function addGroupAsSlide(group: string[], slides: Slide[]) {
  if (group.length === 0) return;
  
  const title = group[0];
  const content = group.slice(1);
  
  // Two-column for longer groups
  if (group.length >= 6) {
    const columns = splitIntoColumns(group.slice(1));
    slides.push({
      title,
      content: group.slice(1),
      type: 'two-column',
      leftContent: columns.left,
      rightContent: columns.right
    });
  } else {
    slides.push({
      title,
      content: content.length > 0 ? content : [title],
      type: 'content'
    });
  }
}

// AI-powered slide generation
async function processPdfWithAI(text: string, filename: string): Promise<Slide[]> {
  if (!openai) {
    throw new Error('OpenAI not configured');
  }

  const systemPrompt = `You are an expert presentation designer who creates professional, well-structured PowerPoint presentations from PDF content.

Your goal is to understand the content deeply and create a proper presentation deck (like Gamma presentations) - not just a summary, but a well-organized, engaging deck that tells a story.

Guidelines:
1. Understand the content's meaning, context, and purpose
2. Create professional slide titles that capture key insights
3. Organize content logically with clear sections
4. Use varied slide types appropriately:
   - "title": Title slides or important headers (use highlight: true for emphasis)
   - "content": Standard content slides with bullet points
   - "quote": Inspirational or important quotes
   - "two-column": When you have lists of 6+ items
   - "highlight": Important content that needs emphasis
   - "section-divider": Section headers to break up the presentation
5. Write content that flows naturally - not just extracted text, but rewritten for clarity and impact
6. Create 10-30 slides depending on content length
7. Make each slide focused and scannable

Return a JSON object with a "slides" array. Each slide should have:
- title: string (professional, concise title)
- content: string[] (array of bullet points or content lines)
- type: "title" | "content" | "quote" | "two-column" | "highlight" | "section-divider"
- quote?: string (if type is "quote")
- attribution?: string (if type is "quote")
- leftContent?: string[] (if type is "two-column")
- rightContent?: string[] (if type is "two-column")
- highlight?: boolean (if type is "highlight" or "title")

Example response format:
{
  "slides": [
    {
      "title": "Introduction",
      "content": ["Key point 1", "Key point 2"],
      "type": "content"
    },
    {
      "title": "Key Insights",
      "content": [],
      "type": "section-divider"
    }
  ]
}`;

  const userPrompt = `Create a professional presentation deck from this PDF content:

${text.substring(0, 12000)}${text.length > 12000 ? '\n\n[... content truncated for length ...]' : ''}

Filename: ${filename}

Analyze the content, understand its structure and meaning, then create a well-organized presentation deck with appropriate slide types and professional titles. Write content that flows naturally and tells a story, not just extracted text.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 4000,
    });

    const content = completion.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      const slides = parsed.slides || [];
      
      // Validate and normalize slides
      return slides
        .filter((slide: any) => slide.title || slide.content?.length > 0)
        .map((slide: any) => ({
          title: slide.title || 'Untitled',
          content: slide.content || [],
          type: slide.type || 'content',
          quote: slide.quote,
          attribution: slide.attribution,
          leftContent: slide.leftContent,
          rightContent: slide.rightContent,
          highlight: slide.highlight || false,
        }))
        .slice(0, 50); // Limit to 50 slides max
    }
  } catch (error) {
    console.error('AI slide generation error:', error);
    throw error;
  }

  return [];
}

export async function processPdf(pdfBuffer: Buffer, filename: string, useAI: boolean = true): Promise<Slide[]> {
  const text = await extractTextFromPdf(pdfBuffer);
  
  // Try AI-powered processing first if enabled and API key available
  if (useAI && openai && text.length > 100) {
    try {
      const aiSlides = await processPdfWithAI(text, filename);
      if (aiSlides && aiSlides.length > 0) {
        return aiSlides;
      }
    } catch (error) {
      console.error('AI processing failed, falling back to pattern-based:', error);
      // Fall through to pattern-based processing
    }
  }
  
  // Fallback to pattern-based processing
  return splitTextIntoSlides(text, filename);
}
