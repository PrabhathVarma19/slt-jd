import { Slide, PdfImage } from '@/types/pdf-to-ppt';
import OpenAI from 'openai';
import * as path from 'path';
import { PDFDocument, PDFName } from 'pdf-lib';
import * as fs from 'fs';

const openaiApiKey = process.env.OPENAI_API_KEY;
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

// Cache pdf-parse module to avoid repeated imports and test file access issues
let pdfParseModule: any = null;

async function getPdfParse(): Promise<any> {
  if (pdfParseModule) {
    return pdfParseModule;
  }

  // Try pdf-parse-debugging-disabled first (has debug mode disabled)
  try {
    const moduleName = 'pdf-parse-debugging-disabled';
    const disabledModule = await import(moduleName);
    pdfParseModule = disabledModule.default || disabledModule;
    if (pdfParseModule && typeof pdfParseModule === 'function') {
      console.log('[PDF Parse] Using pdf-parse-debugging-disabled');
      return pdfParseModule;
    }
  } catch (error: any) {
    console.log('[PDF Parse] pdf-parse-debugging-disabled not available, trying pdf-parse');
  }

  // Fallback to regular pdf-parse with enhanced error handling
  try {
    const importedModule = await import('pdf-parse');
    pdfParseModule = importedModule.default || importedModule;
    
    // Try to patch at runtime if postinstall didn't work
    if (pdfParseModule && typeof pdfParseModule === 'function') {
      // Wrap the function to catch initialization errors
      const originalParse = pdfParseModule;
      pdfParseModule = async (buffer: Buffer) => {
        try {
          return await originalParse(buffer);
        } catch (parseError: any) {
          const errorMsg = parseError?.message || '';
          // If it's a test file error, clear cache and retry once
          if (errorMsg.includes('ENOENT') && errorMsg.includes('test')) {
            console.log('[PDF Parse] Test file error detected, retrying...');
            await new Promise(resolve => setTimeout(resolve, 300));
            return await originalParse(buffer);
          }
          throw parseError;
        }
      };
    }
    
    console.log('[PDF Parse] Successfully loaded pdf-parse');
    return pdfParseModule;
  } catch (importError: any) {
    const errorMsg = importError?.message || '';
    console.error('[PDF Parse] Import error:', errorMsg);
    
    // Retry with delay for test file errors
    if (errorMsg.includes('ENOENT') && errorMsg.includes('test')) {
      console.log('[PDF Parse] Retrying after test file error...');
      await new Promise(resolve => setTimeout(resolve, 500));
      try {
        const importedModule = await import('pdf-parse');
        pdfParseModule = importedModule.default || importedModule;
        console.log('[PDF Parse] Successfully loaded pdf-parse on retry');
        return pdfParseModule;
      } catch (retryError: any) {
        console.error('[PDF Parse] Retry failed:', retryError?.message);
        throw new Error(`PDF parsing library failed to initialize: ${retryError?.message || errorMsg}`);
      }
    }
    throw importError;
  }
}

// Fallback text extraction using pdfjs-dist (works in serverless)
async function extractTextWithPdfJs(pdfBuffer: Buffer): Promise<string> {
  try {
    // Use legacy build for Node.js/serverless environments
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf');
    
    // Disable workers for serverless - set to null
    if (typeof window === 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = null as any;
    }
    
    const uint8Array = new Uint8Array(pdfBuffer);
    const loadingTask = pdfjsLib.getDocument({ 
      data: uint8Array,
      disableAutoFetch: true,
      disableStream: true,
      useWorkerFetch: false,
      isEvalSupported: false,
      verbosity: 0,
    });
    
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;
    const allText: string[] = [];
    
    // Extract text from all pages (limit to first 50 for performance)
    for (let pageNum = 1; pageNum <= Math.min(numPages, 50); pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str || '')
          .join(' ')
          .trim();
        
        if (pageText.length > 0) {
          allText.push(`--- Page ${pageNum} ---\n${pageText}`);
        }
      } catch (pageError: any) {
        console.error(`[PDF Extract] Error extracting text from page ${pageNum}:`, pageError.message);
        // Continue with next page
      }
    }
    
    const fullText = allText.join('\n\n');
    if (fullText.trim().length < 50) {
      throw new Error('PDF contains insufficient extractable text');
    }
    
    console.log(`[PDF Extract] Extracted ${fullText.length} characters using pdfjs-dist from ${numPages} pages`);
    return fullText;
  } catch (error: any) {
    console.error('[PDF Extract] pdfjs-dist extraction failed:', error.message);
    throw error;
  }
}

