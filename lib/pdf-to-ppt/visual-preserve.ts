import { Slide } from '@/types/pdf-to-ppt';

const MAX_VISUAL_PAGES = 40;

async function ensureCanvasGlobals() {
  if (
    typeof (globalThis as any).DOMMatrix !== 'undefined' &&
    typeof (globalThis as any).ImageData !== 'undefined' &&
    typeof (globalThis as any).Path2D !== 'undefined'
  ) {
    return;
  }

  // @napi-rs/canvas provides the browser-like classes pdfjs needs on Node runtimes.
  const canvasModule = await import('@napi-rs/canvas');
  if (typeof (globalThis as any).DOMMatrix === 'undefined' && (canvasModule as any).DOMMatrix) {
    (globalThis as any).DOMMatrix = (canvasModule as any).DOMMatrix;
  }
  if (typeof (globalThis as any).ImageData === 'undefined' && (canvasModule as any).ImageData) {
    (globalThis as any).ImageData = (canvasModule as any).ImageData;
  }
  if (typeof (globalThis as any).Path2D === 'undefined' && (canvasModule as any).Path2D) {
    (globalThis as any).Path2D = (canvasModule as any).Path2D;
  }
}

export async function buildVisualPreserveSlides(
  pdfBuffer: Buffer,
  options?: { maxPages?: number }
): Promise<Slide[]> {
  await ensureCanvasGlobals();
  const { pdf } = await import('pdf-to-img');
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
