import { Slide } from '@/types/pdf-to-ppt';
import OpenAI from 'openai';

const openaiApiKey = process.env.OPENAI_API_KEY;
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

// Cache pdf-parse module to avoid repeated imports and test file access issues
let pdfParseModule: any = null;
let importAttempts = 0;
const MAX_IMPORT_ATTEMPTS = 3;

async function getPdfParse(): Promise<any> {
  if (pdfParseModule) {
    return pdfParseModule;
  }

  for (let i = 0; i < MAX_IMPORT_ATTEMPTS; i++) {
    try {
      // Dynamic import to avoid build-time issues with pdf-parse test files
      const importedModule = await import('pdf-parse');
      pdfParseModule = importedModule.default || importedModule;
      return pdfParseModule;
    } catch (importError: any) {
      const errorMsg = importError?.message || '';
      const isTestFileError = errorMsg.includes('ENOENT') && 
                             (errorMsg.includes('test') || errorMsg.includes('05-versions-space.pdf'));
      
      if (isTestFileError && i < MAX_IMPORT_ATTEMPTS - 1) {
        // Wait longer on each retry
        await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
        continue;
      }
      
      // If it's not a test file error or we've exhausted retries, throw
      throw importError;
    }
  }
  
  throw new Error('Failed to initialize PDF parser after multiple attempts');
}

