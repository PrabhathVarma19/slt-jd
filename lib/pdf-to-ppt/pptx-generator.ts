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

  // Content slides with varied layouts
  slides.forEach((slide, index) => {
    const slideType = slide.type || 'content';
    
    switch (slideType) {
      case 'quote':
        createQuoteSlide(pptx, slide);
        break;
      case 'two-column':
        createTwoColumnSlide(pptx, slide);
        break;
      case 'title':
        createTitleSlide(pptx, slide);
        break;
      case 'highlight':
        createHighlightSlide(pptx, slide);
        break;
      case 'section-divider':
        createSectionDividerSlide(pptx, slide);
        break;
      default:
        createContentSlide(pptx, slide);
    }
  });

  // Generate PPTX buffer
  const buffer = await pptx.write({ outputType: 'arraybuffer' });
  return buffer as ArrayBuffer;
}

function createContentSlide(pptx: any, slide: Slide) {
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
  if (slide.title) {
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
  }

  // Content
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
}

function createQuoteSlide(pptx: any, slide: Slide) {
  const quoteSlide = pptx.addSlide();
  quoteSlide.background = { color: TRIANZ_COLORS.background.replace('#', '') };

  // Large accent bar
  quoteSlide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 10,
    h: 0.5,
    fill: { type: 'solid', color: TRIANZ_COLORS.primary.replace('#', '') },
  });

  // Quote text (large, centered)
  if (slide.quote) {
    quoteSlide.addText(`"${slide.quote}"`, {
      x: 1,
      y: 1.5,
      w: 8,
      h: 2.5,
      fontSize: 32,
      fontFace: 'Arial',
      color: TRIANZ_COLORS.heading.replace('#', ''),
      italic: true,
      align: 'center',
      valign: 'middle',
      lineSpacing: 36,
    });
  }

  // Attribution
  if (slide.attribution) {
    quoteSlide.addText(`— ${slide.attribution}`, {
      x: 1,
      y: 4.2,
      w: 8,
      h: 0.5,
      fontSize: 20,
      fontFace: 'Arial',
      color: TRIANZ_COLORS.secondaryGrey.replace('#', ''),
      align: 'right',
      valign: 'middle',
    });
  }
}

function createTwoColumnSlide(pptx: any, slide: Slide) {
  const twoColSlide = pptx.addSlide();
  twoColSlide.background = { color: TRIANZ_COLORS.background.replace('#', '') };

  // Accent bar
  twoColSlide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 10,
    h: 0.15,
    fill: { type: 'solid', color: TRIANZ_COLORS.primary.replace('#', '') },
  });

  // Title
  if (slide.title) {
    twoColSlide.addText(slide.title, {
      x: 0.5,
      y: 0.4,
      w: 9,
      h: 0.5,
      fontSize: 32,
      fontFace: 'Arial',
      color: TRIANZ_COLORS.heading.replace('#', ''),
      bold: true,
      align: 'left',
      valign: 'top',
    });
  }

  // Left column
  if (slide.leftContent && slide.leftContent.length > 0) {
    twoColSlide.addText(slide.leftContent.join('\n'), {
      x: 0.5,
      y: 1.1,
      w: 4.5,
      h: 4,
      fontSize: 16,
      fontFace: 'Arial',
      color: TRIANZ_COLORS.body.replace('#', ''),
      align: 'left',
      valign: 'top',
      bullet: {
        type: 'number',
        code: '1.',
      },
      lineSpacing: 24,
    });
  }

  // Right column
  if (slide.rightContent && slide.rightContent.length > 0) {
    twoColSlide.addText(slide.rightContent.join('\n'), {
      x: 5.5,
      y: 1.1,
      w: 4.5,
      h: 4,
      fontSize: 16,
      fontFace: 'Arial',
      color: TRIANZ_COLORS.body.replace('#', ''),
      align: 'left',
      valign: 'top',
      bullet: {
        type: 'number',
        code: String(slide.leftContent?.length || 0 + 1) + '.',
      },
      lineSpacing: 24,
    });
  }
}

function createTitleSlide(pptx: any, slide: Slide) {
  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: TRIANZ_COLORS.background.replace('#', '') };

  // Full-width accent bar
  titleSlide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 10,
    h: 1,
    fill: { type: 'solid', color: TRIANZ_COLORS.primary.replace('#', '') },
  });

  // Large title
  titleSlide.addText(slide.title, {
    x: 0.5,
    y: 1.5,
    w: 9,
    h: 2.5,
    fontSize: slide.highlight ? 48 : 40,
    fontFace: 'Arial',
    color: slide.highlight ? TRIANZ_COLORS.heading.replace('#', '') : TRIANZ_COLORS.heading.replace('#', ''),
    bold: true,
    align: 'center',
    valign: 'middle',
  });
}

function createHighlightSlide(pptx: any, slide: Slide) {
  const highlightSlide = pptx.addSlide();
  highlightSlide.background = { color: TRIANZ_COLORS.background.replace('#', '') };

  // Thicker accent bar
  highlightSlide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 10,
    h: 0.25,
    fill: { type: 'solid', color: TRIANZ_COLORS.primary.replace('#', '') },
  });

  // Highlighted title
  highlightSlide.addText(slide.title, {
    x: 0.5,
    y: 0.5,
    w: 9,
    h: 0.8,
    fontSize: 40,
    fontFace: 'Arial',
    color: TRIANZ_COLORS.primary.replace('#', ''),
    bold: true,
    align: 'left',
    valign: 'top',
  });

  // Content with better spacing
  if (slide.content && slide.content.length > 0) {
    highlightSlide.addText(slide.content.join('\n'), {
      x: 0.7,
      y: 1.6,
      w: 8.6,
      h: 3.5,
      fontSize: 20,
      fontFace: 'Arial',
      color: TRIANZ_COLORS.body.replace('#', ''),
      align: 'left',
      valign: 'top',
      bullet: {
        type: 'number',
        code: '1.',
      },
      lineSpacing: 32,
    });
  }
}

function createSectionDividerSlide(pptx: any, slide: Slide) {
  const dividerSlide = pptx.addSlide();
  dividerSlide.background = { color: TRIANZ_COLORS.background.replace('#', '') };

  // Full-width colored bar
  dividerSlide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 2,
    w: 10,
    h: 1.5,
    fill: { type: 'solid', color: TRIANZ_COLORS.secondary.replace('#', '') },
  });

  // Section title (centered, large)
  dividerSlide.addText(slide.title, {
    x: 0.5,
    y: 2.2,
    w: 9,
    h: 1.1,
    fontSize: 44,
    fontFace: 'Arial',
    color: TRIANZ_COLORS.background.replace('#', ''),
    bold: true,
    align: 'center',
    valign: 'middle',
  });
}
