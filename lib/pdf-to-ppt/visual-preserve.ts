import { pdf } from 'pdf-to-img';
import { Slide } from '@/types/pdf-to-ppt';

const MAX_VISUAL_PAGES = 40;

export async function buildVisualPreserveSlides(
  pdfBuffer: Buffer,
  options?: { maxPages?: number }
): Promise<Slide[]> {
  const maxPages = Math.min(options?.maxPages || MAX_VISUAL_PAGES, MAX_VISUAL_PAGES);
  const doc = await pdf(pdfBuffer, { scale: 2 });
  const pageCount = Math.min(doc.length, maxPages);

  const slides: Slide[] = [];
  for (let page = 1; page <= pageCount; page++) {
    const pageImage = await doc.getPage(page);
    const imageBase64 = pageImage.toString('base64');
    slides.push({
      title: `Page ${page}`,
      content: [],
      type: 'full-image',
      images: [
        {
          data: `data:image/png;base64,${imageBase64}`,
          page,
          width: 1920,
          height: 1080,
          description: `PDF page ${page}`,
        },
      ],
    });
  }

  if (slides.length === 0) {
    throw new Error('Could not render PDF pages in visual mode.');
  }

  return slides;
}