export async function extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
  try {
    const pdfParse = await getPdfParse();
    const data = await pdfParse(pdfBuffer);
    return data.text || '';
  } catch (error: any) {
    // Handle pdf-parse internal test file access errors
    const errorMsg = error?.message || '';
    const isTestFileError = errorMsg.includes('ENOENT') && 
                           (errorMsg.includes('test') || errorMsg.includes('05-versions-space.pdf'));
    
    if (isTestFileError) {
      // Clear cache and retry once more
      pdfParseModule = null;
      try {
        await new Promise(resolve => setTimeout(resolve, 300));
        const pdfParse = await getPdfParse();
        const data = await pdfParse(pdfBuffer);
        return data.text || '';
      } catch (retryError: any) {
        throw new Error(`PDF parsing failed due to library initialization issue. Please try uploading the file again, or ensure the PDF is not corrupted. Original error: ${retryError.message || error.message}`);
      }
    }
    
    // Handle other errors
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
         /^["'].*["']$/.test(text);
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
async function processPdfWithAI(text: string, filename: string, numSlides?: number): Promise<Slide[]> {
  if (!openai) {
    throw new Error('OpenAI not configured');
  }

  const systemPrompt = `You are an expert presentation designer who creates professional, well-structured PowerPoint presentations from PDF content.

Your goal is to understand the content deeply and create a proper presentation deck (like Gamma presentations) - not just a summary, but a well-organized, engaging deck that tells a story with rich, narrative-driven content.

CRITICAL: Create slides with SUBSTANTIAL content - not just bullet points. Each slide should tell part of a story with detailed explanations, context, and insights. Think like Gamma presentations: rich, narrative-driven content that flows naturally.

Guidelines:
1. Understand the content's meaning, context, and purpose deeply
2. Create professional slide titles that capture key insights
3. Organize content logically with clear sections that build a narrative
4. Use varied slide types appropriately:
   - "title": Title slides or important headers (use highlight: true for emphasis)
   - "content": Rich content slides with detailed bullet points (3-6 substantial points per slide, each 1-2 sentences explaining concepts, not just keywords)
   - "quote": Inspirational or important quotes
   - "two-column": When you have lists of 6+ items
   - "highlight": Important content that needs emphasis
   - "section-divider": Section headers to break up the presentation
5. Write content that flows naturally - not just extracted text, but rewritten for clarity and impact. Each bullet point should be a complete thought (1-2 sentences), not just a keyword or phrase.
6. ${numSlides ? `CRITICAL REQUIREMENT: You MUST generate EXACTLY ${numSlides} slides. This is non-negotiable. Count your slides carefully before responding. The JSON response must contain exactly ${numSlides} slides in the "slides" array. Do not generate ${numSlides + 1} or ${numSlides - 1} slides - it must be exactly ${numSlides}.` : 'Create 15-35 slides depending on content length'} - ensure adequate coverage
7. Make each slide substantial - avoid slides with only 1-2 short bullet points. Aim for 3-6 detailed points per content slide.
8. Transform raw information into engaging narrative - explain concepts, provide context, and connect ideas.

Return a JSON object with a "slides" array. Each slide should have:
- title: string (professional, concise title)
- content: string[] (array of detailed bullet points - each should be 1-2 sentences explaining concepts, not just keywords)
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
      "title": "Introduction to Key Concepts",
      "content": [
        "This presentation explores the fundamental principles that drive modern business transformation, focusing on how organizations adapt to changing market conditions.",
        "We will examine three core areas: strategic planning, operational efficiency, and customer engagement, each critical to long-term success.",
        "The insights presented here are based on extensive research and real-world case studies from leading organizations."
      ],
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
${numSlides ? `\n\n🚨 ABSOLUTE REQUIREMENT: Generate content distributed across EXACTLY ${numSlides} slides. Read the PDF content, understand it, then create ${numSlides} slides with meaningful content. The JSON must have exactly ${numSlides} slides in the array.` : ''}

Analyze the content deeply, understand its structure and meaning, then create a well-organized presentation deck with appropriate slide types and professional titles. 

IMPORTANT: Write rich, narrative-driven content like Gamma presentations:
- Each content slide should have 3-6 substantial bullet points
- Each bullet point should be 1-2 complete sentences explaining concepts, not just keywords
- Transform raw information into engaging narrative with context and explanations
- Ensure slides tell a story and flow naturally from one to the next
- Avoid slides with minimal content - make each slide substantial and informative

Write content that flows naturally and tells a story, not just extracted text or simple bullet points.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: numSlides ? Math.min(4000, numSlides * 150) : 4000,
    });

    const content = completion.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      const slides = parsed.slides || [];
      
      // Validate and normalize slides
      const normalizedSlides = slides
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
        }));
      
      // Strictly enforce slide count if specified - redistribute content intelligently
      if (numSlides) {
        console.log(`[PDF Processor] Requested ${numSlides} slides, AI generated ${normalizedSlides.length} slides`);
        
        // Collect all content from all slides
        const allContentItems: string[] = [];
        const allTitles: string[] = [];
        
        normalizedSlides.forEach((slide: any) => {
          if (slide.content && slide.content.length > 0) {
            allContentItems.push(...slide.content);
            allTitles.push(slide.title);
          } else if (slide.type === 'section-divider' || slide.type === 'title') {
            // Keep section dividers and title slides
            allTitles.push(slide.title);
          }
        });
        
        // Redistribute content into exactly numSlides slides
        const targetSlides: Slide[] = [];
        const itemsPerSlide = Math.ceil(allContentItems.length / numSlides);
        
        let contentIndex = 0;
        for (let i = 0; i < numSlides; i++) {
          const slideContent = allContentItems.slice(contentIndex, contentIndex + itemsPerSlide);
          contentIndex += itemsPerSlide;
          
          // Use original title if available, otherwise generate one
          const slideTitle = allTitles[i] || allTitles[Math.floor(i * (allTitles.length / numSlides))] || `Slide ${i + 1}`;
          
          targetSlides.push({
            title: slideTitle,
            content: slideContent,
            type: 'content',
          });
        }
        
        console.log(`[PDF Processor] Redistributed content into exactly ${targetSlides.length} slides`);
        return targetSlides;
      }
      
      return normalizedSlides.slice(0, 50);
    }
  } catch (error) {
    console.error('AI slide generation error:', error);
    throw error;
  }

  return [];
}

export async function processPdf(pdfBuffer: Buffer, filename: string, useAI: boolean = true, numSlides?: number): Promise<Slide[]> {
  const text = await extractTextFromPdf(pdfBuffer);
  
  // Try AI-powered processing first if enabled and API key available
  if (useAI && openai && text.length > 100) {
    try {
      const aiSlides = await processPdfWithAI(text, filename, numSlides);
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