export async function extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
  // Validate PDF buffer first
  if (!pdfBuffer || pdfBuffer.length === 0) {
    throw new Error('Invalid PDF buffer: buffer is empty');
  }
  
  // Check if it's a valid PDF by checking the header
  const pdfHeader = pdfBuffer.slice(0, 4).toString();
  if (pdfHeader !== '%PDF') {
    throw new Error('Invalid PDF file: file does not start with PDF header');
  }

  // Try pdf-parse first (faster and better text extraction)
  try {
    const pdfParse = await getPdfParse();
    const data = await pdfParse(pdfBuffer);
    
    // Log PDF metadata for debugging
    console.log(`[PDF Extract] PDF parsed - pages: ${data?.numpages || 'unknown'}, text length: ${data?.text?.length || 0}`);
    
    if (!data || !data.text) {
      throw new Error('PDF parsing returned empty text');
    }
    
    // Check if text is actually empty or just whitespace
    const trimmedText = data.text.trim();
    if (trimmedText.length === 0) {
      throw new Error('PDF contains no extractable text (likely image-based/scanned PDF)');
    }
    
    return data.text;
  } catch (error: any) {
    const errorMsg = error?.message || '';
    
    // Check if it's a pdf-parse initialization error (common in Vercel/serverless)
    const isInitError = errorMsg.includes('ENOENT') && 
                       (errorMsg.includes('test') || 
                        errorMsg.includes('05-versions-space.pdf') ||
                        errorMsg.includes('./test/data') ||
                        errorMsg.includes('library initialization') ||
                        errorMsg.includes('failed to initialize'));
    
    // If pdf-parse fails due to initialization, use pdfjs-dist fallback
    if (isInitError) {
      console.log('[PDF Extract] pdf-parse failed, falling back to pdfjs-dist...');
      try {
        return await extractTextWithPdfJs(pdfBuffer);
      } catch (fallbackError: any) {
        throw new Error(`PDF text extraction failed: ${fallbackError.message}`);
      }
    }
    
    // Handle other pdf-parse errors
    const isTestFileError = errorMsg.includes('ENOENT') && 
                           (errorMsg.includes('test') || 
                            errorMsg.includes('05-versions-space.pdf') ||
                            errorMsg.includes('./test/data'));
    
    if (isTestFileError) {
      // Clear module cache and retry - sometimes the second attempt works
      pdfParseModule = null;
      try {
        // Wait a bit for any async operations to complete
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const pdfParse = await getPdfParse();
        const data = await pdfParse(pdfBuffer);
        
        if (!data || !data.text) {
          throw new Error('PDF parsing returned empty text on retry');
        }
        
        return data.text;
      } catch (retryError: any) {
        const retryErrorMsg = retryError?.message || '';
        const isStillTestFileError = retryErrorMsg.includes('ENOENT') && 
                                    (retryErrorMsg.includes('test') || 
                                     retryErrorMsg.includes('05-versions-space.pdf'));
        
        if (isStillTestFileError) {
          // Fallback to pdfjs-dist
          console.log('[PDF Extract] pdf-parse retry failed, using pdfjs-dist fallback...');
          try {
            return await extractTextWithPdfJs(pdfBuffer);
          } catch (fallbackError: any) {
            throw new Error(`PDF text extraction failed: ${fallbackError.message}`);
          }
        }
        
        throw retryError;
      }
    }
    
    // Handle other errors (password-protected, etc.)
    if (errorMsg.toLowerCase().includes('password') || errorMsg.toLowerCase().includes('encrypted')) {
      throw new Error('PDF is password-protected or encrypted. Please provide an unencrypted PDF.');
    }
    
    // For any other error, try pdfjs-dist as last resort
    console.log('[PDF Extract] pdf-parse error, trying pdfjs-dist fallback...');
    try {
      return await extractTextWithPdfJs(pdfBuffer);
    } catch (fallbackError: any) {
      throw new Error(`PDF text extraction failed: ${errorMsg}. Fallback also failed: ${fallbackError.message}`);
    }
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
async function processPdfWithAI(text: string, filename: string, numSlides?: number, images?: PdfImage[]): Promise<Slide[]> {
  if (!openai) {
    throw new Error('OpenAI not configured');
  }

  const systemPrompt = `You are an expert presentation designer who creates professional, well-structured PowerPoint presentations from PDF content.

Your goal is to understand the content deeply and create a proper presentation deck (like Gamma presentations) - not just a summary, but a well-organized, engaging deck that tells a story with rich, narrative-driven content.

CRITICAL: Create slides with SUBSTANTIAL content - not just bullet points. Each slide should tell part of a story with detailed explanations, context, and insights. Think like Gamma presentations: rich, narrative-driven content that flows naturally.

${images && images.length > 0 ? `\nIMPORTANT: This PDF contains ${images.length} images extracted from pages ${images.map((img: PdfImage) => img.page).join(', ')}. When creating slides, decide which slides should include images based on content relevance. Include image references in your JSON response using the format: {"images": [{"page": 1, "description": "..."}]} for slides that should display images.` : ''}

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
- images?: number[] (array of image indices, 0-based, for images that match this slide's content)

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
      "type": "content",
      "images": [0]
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
${images && images.length > 0 ? `\n\n📸 IMAGES AVAILABLE: This PDF contains ${images.length} image(s) with the following descriptions. Match these images to slides where they are thematically relevant based on the content:

${images.map((img, idx) => `Image ${idx + 1} (from page ${img.page}): ${img.description || 'No description available'}`).join('\n')}

When creating slides, assign relevant images by including an "images" field in the slide object with the image index (0-based). For example, if Image 0 matches a slide, include: "images": [0]. You can assign multiple images to one slide if relevant, or leave images out if no good match exists. Focus on semantic relevance - match images to slides that discuss related topics, concepts, or themes.` : ''}

Analyze the content deeply, understand its structure and meaning, then create a well-organized presentation deck with appropriate slide types and professional titles. 

IMPORTANT: Write rich, narrative-driven content like Gamma presentations:
- Each content slide should have 3-6 substantial bullet points
- Each bullet point should be 1-2 complete sentences explaining concepts, not just keywords
- Transform raw information into engaging narrative with context and explanations
- Ensure slides tell a story and flow naturally from one to the next
- Avoid slides with minimal content - make each slide substantial and informative
${images && images.length > 0 ? '- Include images on relevant slides where they add value to the content' : ''}

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
      max_tokens: numSlides ? Math.max(4000, Math.min(16000, numSlides * 200)) : 4000,
    });

    const content = completion.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      const slides = parsed.slides || [];
      
      // Validate and normalize slides
      const normalizedSlides = slides
        .filter((slide: any) => slide.title || slide.content?.length > 0)
        .map((slide: any, index: number) => {
          // Match images to slides based on AI's image references (indices or page numbers)
          let slideImages: PdfImage[] | undefined = undefined;
          if (images && images.length > 0 && slide.images !== undefined) {
            // AI specified which images to include (can be indices or page numbers)
            const imageRefs = Array.isArray(slide.images) ? slide.images : [slide.images];
            const matchedImages = imageRefs
              .map((ref: any) => {
                // Handle both index-based (0-based) and page-based references
                if (typeof ref === 'number') {
                  // If it's a number, treat as index first, then fallback to page number
                  if (ref >= 0 && ref < images.length) {
                    return images[ref];
                  }
                  // Try as page number
                  return images.find((img: PdfImage) => img.page === ref);
                } else if (ref && typeof ref === 'object') {
                  // Object with page or index property
                  const pageNum = ref.page || ref.pageNumber;
                  const idx = ref.index !== undefined ? ref.index : undefined;
                  if (idx !== undefined && idx >= 0 && idx < images.length) {
                    return images[idx];
                  }
                  if (pageNum !== undefined) {
                    return images.find((img: PdfImage) => img.page === pageNum);
                  }
                }
                return undefined;
              })
              .filter((img: PdfImage | undefined): img is PdfImage => img !== undefined);
            
            if (matchedImages.length > 0) {
              slideImages = matchedImages;
              console.log(`[PDF Processor] AI matched ${matchedImages.length} image(s) to slide ${index + 1}: "${slide.title}"`);
              matchedImages.forEach((img: PdfImage, imgIdx: number) => {
                console.log(`[PDF Processor]   - Image ${imgIdx + 1}: ${img.description?.substring(0, 60) || 'No description'}...`);
              });
            }
          }
          
          // If AI didn't assign images but we have images, auto-assign based on slide index
          if (!slideImages && images && images.length > 0) {
            // Distribute images evenly across slides
            const imagesPerSlide = Math.ceil(images.length / slides.length);
            const startIdx = index * imagesPerSlide;
            const endIdx = Math.min(startIdx + imagesPerSlide, images.length);
            if (startIdx < images.length) {
              slideImages = images.slice(startIdx, endIdx);
              console.log(`[PDF Processor] Auto-assigned ${slideImages.length} images to slide ${index + 1}: "${slide.title}"`);
            }
          }
          
          return {
            title: slide.title || 'Untitled',
            content: slide.content || [],
            type: slide.type || 'content',
            quote: slide.quote,
            attribution: slide.attribution,
            leftContent: slide.leftContent,
            rightContent: slide.rightContent,
            highlight: slide.highlight || false,
            images: slideImages,
          };
        });
      
      const totalImagesAssigned = normalizedSlides.reduce((sum: number, slide: Slide) => sum + (slide.images?.length || 0), 0);
      console.log(`[PDF Processor] Total images assigned to ${normalizedSlides.length} slides: ${totalImagesAssigned}`);
      
      // Strictly enforce slide count if specified - redistribute content intelligently
      if (numSlides) {
        console.log(`[PDF Processor] Requested ${numSlides} slides, AI generated ${normalizedSlides.length} slides`);
        
        // Collect all content from all slides, preserving images
        const allContentItems: string[] = [];
        const allTitles: string[] = [];
        const allImages: PdfImage[][] = []; // Track images per slide
        
        normalizedSlides.forEach((slide: any) => {
          if (slide.content && slide.content.length > 0) {
            allContentItems.push(...slide.content);
            allTitles.push(slide.title);
            allImages.push(slide.images || []); // Preserve images from normalized slides
          } else if (slide.type === 'section-divider' || slide.type === 'title') {
            // Keep section dividers and title slides
            allTitles.push(slide.title);
            allImages.push(slide.images || []); // Preserve images even for section dividers
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
          
          // Collect images for this slide - distribute evenly across all slides
          let slideImages: PdfImage[] = [];
          
          // Distribute images evenly across slides
          if (images && images.length > 0) {
            // Calculate which images should go to this slide
            const imagesPerSlide = Math.max(1, Math.ceil(images.length / numSlides));
            const startIdx = i * imagesPerSlide;
            const endIdx = Math.min(startIdx + imagesPerSlide, images.length);
            if (startIdx < images.length) {
              slideImages = images.slice(startIdx, endIdx);
              console.log(`[PDF Processor] Assigned ${slideImages.length} images to redistributed slide ${i + 1}: "${slideTitle}" (images ${startIdx + 1}-${endIdx} of ${images.length})`);
            }
          }
          
          targetSlides.push({
            title: slideTitle,
            content: slideContent,
            type: 'content',
            images: slideImages.length > 0 ? slideImages : undefined,
          });
        }
        
        console.log(`[PDF Processor] Redistributed content into exactly ${targetSlides.length} slides`);
        const totalImagesInSlides = targetSlides.reduce((sum, slide) => sum + (slide.images?.length || 0), 0);
        console.log(`[PDF Processor] Total images included in slides: ${totalImagesInSlides}`);
        
        // Log image assignment for each slide
        targetSlides.forEach((slide, idx) => {
          if (slide.images && slide.images.length > 0) {
            console.log(`[PDF Processor] Slide ${idx + 1} "${slide.title}" has ${slide.images.length} image(s)`);
          }
        });
        
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

// Extract title from PDF metadata and content
export async function extractTitleFromPdf(pdfBuffer: Buffer, filename: string): Promise<string> {
  try {
    // Try to get title from PDF metadata using pdf-lib
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const title = pdfDoc.getTitle();
    
    if (title && title.trim().length > 0 && title.trim().length < 100) {
      console.log(`[Title Extract] Found PDF metadata title: ${title}`);
      return title.trim();
    }
  } catch (error) {
    console.log('[Title Extract] Could not extract metadata title, trying content extraction');
  }
  
    // Fallback: Extract from first few pages of content
    try {
      const pdfParse = await getPdfParse();
      const data = await pdfParse(pdfBuffer);
      
      if (data && data.text) {
        const lines = data.text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
      
        // Look for title-like lines in first 20 lines
        for (let i = 0; i < Math.min(20, lines.length); i++) {
          const line = lines[i];
          // Title characteristics: short (<60 chars), prominent position, might be all caps or title case
          if (line.length > 10 && line.length < 60 && 
              (line === line.toUpperCase() || /^[A-Z][a-z]+/.test(line)) &&
              !line.includes('http') && !line.match(/^\d+$/)) {
            console.log(`[Title Extract] Found title from content: ${line}`);
            return line;
          }
        }
        
        // If no title found, use first substantial line
        const firstLine = lines.find((l: string) => l.length > 10 && l.length < 100);
        if (firstLine) {
          console.log(`[Title Extract] Using first substantial line as title: ${firstLine}`);
          return firstLine.substring(0, 60); // Limit length
        }
      }
    } catch (error: any) {
      const errorMsg = error?.message || '';
      const isInitError = errorMsg.includes('ENOENT') && 
                         (errorMsg.includes('test') || 
                          errorMsg.includes('05-versions-space.pdf') ||
                          errorMsg.includes('./test/data') ||
                          errorMsg.includes('library initialization') ||
                          errorMsg.includes('failed to initialize'));
      
      // If pdf-parse fails, try pdfjs-dist fallback
      if (isInitError) {
        console.log('[Title Extract] pdf-parse failed, trying pdfjs-dist fallback...');
        try {
          const text = await extractTextWithPdfJs(pdfBuffer);
          const lines = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
          
          // Look for title-like lines in first 20 lines
          for (let i = 0; i < Math.min(20, lines.length); i++) {
            const line = lines[i];
            if (line.length > 10 && line.length < 60 && 
                (line === line.toUpperCase() || /^[A-Z][a-z]+/.test(line)) &&
                !line.includes('http') && !line.match(/^\d+$/)) {
              console.log(`[Title Extract] Found title from content (pdfjs-dist): ${line}`);
              return line;
            }
          }
          
          // If no title found, use first substantial line
          const firstLine = lines.find((l: string) => l.length > 10 && l.length < 100);
          if (firstLine) {
            console.log(`[Title Extract] Using first substantial line as title (pdfjs-dist): ${firstLine}`);
            return firstLine.substring(0, 60);
          }
        } catch (fallbackError: any) {
          console.log('[Title Extract] pdfjs-dist fallback also failed, using filename');
        }
      } else {
        console.log('[Title Extract] Could not extract title from content');
      }
    }
    
    // Final fallback: filename without extension
    const titleFromFilename = filename.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');
    console.log(`[Title Extract] Using filename as title: ${titleFromFilename}`);
    return titleFromFilename;
}

// Extract text from scanned PDF using OCR
async function extractTextWithOCR(pdfBuffer: Buffer): Promise<string> {
  try {
    // Dynamic import to avoid build-time issues
    const { createWorker } = await import('tesseract.js');
    const pdfjsLib = await import('pdfjs-dist');
    
    // Set worker source for Node.js
    // pdfjs-dist requires a workerSrc - use minimal data URI worker for server-side
    if (typeof window === 'undefined') {
      const minimalWorkerCode = 'self.onmessage = function() {};';
      const workerDataUri = `data:application/javascript;base64,${Buffer.from(minimalWorkerCode).toString('base64')}`;
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerDataUri;
    }
    
    // Load PDF with pdfjs-dist - convert Buffer to Uint8Array
    // Use server-side optimized options
    const uint8Array = new Uint8Array(pdfBuffer);
    const loadingTask = pdfjsLib.getDocument({ 
      data: uint8Array,
      disableAutoFetch: true,
      disableStream: true,
      useWorkerFetch: false,
      isEvalSupported: false,
    });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;
    
    console.log(`[OCR] Processing ${numPages} pages with OCR...`);
    
    // Try to load canvas - required for OCR
    let createCanvasFn: any = null;
    try {
      // Use require with try-catch to avoid webpack bundling
      const canvasModule = eval('require')('canvas');
      createCanvasFn = canvasModule.createCanvas;
      if (!createCanvasFn) {
        throw new Error('Canvas module not available');
      }
    } catch (canvasError: any) {
      console.log('[OCR] Canvas not available - OCR requires canvas library.');
      throw new Error('OCR requires the canvas library which is not available. For scanned PDFs, please install canvas (npm install canvas) or use a PDF with extractable text.');
    }
    
    // Create OCR worker
    const worker = await createWorker('eng');
    
    const allText: string[] = [];
    
    // Process each page (limit to first 10 pages for performance)
    for (let pageNum = 1; pageNum <= Math.min(numPages, 10); pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR
        
        // Use canvas to render page
        const canvas = createCanvasFn(viewport.width, viewport.height);
        const context = canvas.getContext('2d');
        
        const renderContext = {
          canvasContext: context as any,
          viewport: viewport,
        };
        
        await page.render(renderContext).promise;
        const imageBuffer = canvas.toBuffer('image/png');
        
        // Run OCR on the image
        const { data: { text } } = await worker.recognize(imageBuffer);
        
        if (text && text.trim().length > 0) {
          allText.push(`--- Page ${pageNum} ---\n${text.trim()}`);
        }
        
        console.log(`[OCR] Page ${pageNum}/${numPages}: Extracted ${text.trim().length} characters`);
      } catch (pageError: any) {
        console.error(`[OCR] Error processing page ${pageNum}:`, pageError.message);
        // Continue with next page
      }
    }
    
    await worker.terminate();
    
    const fullText = allText.join('\n\n');
    console.log(`[OCR] Total extracted text: ${fullText.length} characters from ${allText.length} pages`);
    
    if (fullText.trim().length < 50) {
      throw new Error('OCR extracted insufficient text from scanned PDF');
    }
    
    return fullText;
  } catch (error: any) {
    console.error('[OCR] Error:', error);
    if (error.message && (error.message.includes('canvas') || error.code === 'MODULE_NOT_FOUND')) {
      throw new Error('OCR requires the canvas library which is not available. For scanned PDFs, please install canvas (npm install canvas) or use a PDF with extractable text.');
    }
    throw new Error(`OCR processing failed: ${error.message || 'Unknown error'}`);
  }
}

export async function processPdf(pdfBuffer: Buffer, filename: string, useAI: boolean = true, numSlides?: number): Promise<Slide[]> {
  let text: string;
  let isScannedPdf = false;
  
  // Extract images from PDF (for text-based PDFs with embedded images)
  const extractedImages: PdfImage[] = [];
  try {
    const images = await extractImagesFromPdf(pdfBuffer);
    extractedImages.push(...images);
    console.log(`[PDF Processor] Extracted ${extractedImages.length} images from PDF`);
  } catch (error) {
    console.log('[PDF Processor] Image extraction failed, continuing without images:', error);
    // Continue without images - not critical
  }
  
  try {
    text = await extractTextFromPdf(pdfBuffer);
  } catch (error: any) {
    // If extraction fails with empty text error, try OCR
    if (error.message && (error.message.includes('empty') || error.message.includes('no extractable text'))) {
      console.log('[PDF Processor] Text extraction failed, attempting OCR for scanned PDF...');
      try {
        text = await extractTextWithOCR(pdfBuffer);
        isScannedPdf = true;
        console.log(`[PDF Processor] OCR extracted ${text.length} characters`);
      } catch (ocrError: any) {
        throw new Error(`This PDF appears to be image-based (scanned) but OCR extraction failed: ${ocrError.message}. Please ensure the PDF contains readable text.`);
      }
    } else {
      throw error;
    }
  }
  
  // Log extracted text length for debugging
  console.log(`[PDF Processor] Extracted ${text.length} characters from PDF${isScannedPdf ? ' (via OCR)' : ''}`);
  
  // Check if text is too short
  if (!text || text.trim().length < 50) {
    // Try OCR if we haven't already
    if (!isScannedPdf) {
      console.log('[PDF Processor] Text too short, attempting OCR...');
      try {
        text = await extractTextWithOCR(pdfBuffer);
        isScannedPdf = true;
        console.log(`[PDF Processor] OCR extracted ${text.length} characters`);
      } catch (ocrError: any) {
        throw new Error(`This PDF appears to be image-based (scanned) but OCR extraction failed: ${ocrError.message}. Please ensure the PDF contains readable text.`);
      }
    } else {
      throw new Error('This PDF appears to be image-based (scanned) and OCR extracted insufficient text. Please ensure the PDF contains readable text.');
    }
  }
  
  // Try AI-powered processing first if enabled and API key available
  if (useAI && openai && text.length > 100) {
    try {
      const aiSlides = await processPdfWithAI(text, filename, numSlides, extractedImages.length > 0 ? extractedImages : undefined);
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

// Extract images from PDF using pdf-lib's page resources
// Analyze image using OpenAI vision API to get description
async function analyzeImageWithVision(imageData: string): Promise<string> {
  if (!openai) {
    console.log('[Image Analysis] OpenAI not available, skipping image analysis');
    return '';
  }

  try {
    // Extract base64 data from data URI if needed
    let base64Data = imageData;
    if (imageData.startsWith('data:')) {
      const match = imageData.match(/base64,(.+)/);
      base64Data = match ? match[1] : imageData;
    }

    console.log('[Image Analysis] Analyzing image with OpenAI vision...');
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Describe what is in this image in detail. What objects, scenes, concepts, or subjects are shown? Be specific and detailed. This description will be used to match the image to relevant presentation slide content.',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${base64Data}`,
                detail: 'low', // Use low detail to save tokens
              },
            },
          ],
        },
      ],
      max_tokens: 150,
    });

    const description = response.choices[0]?.message?.content || '';
    console.log(`[Image Analysis] Generated description: ${description.substring(0, 100)}...`);
    return description.trim();
  } catch (error: any) {
    console.error('[Image Analysis] Error analyzing image:', error.message);
    // Return empty string on error - don't block processing
    return '';
  }
}

