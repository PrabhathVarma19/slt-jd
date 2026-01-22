import pdfParse from 'pdf-parse';
import { Slide } from '@/types/pdf-to-ppt';

export async function extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(pdfBuffer);
    return data.text || '';
  } catch (error) {
    throw new Error('Failed to extract text from PDF. Please ensure the file is a valid PDF.');
  }
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
      // Create slides from lines, grouping them
      const linesPerSlide = Math.max(3, Math.ceil(lines.length / 10)); // Aim for ~10 slides
      for (let i = 0; i < lines.length; i += linesPerSlide) {
        const slideLines = lines.slice(i, i + linesPerSlide);
        const title = slideLines[0]?.trim() || `Slide ${slides.length + 1}`;
        const content = slideLines.slice(1).map(line => line.trim()).filter(Boolean);
        slides.push({ title, content: content.length > 0 ? content : [slideLines[0]?.trim() || ''] });
      }
    }
  } else {
    // Process sections into slides
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i].trim();
      const lines = section.split('\n').map(line => line.trim()).filter(Boolean);
      
      if (lines.length === 0) continue;

      // First line as title, rest as content
      const title = lines[0];
      const content = lines.slice(1);

      // If content is empty, use the title line as content
      if (content.length === 0) {
        slides.push({ title, content: [title] });
      } else {
        slides.push({ title, content });
      }
    }
  }

  // Ensure we have at least one slide
  if (slides.length === 0) {
    slides.push({
      title: filename.replace(/\.pdf$/i, ''),
      content: [cleanedText.substring(0, 500)],
    });
  }

  // Limit to reasonable number of slides (max 50)
  if (slides.length > 50) {
    return slides.slice(0, 50);
  }

  return slides;
}

export async function processPdf(pdfBuffer: Buffer, filename: string): Promise<Slide[]> {
  const text = await extractTextFromPdf(pdfBuffer);
  return splitTextIntoSlides(text, filename);
}
