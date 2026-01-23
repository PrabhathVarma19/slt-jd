export type SlideType = 'title' | 'content' | 'quote' | 'two-column' | 'highlight' | 'section-divider';

export type TemplateType = 'trianz' | 'professional' | 'modern' | 'creative' | 'executive';

export interface PdfImage {
  data: string; // base64 encoded image
  page: number;
  width: number;
  height: number;
  x?: number; // position on page
  y?: number;
  description?: string;
}

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
  // Images extracted from PDF
  images?: PdfImage[];
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