export async function extractImagesFromPdf(pdfBuffer: Buffer): Promise<PdfImage[]> {
  const images: PdfImage[] = [];
  
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();
    const context = (pdfDoc as any).context;
    
    console.log(`[Image Extract] Processing ${pages.length} pages for images using pdf-lib...`);
    
    // Also check root/catalog resources (images might be shared)
    try {
      const catalog = (pdfDoc as any).catalog;
      const rootResources = catalog?.Resources?.();
      if (rootResources) {
        console.log(`[Image Extract] Checking root/catalog resources...`);
        const rootXObjects = rootResources.get('XObject');
        if (rootXObjects) {
          console.log(`[Image Extract] Found XObjects in root resources!`);
          // Process root XObjects
          const rootKeys = rootXObjects.keys ? rootXObjects.keys() : Object.keys(rootXObjects.dict || rootXObjects);
          console.log(`[Image Extract] Root XObjects count: ${rootKeys.length}`);
        }
      }
    } catch (rootError: any) {
      console.log(`[Image Extract] Could not access root resources: ${rootError.message}`);
    }
    
    // Process each page to find images in XObject resources
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      const page = pages[pageIndex];
      const pageNode = (page as any).node;
      
      try {
        console.log(`[Image Extract] Processing page ${pageIndex + 1}...`);
        
        // Access page resources
        const resources = pageNode.Resources();
        if (!resources) {
          console.log(`[Image Extract] Page ${pageIndex + 1}: No resources found`);
          continue;
        }
        
        console.log(`[Image Extract] Page ${pageIndex + 1}: Found resources`);
        
        // Debug: List all resource keys
        try {
          const resourceKeys = resources.keys ? resources.keys() : Object.keys(resources.dict || resources);
          console.log(`[Image Extract] Page ${pageIndex + 1}: Resource keys: ${JSON.stringify(resourceKeys)}`);
        } catch (keysError) {
          console.log(`[Image Extract] Page ${pageIndex + 1}: Could not list resource keys`);
        }
        
        // Get XObject dictionary (contains images)
        // pdf-lib uses encoded names, so we need to access it properly
        let xObjectsDict = null;
        try {
          // Method 1: Try direct get with encoded name
          xObjectsDict = resources.get('XObject');
        } catch {
          try {
            // Method 2: Try accessing via dict
            const dict = resources.dict || resources;
            xObjectsDict = dict.get('XObject');
          } catch {
            try {
              // Method 3: Try PDFName lookup
              const PDFName = (pdfDoc as any).context.obj('PDFName');
              const xObjectName = PDFName.of('XObject');
              xObjectsDict = resources.get(xObjectName);
            } catch {}
          }
        }
        
        // If still not found, try accessing the dict directly
        if (!xObjectsDict) {
          try {
            const dict = (resources as any).dict;
            if (dict) {
              // Try to find XObject key in dict
              for (const [key, value] of dict.entries ? dict.entries() : Object.entries(dict)) {
                const keyName = key?.encodedName || key?.toString() || key;
                if (keyName === '/XObject' || keyName === 'XObject') {
                  xObjectsDict = value;
                  console.log(`[Image Extract] Page ${pageIndex + 1}: Found XObject via dict iteration`);
                  break;
                }
              }
            }
          } catch (dictError: any) {
            console.log(`[Image Extract] Page ${pageIndex + 1}: Error accessing dict: ${dictError.message}`);
          }
        }
        
        if (!xObjectsDict) {
          console.log(`[Image Extract] Page ${pageIndex + 1}: No XObject dictionary found after all attempts`);
          continue;
        }
        
        console.log(`[Image Extract] Page ${pageIndex + 1}: Found XObject dictionary!`);
        
        console.log(`[Image Extract] Page ${pageIndex + 1}: Found XObject dictionary`);
        
        // Try different ways to iterate XObjects
        let xObjectKeys: string[] = [];
        try {
          // Method 1: Try keys() method
          if (typeof xObjectsDict.keys === 'function') {
            xObjectKeys = xObjectsDict.keys();
          } else if (xObjectsDict.dict && typeof xObjectsDict.dict.keys === 'function') {
            xObjectKeys = xObjectsDict.dict.keys();
          } else if (xObjectsDict.entries) {
            // Method 2: Try entries() and get keys
            xObjectKeys = Array.from(xObjectsDict.entries().keys());
          } else {
            // Method 3: Try to access as object
            xObjectKeys = Object.keys(xObjectsDict.dict || xObjectsDict);
          }
        } catch (keysError: any) {
          console.log(`[Image Extract] Page ${pageIndex + 1}: Error getting XObject keys: ${keysError.message}`);
          // Try accessing dict directly
          try {
            const dict = (xObjectsDict as any).dict || xObjectsDict;
            xObjectKeys = Object.keys(dict);
          } catch {
            console.log(`[Image Extract] Page ${pageIndex + 1}: Could not enumerate XObject keys`);
            continue;
          }
        }
        
        console.log(`[Image Extract] Page ${pageIndex + 1}: Found ${xObjectKeys.length} XObjects`);
        
        // Iterate through XObjects
        for (let i = 0; i < xObjectKeys.length; i++) {
          const key = xObjectKeys[i];
          
            try {
            const xObjectRef = xObjectsDict.get(key);
            if (!xObjectRef) {
              console.log(`[Image Extract] Page ${pageIndex + 1}: XObject ${key} has no reference`);
              continue;
            }
            
            console.log(`[Image Extract] Page ${pageIndex + 1}: Processing XObject ${key}...`);
            
            // Lookup the XObject - need to dereference if it's a PDFRef
            let xObject: any = null;
            let xObjectDict: any = null;
            
            try {
              xObject = context.lookup(xObjectRef);
              
              // Debug: Log what we got
              console.log(`[Image Extract] Page ${pageIndex + 1}: Lookup returned type: ${typeof xObject}, constructor: ${xObject?.constructor?.name}`);
              
              // Try to get the dict from the object
              if (xObject) {
                // Method 1: Try .dict property
                if (xObject.dict) {
                  xObjectDict = xObject.dict;
                }
                // Method 2: Try .get() if it's a PDFDict
                else if (typeof xObject.get === 'function') {
                  xObjectDict = xObject;
                }
                // Method 3: Try accessing as PDFStream
                else if (xObject.contents !== undefined || xObject.dict) {
                  xObjectDict = xObject.dict || xObject;
                }
                // Method 4: It might already be the dict
                else {
                  xObjectDict = xObject;
                }
              }
            } catch (lookupError: any) {
              console.log(`[Image Extract] Page ${pageIndex + 1}: Lookup error for ${key}: ${lookupError.message}`);
              continue;
            }
            
            if (!xObjectDict) {
              console.log(`[Image Extract] Page ${pageIndex + 1}: Could not get dict for XObject ${key}`);
              continue;
            }
            
            // Access properties - try multiple methods
            let subtype: any = null;
            let width = 0;
            let height = 0;
            let filter: any = null;
            
            try {
              // Try different access methods
              if (typeof xObjectDict.get === 'function') {
                // Method 1: Use .get() method
                subtype = xObjectDict.get('Subtype') || xObjectDict.get(PDFName?.of('Subtype'));
                width = xObjectDict.get('Width')?.valueOf() || xObjectDict.get(PDFName?.of('Width'))?.valueOf() || 0;
                height = xObjectDict.get('Height')?.valueOf() || xObjectDict.get(PDFName?.of('Height'))?.valueOf() || 0;
                filter = xObjectDict.get('Filter') || xObjectDict.get(PDFName?.of('Filter'));
              } else {
                // Method 2: Direct property access
                subtype = xObjectDict.Subtype || (xObjectDict as any)['Subtype'];
                width = (xObjectDict.Width?.valueOf?.() || (xObjectDict as any)['Width']?.valueOf?.() || xObjectDict.Width || 0);
                height = (xObjectDict.Height?.valueOf?.() || (xObjectDict as any)['Height']?.valueOf?.() || xObjectDict.Height || 0);
                filter = xObjectDict.Filter || (xObjectDict as any)['Filter'];
              }
              
              // Debug: Log what we found
              console.log(`[Image Extract] Page ${pageIndex + 1}: XObject ${key} - subtype type: ${typeof subtype}, value: ${JSON.stringify(subtype)}`);
              
            } catch (propError: any) {
              console.log(`[Image Extract] Page ${pageIndex + 1}: Error accessing XObject ${key} properties: ${propError.message}`);
              continue;
            }
            
            // Extract subtype name - handle PDFName objects
            let subtypeName = '';
            if (subtype) {
              if (subtype.name) {
                subtypeName = subtype.name;
              } else if (subtype.encodedName) {
                subtypeName = subtype.encodedName;
              } else if (typeof subtype === 'string') {
                subtypeName = subtype;
              } else if (subtype.toString) {
                subtypeName = subtype.toString();
              }
            }
            
            console.log(`[Image Extract] Page ${pageIndex + 1}: XObject ${key} subtype: "${subtypeName}", width: ${width}, height: ${height}`);
            
            if (subtype && (subtypeName === 'Image' || subtypeName === '/Image')) {
              console.log(`[Image Extract] Page ${pageIndex + 1}: Found image ${key}: ${width}x${height}`);
              
              if (width > 0 && height > 0) {
                // xObject is already the PDFRawStream, access its contents directly
                let streamContents: any = null;
                
                // Debug: Log available properties/methods on xObject
                const availableMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(xObject)).filter(
                  name => typeof (xObject as any)[name] === 'function' && name !== 'constructor'
                );
                const availableProps = Object.keys(xObject).filter(
                  name => !name.startsWith('_') && typeof (xObject as any)[name] !== 'function'
                );
                console.log(`[Image Extract] Page ${pageIndex + 1}: xObject methods: ${availableMethods.slice(0, 10).join(', ')}`);
                console.log(`[Image Extract] Page ${pageIndex + 1}: xObject properties: ${availableProps.slice(0, 10).join(', ')}`);
                
                try {
                  // Try multiple methods to get stream contents from PDFRawStream
                  // Method 1: getContents() method
                  if (typeof (xObject as any).getContents === 'function') {
                    streamContents = (xObject as any).getContents();
                    console.log(`[Image Extract] Page ${pageIndex + 1}: Got contents via getContents(), length: ${streamContents?.length || 0}`);
                  }
                  
                  // Method 2: contents property
                  if (!streamContents && (xObject as any).contents !== undefined) {
                    streamContents = (xObject as any).contents;
                    console.log(`[Image Extract] Page ${pageIndex + 1}: Got contents via .contents property, length: ${streamContents?.length || 0}`);
                  }
                  
                  // Method 3: decode() method
                  if (!streamContents && typeof (xObject as any).decode === 'function') {
                    streamContents = (xObject as any).decode();
                    console.log(`[Image Extract] Page ${pageIndex + 1}: Got contents via decode(), length: ${streamContents?.length || 0}`);
                  }
                  
                  // Method 4: dict.contents (internal structure)
                  if (!streamContents && (xObject as any).dict?.contents !== undefined) {
                    streamContents = (xObject as any).dict.contents;
                    console.log(`[Image Extract] Page ${pageIndex + 1}: Got contents via .dict.contents, length: ${streamContents?.length || 0}`);
                  }
                  
                  // Method 5: bytes property
                  if (!streamContents && (xObject as any).bytes !== undefined) {
                    streamContents = (xObject as any).bytes;
                    console.log(`[Image Extract] Page ${pageIndex + 1}: Got contents via .bytes property, length: ${streamContents?.length || 0}`);
                  }
                  
                  // Method 6: data property
                  if (!streamContents && (xObject as any).data !== undefined) {
                    streamContents = (xObject as any).data;
                    console.log(`[Image Extract] Page ${pageIndex + 1}: Got contents via .data property, length: ${streamContents?.length || 0}`);
                  }
                  
                  // Method 7: Try accessing via context decodeStream
                  if (!streamContents && context && typeof (context as any).decodeStream === 'function') {
                    try {
                      streamContents = (context as any).decodeStream(xObject);
                      console.log(`[Image Extract] Page ${pageIndex + 1}: Got contents via context.decodeStream(), length: ${streamContents?.length || 0}`);
                    } catch (decodeError: any) {
                      console.log(`[Image Extract] Page ${pageIndex + 1}: context.decodeStream() failed: ${decodeError.message}`);
                    }
                  }
                  
                } catch (streamError: any) {
                  console.log(`[Image Extract] Page ${pageIndex + 1}: Error accessing stream contents: ${streamError.message}`);
                  console.log(`[Image Extract] Page ${pageIndex + 1}: Error stack: ${streamError.stack}`);
                }
                
                if (streamContents) {
                  // Determine format based on filter
                  let format = 'image/png';
                  if (filter) {
                    const filterName = Array.isArray(filter) 
                      ? filter[0]?.name || filter[0]?.encodedName || filter[0]?.toString()
                      : filter?.name || filter?.encodedName || filter?.toString();
                    console.log(`[Image Extract] Page ${pageIndex + 1}: Filter: ${filterName}`);
                    if (filterName === 'DCTDecode' || filterName === 'DCT' || filterName === '/DCTDecode' || filterName === '/DCT') {
                      format = 'image/jpeg';
                    } else if (filterName === 'FlateDecode' || filterName === '/FlateDecode') {
                      format = 'image/png'; // FlateDecode is often PNG
                    }
                  }
                  
                  // Convert to Buffer if needed
                  let imageBuffer: Buffer;
                  if (Buffer.isBuffer(streamContents)) {
                    imageBuffer = streamContents;
                  } else if (streamContents instanceof Uint8Array) {
                    imageBuffer = Buffer.from(streamContents);
                  } else if (typeof streamContents === 'string') {
                    imageBuffer = Buffer.from(streamContents, 'binary');
                  } else {
                    imageBuffer = Buffer.from(streamContents);
                  }
                  
                  const base64Data = imageBuffer.toString('base64');
                  
                  images.push({
                    data: `data:${format};base64,${base64Data}`,
                    page: pageIndex + 1,
                    width: width,
                    height: height,
                    description: `Image from page ${pageIndex + 1}`,
                  });
                  
                  console.log(`[Image Extract] ✓ Extracted image from page ${pageIndex + 1}: ${width}x${height}, format: ${format}, size: ${imageBuffer.length} bytes, key: ${key}`);
                } else {
                  console.log(`[Image Extract] Page ${pageIndex + 1}: Image ${key} has no stream contents (tried all methods)`);
                }
              } else {
                console.log(`[Image Extract] Page ${pageIndex + 1}: Image ${key} invalid dimensions (${width}x${height})`);
              }
            } else {
              console.log(`[Image Extract] Page ${pageIndex + 1}: XObject ${key} is not an image (subtype: ${subtypeName})`);
            }
          } catch (xObjError: any) {
            console.log(`[Image Extract] Error processing XObject ${key} on page ${pageIndex + 1}: ${xObjError.message}`);
            console.log(`[Image Extract] Error stack: ${xObjError.stack}`);
          }
        }
      } catch (pageError: any) {
        console.log(`[Image Extract] Error processing page ${pageIndex + 1}: ${pageError.message}`);
        console.log(`[Image Extract] Error stack: ${pageError.stack}`);
      }
    }
    
    console.log(`[Image Extract] Extracted ${images.length} images from PDF using pdf-lib`);
    
    // Analyze images with vision API to get descriptions
    if (images.length > 0 && openai) {
      console.log(`[Image Extract] Analyzing ${images.length} images with OpenAI vision...`);
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const description = await analyzeImageWithVision(image.data);
        if (description) {
          images[i].description = description;
          console.log(`[Image Extract] Image ${i + 1}/${images.length} analyzed: ${description.substring(0, 80)}...`);
        }
        // Small delay to avoid rate limits
        if (i < images.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      console.log(`[Image Extract] Completed analysis of ${images.length} images`);
    }
    
    return images;
  } catch (error: any) {
    console.error('[Image Extract] Error extracting images:', error);
    console.error('[Image Extract] Error stack:', error.stack);
    // Return empty array if extraction fails - don't block PDF processing
    return [];
  }
}