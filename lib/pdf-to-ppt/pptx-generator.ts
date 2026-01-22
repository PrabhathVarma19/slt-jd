import pptxgen from 'pptxgenjs';
import { Slide } from '@/types/pdf-to-ppt';
import * as fs from 'fs';
import * as path from 'path';

// Logo path - Trianz logo for bottom left of slides
const LOGO_PATH = path.join(process.cwd(), 'public', 'trianz-logo-horizontal.png');

export async function generatePptx(slides: Slide[], filename: string): Promise<ArrayBuffer> {
  // Always use default generation with logo and Poppins font
  return generatePptxDefault(slides, filename);
}

// Helper function to add Trianz logo to bottom left of a slide
function addLogoToSlide(slide: any) {
  // Check if logo file exists
  if (fs.existsSync(LOGO_PATH)) {
    try {
      slide.addImage({
        path: LOGO_PATH,
        x: 0.3,
        y: 4.8, // Bottom left - slide height is 5.625, so 4.8 gives us space at bottom
        w: 1.5, // Logo width
        h: 0.5, // Logo height (maintains aspect ratio)
      });
    } catch (err) {
      console.error('Error adding logo to slide:', err);
    }
  }
}


async function generatePptxDefault(slides: Slide[], filename: string): Promise<ArrayBuffer> {
  const pptx = new pptxgen();

  // Set slide size (standard 16:9)
  pptx.layout = 'LAYOUT_WIDE';
  pptx.defineLayout({ name: 'LAYOUT_WIDE', width: 10, height: 5.625 });

  // Title slide - professional cover page design
  const titleSlide = pptx.addSlide();
  
  // Create diagonal split design: Orange top-left, Blue bottom-right
  // Orange section (top-left triangle)
  titleSlide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 6,
    h: 3.5,
    fill: { type: 'solid', color: 'F36C24' },
    rectRadius: 0,
  });
  
  // Blue section (bottom-right)
  titleSlide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 3.5,
    w: 10,
    h: 2.125,
    fill: { type: 'solid', color: '0092C5' },
    rectRadius: 0,
  });
  
  // Blue section (right side)
  titleSlide.addShape(pptx.ShapeType.rect, {
    x: 6,
    y: 0,
    w: 4,
    h: 3.5,
    fill: { type: 'solid', color: '0092C5' },
    rectRadius: 0,
  });

  // Large title - white text on orange background
  const titleText = filename.replace(/\.pdf$/i, '');
  titleSlide.addText(titleText, {
    x: 0.5,
    y: 1.5,
    w: 5.5,
    h: 1.5,
    fontSize: 52,
    fontFace: 'Arial',
    color: 'FFFFFF',
    bold: true,
    align: 'left',
    valign: 'middle',
    lineSpacing: 48,
  });
  
  // Subtitle or decorative element
  titleSlide.addText('Presentation', {
    x: 0.5,
    y: 3.2,
    w: 5.5,
    h: 0.5,
    fontSize: 24,
    fontFace: 'Arial',
    color: 'FFFFFF',
    align: 'left',
    valign: 'middle',
    opacity: 0.9,
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
  contentSlide.background = { color: 'FFFFFF' };

  // Accent bar at top (thinner, like HTML preview)
  contentSlide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 10,
    h: 0.1,
    fill: { type: 'solid', color: 'F36C24' },
  });

  // Slide title - with proper spacing to avoid overlap
  if (slide.title) {
    contentSlide.addText(slide.title, {
      x: 0.5,
      y: 0.3,
      w: 9,
      h: 0.8,
      fontSize: 40,
      fontFace: 'Poppins',
      color: '00367E',
      bold: true,
      align: 'left',
      valign: 'top',
      lineSpacing: 36,
    });
  }

  // Content - use single text box with all bullets to prevent overlapping
  if (slide.content && slide.content.length > 0) {
    // Join all bullet points with newlines - pptxgenjs handles wrapping automatically
    const bulletText = slide.content.join('\n');
    
    contentSlide.addText(bulletText, {
      x: 0.7,
      y: 1.4,
      w: 8.6,
      h: 3.5, // Fixed height - let text wrap naturally within this space
      fontSize: 20,
      fontFace: 'Poppins',
      color: '090909',
      align: 'left',
      valign: 'top',
      bullet: true,
      lineSpacing: 32, // Increased spacing between lines
      paraSpaceAfter: 8, // Space after each paragraph/bullet
    });
  }

  // Add logo to content slide
  addLogoToSlide(contentSlide);
}

function createQuoteSlide(pptx: any, slide: Slide) {
  const quoteSlide = pptx.addSlide();
  
  // Gradient background like HTML preview
  quoteSlide.background = { 
    color: '0092C5',
  };

  // Quote text (large, centered, white)
  if (slide.quote) {
    quoteSlide.addText(`"${slide.quote}"`, {
      x: 1,
      y: 1.8,
      w: 8,
      h: 2.2,
      fontSize: 40,
      fontFace: 'Poppins',
      color: 'FFFFFF',
      italic: true,
      align: 'center',
      valign: 'middle',
      lineSpacing: 44,
    });
  }

  // Attribution (white, right-aligned)
  if (slide.attribution) {
    quoteSlide.addText(`— ${slide.attribution}`, {
      x: 1,
      y: 4.2,
      w: 8,
      h: 0.5,
      fontSize: 24,
      fontFace: 'Poppins',
      color: 'FFFFFF',
      align: 'right',
      valign: 'middle',
    });
  }

  // Add logo to quote slide
  addLogoToSlide(quoteSlide);
}

