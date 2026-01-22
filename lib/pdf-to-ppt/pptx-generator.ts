import pptxgen from 'pptxgenjs';
import { Slide } from '@/types/pdf-to-ppt';

// Trianz brand colors
const TRIANZ_COLORS = {
  primary: '#F36C24',      // Orange - primary accent
  secondary: '#0092C5',    // Blue - secondary accent
  secondaryLight: '#7ECBE5', // Light blue
  secondaryGrey: '#858586',  // Grey
  heading: '#00367E',      // Dark blue - headings
  body: '#090909',          // Black - body text
  background: '#FFFFFF',    // White - background
};

export async function generatePptx(slides: Slide[], filename: string): Promise<ArrayBuffer> {
  const pptx = new pptxgen();

  // Set slide size (standard 16:9)
  pptx.layout = 'LAYOUT_WIDE';
  pptx.defineLayout({ name: 'LAYOUT_WIDE', width: 10, height: 5.625 });

  // Title slide
  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: TRIANZ_COLORS.background.replace('#', '') };
  
  // Title with accent bar
  titleSlide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 10,
    h: 0.3,
    fill: { type: 'solid', color: TRIANZ_COLORS.primary.replace('#', '') },
  });

  titleSlide.addText(filename.replace(/\.pdf$/i, ''), {
    x: 0.5,
    y: 1.5,
    w: 9,
    h: 1,
    fontSize: 44,
    fontFace: 'Arial',
    color: TRIANZ_COLORS.heading.replace('#', ''),
    bold: true,
    align: 'left',
    valign: 'middle',
  });

  // Content slides
  slides.forEach((slide, index) => {
    const contentSlide = pptx.addSlide();
    contentSlide.background = { color: TRIANZ_COLORS.background.replace('#', '') };

    // Accent bar at top
    contentSlide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 10,
      h: 0.15,
      fill: { type: 'solid', color: TRIANZ_COLORS.primary.replace('#', '') },
    });

    // Slide title
    contentSlide.addText(slide.title, {
      x: 0.5,
      y: 0.4,
      w: 9,
      h: 0.6,
    fontSize: 36,
    fontFace: 'Arial',
    color: TRIANZ_COLORS.heading.replace('#', ''),
    bold: true,
      align: 'left',
      valign: 'top',
    });

    // Bullet points
    if (slide.content && slide.content.length > 0) {
      const bulletText = slide.content.join('\n');
      contentSlide.addText(bulletText, {
        x: 0.7,
        y: 1.2,
        w: 8.6,
        h: 3.8,
        fontSize: 18,
        fontFace: 'Arial',
        color: TRIANZ_COLORS.body.replace('#', ''),
        align: 'left',
        valign: 'top',
        bullet: {
          type: 'number',
          code: '1.',
        },
        lineSpacing: 28,
      });
    }
  });

  // Generate PPTX buffer
  const buffer = await pptx.write({ outputType: 'arraybuffer' });
  return buffer as ArrayBuffer;
}
