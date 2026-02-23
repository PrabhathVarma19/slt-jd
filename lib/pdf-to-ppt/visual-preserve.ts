import { Slide } from '@/types/pdf-to-ppt';

const MAX_VISUAL_PAGES = 40;

async function importModuleRuntime<T = any>(moduleName: string): Promise<T> {
  // Avoid static analysis/bundling of native optional deps during build.
  const dynamicImporter = new Function('m', 'return import(m)') as (m: string) => Promise<T>;
  return dynamicImporter(moduleName);
}

export async function buildVisualPreserveSlides(
  pdfBuffer: Buffer,
  options?: { maxPages?: number }
): Promise<Slide[]> {
  const { pdf } = await importModuleRuntime<{ pdf: (input: Buffer, opts?: any) => Promise<any> }>(
    'pdf-to-img'
  );
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