function createTwoColumnSlide(pptx: any, slide: Slide) {
  const twoColSlide = pptx.addSlide();
  twoColSlide.background = { color: 'FFFFFF' };

  // Accent bar
  twoColSlide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 10,
    h: 0.1,
    fill: { type: 'solid', color: 'F36C24' },
  });

  // Title with proper spacing
  if (slide.title) {
    twoColSlide.addText(slide.title, {
      x: 0.5,
      y: 0.3,
      w: 9,
      h: 0.8,
      fontSize: 40,
      fontFace: 'Poppins',
      color: '00367E',
      bold: true,
      align: 'left',
      valign: 'top',
      lineSpacing: 36,
    });
  }

  // Left column - single text box for all bullets
  if (slide.leftContent && slide.leftContent.length > 0) {
    const bulletText = slide.leftContent.join('\n');
    
    twoColSlide.addText(bulletText, {
      x: 0.5,
      y: 1.4,
      w: 4.3,
      h: 3.5,
      fontSize: 18,
      fontFace: 'Poppins',
      color: '090909',
      align: 'left',
      valign: 'top',
      bullet: true,
      lineSpacing: 28,
      paraSpaceAfter: 8,
    });
  }

  // Right column - single text box for all bullets
  if (slide.rightContent && slide.rightContent.length > 0) {
    const bulletText = slide.rightContent.join('\n');
    
    twoColSlide.addText(bulletText, {
      x: 5.5,
      y: 1.4,
      w: 4.3,
      h: 3.5,
      fontSize: 18,
      fontFace: 'Poppins',
      color: '090909',
      align: 'left',
      valign: 'top',
      bullet: true,
      lineSpacing: 28,
      paraSpaceAfter: 8,
    });
  }
}

function createTitleSlide(pptx: any, slide: Slide) {
  const titleSlide = pptx.addSlide();
  
  // Gradient background like HTML preview
  titleSlide.background = { 
    color: 'F36C24',
  };
  
  // Add gradient effect with secondary color
  titleSlide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 10,
    h: 5.625,
    fill: { type: 'solid', color: '0092C5' },
    rectRadius: 0,
  });

  // Large title - white text on colored background
  titleSlide.addText(slide.title, {
    x: 0.5,
    y: 1.8,
    w: 9,
    h: 2,
    fontSize: slide.highlight ? 56 : 48,
    fontFace: 'Arial',
    color: 'FFFFFF',
    bold: true,
    align: 'left',
    valign: 'middle',
    lineSpacing: 44,
  });

  // Add logo to title slide
  addLogoToSlide(titleSlide);
}

function createHighlightSlide(pptx: any, slide: Slide) {
  const highlightSlide = pptx.addSlide();
  highlightSlide.background = { color: 'FFFFFF' };

  // Thicker accent bar
  highlightSlide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 10,
    h: 0.1,
    fill: { type: 'solid', color: 'F36C24' },
  });

  // Highlighted title - centered and larger
  highlightSlide.addText(slide.title, {
    x: 0.5,
    y: 0.3,
    w: 9,
    h: 1,
    fontSize: 48,
    fontFace: 'Arial',
    color: 'F36C24',
    bold: true,
    align: 'center',
    valign: 'middle',
    lineSpacing: 44,
  });

  // Content - single text box for all bullets
  if (slide.content && slide.content.length > 0) {
    const bulletText = slide.content.join('\n');
    
    highlightSlide.addText(bulletText, {
      x: 0.7,
      y: 1.6,
      w: 8.6,
      h: 3.2,
      fontSize: 22,
      fontFace: 'Poppins',
      color: '090909',
      align: 'left',
      valign: 'top',
      bullet: true,
      lineSpacing: 36,
      paraSpaceAfter: 10,
    });
  }

  // Add logo to highlight slide
  addLogoToSlide(highlightSlide);
}

function createSectionDividerSlide(pptx: any, slide: Slide) {
  const dividerSlide = pptx.addSlide();
  dividerSlide.background = { color: 'FFFFFF' };

  // Full-width colored bar
  dividerSlide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 2,
    w: 10,
    h: 1.5,
    fill: { type: 'solid', color: '0092C5' },
  });

  // Section title (centered, large)
  dividerSlide.addText(slide.title, {
    x: 0.5,
    y: 2.2,
    w: 9,
    h: 1.1,
    fontSize: 44,
    fontFace: 'Arial',
    color: 'FFFFFF',
    bold: true,
    align: 'center',
    valign: 'middle',
  });

  // Add logo to section divider slide
  addLogoToSlide(dividerSlide);
}
