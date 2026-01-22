export type SlideType = 'title' | 'content' | 'quote' | 'two-column' | 'highlight' | 'section-divider';

export interface Slide {
  title: string;
  content: string[];
  type?: SlideType;
  // For two-column layouts
  leftContent?: string[];
  rightContent?: string[];
  // For quote slides
  quote?: string;
  attribution?: string;
  // Visual emphasis
  highlight?: boolean;
}

export interface PdfToPptResponse {
  slides: Slide[];
  pptxBuffer: ArrayBuffer;
  htmlPreview: string;
}

export interface ProcessedPdf {
  filename: string;
  slides: Slide[];
}
