import { NextRequest, NextResponse } from 'next/server';
import { processPdf } from '@/lib/pdf-to-ppt/pdf-processor';
import { generatePptx } from '@/lib/pdf-to-ppt/pptx-generator';
import { generateHtmlPreview } from '@/lib/pdf-to-ppt/html-generator';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a PDF file.' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit. Please upload a smaller file.` },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Process PDF
    const slides = await processPdf(buffer, file.name);

    // Generate PPTX
    const pptxBuffer = await generatePptx(slides, file.name);

    // Generate HTML preview
    const htmlPreview = generateHtmlPreview(slides, file.name);

    // Convert ArrayBuffer to base64 for JSON response
    const pptxBase64 = Buffer.from(pptxBuffer).toString('base64');

    return NextResponse.json({
      slides,
      pptxBase64,
      htmlPreview,
      filename: file.name.replace(/\.pdf$/i, '.pptx'),
    });
  } catch (error: any) {
    console.error('PDF to PPT conversion error:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to convert PDF to PowerPoint',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
