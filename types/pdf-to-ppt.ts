export interface Slide {
  title: string;
  content: string[];
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
