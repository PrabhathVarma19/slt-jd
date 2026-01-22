import { NextRequest, NextResponse } from 'next/server';
import { processPdf } from '@/lib/pdf-to-ppt/pdf-processor';
import { generatePptx } from '@/lib/pdf-to-ppt/pptx-generator';
import { generateHtmlPreview } from '@/lib/pdf-to-ppt/html-generator';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/7f74fb16-5e81-4704-9c2c-1a3dd73f3bf3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:8',message:'POST handler entry',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const numSlidesParam = formData.get('numSlides') as string | null;
    const numSlides = numSlidesParam ? parseInt(numSlidesParam, 10) : undefined;
    const template = (formData.get('template') as string) || 'trianz';
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/7f74fb16-5e81-4704-9c2c-1a3dd73f3bf3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:11',message:'File received',data:{fileName:file?.name||'none',fileSize:file?.size||0,fileType:file?.type||'none',numSlides},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

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
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/7f74fb16-5e81-4704-9c2c-1a3dd73f3bf3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:35',message:'Buffer created',data:{bufferSize:buffer.length,arrayBufferSize:arrayBuffer.byteLength,firstBytes:Array.from(buffer.slice(0,20)).map(b=>b.toString(16).padStart(2,'0')).join(' '),isPdfHeader:buffer.slice(0,4).toString()==='%PDF'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    // Process PDF
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/7f74fb16-5e81-4704-9c2c-1a3dd73f3bf3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:38',message:'Before processPdf call',data:{bufferSize:buffer.length,fileName:file.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    const slides = await processPdf(buffer, file.name, true, numSlides); // Use AI by default

    // Generate PPTX
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/7f74fb16-5e81-4704-9c2c-1a3dd73f3bf3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:41',message:'Before generatePptx call',data:{slidesCount:slides?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    const pptxBuffer = await generatePptx(slides, file.name);

    // Generate HTML preview
    const htmlPreview = generateHtmlPreview(slides, file.name);

    // Convert ArrayBuffer to base64 for JSON response
    const pptxBase64 = Buffer.from(pptxBuffer).toString('base64');
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/7f74fb16-5e81-4704-9c2c-1a3dd73f3bf3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:49',message:'Success response',data:{slidesCount:slides.length,pptxBufferSize:pptxBuffer.byteLength},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    return NextResponse.json({
      slides,
      pptxBase64,
      htmlPreview,
      filename: file.name.replace(/\.pdf$/i, '.pptx'),
      totalSlides: slides.length + 1, // Include title slide
    });
  } catch (error: any) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/7f74fb16-5e81-4704-9c2c-1a3dd73f3bf3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:56',message:'Error caught in handler',data:{errorMessage:error?.message||'unknown',errorName:error?.name||'unknown',errorStack:error?.stack?.substring(0,500)||''},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
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
