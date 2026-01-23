import { NextRequest, NextResponse } from 'next/server';
import { processPdf, extractTitleFromPdf } from '@/lib/pdf-to-ppt/pdf-processor';
import { generatePptx } from '@/lib/pdf-to-ppt/pptx-generator';
import { generateHtmlPreview } from '@/lib/pdf-to-ppt/html-generator';

// Required for Next.js App Router
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Vercel Pro plan limit

interface ChunkSession {
  chunks: Buffer[];
  totalChunks: number;
  receivedChunks: number;
  filename: string;
  numSlides?: number;
  createdAt: number;
}

// In-memory storage for chunks (no disk storage)
const chunkStore = new Map<string, ChunkSession>();

// Cleanup old sessions every minute (sessions expire after 5 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    const expiredSessions: string[] = [];
    
    for (const [sessionId, session] of chunkStore.entries()) {
      // Delete sessions older than 5 minutes
      if (now - session.createdAt > 5 * 60 * 1000) {
        expiredSessions.push(sessionId);
      }
    }
    
    expiredSessions.forEach(sessionId => chunkStore.delete(sessionId));
    
    if (expiredSessions.length > 0) {
      console.log(`Cleaned up ${expiredSessions.length} expired chunk sessions`);
    }
  }, 60 * 1000); // Check every minute
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const chunk = formData.get('chunk') as File;
    const sessionId = formData.get('sessionId') as string;
    const chunkIndex = parseInt(formData.get('chunkIndex') as string, 10);
    const totalChunks = parseInt(formData.get('totalChunks') as string, 10);
    const filename = formData.get('filename') as string;
    const numSlidesParam = formData.get('numSlides') as string | null;
    const numSlides = numSlidesParam ? parseInt(numSlidesParam, 10) : undefined;
    const extractionModeParam = formData.get('extractionMode') as string | null;
    const extractionMode = (extractionModeParam === 'extract' || extractionModeParam === 'ai') ? extractionModeParam : 'ai';

    // Validate required fields
    if (!chunk || !sessionId || isNaN(chunkIndex) || isNaN(totalChunks) || !filename) {
      return NextResponse.json(
        { error: 'Missing required fields: chunk, sessionId, chunkIndex, totalChunks, filename' },
        { status: 400 }
      );
    }

    // Convert chunk to Buffer
    const arrayBuffer = await chunk.arrayBuffer();
    const chunkBuffer = Buffer.from(arrayBuffer);

    // Get or create session
    let session = chunkStore.get(sessionId);
    
    if (!session) {
      // Create new session
      session = {
        chunks: [],
        totalChunks,
        receivedChunks: 0,
        filename,
        numSlides,
        createdAt: Date.now(),
      };
      chunkStore.set(sessionId, session);
    }

    // Validate session matches
    if (session.totalChunks !== totalChunks || session.filename !== filename) {
      return NextResponse.json(
        { error: 'Session mismatch. Please restart the upload.' },
        { status: 400 }
      );
    }

    // Store chunk at correct index (handle out-of-order chunks)
    // Ensure array is large enough
    if (session.chunks.length <= chunkIndex) {
      session.chunks.length = chunkIndex + 1;
    }
    session.chunks[chunkIndex] = chunkBuffer;
    session.receivedChunks = session.chunks.filter(c => c !== undefined && c !== null).length;

    // Check if all chunks received
    if (session.receivedChunks === session.totalChunks) {
      // Reassemble file - ensure chunks are in correct order
      const orderedChunks: Buffer[] = [];
      for (let i = 0; i < session.totalChunks; i++) {
        const chunk = session.chunks[i];
        if (!chunk) {
          chunkStore.delete(sessionId);
          return NextResponse.json(
            { error: `Missing chunk ${i + 1} of ${session.totalChunks}. Please try uploading again.` },
            { status: 400 }
          );
        }
        orderedChunks.push(chunk);
      }
      
      const fullBuffer = Buffer.concat(orderedChunks);
      
      // Validate buffer is not empty
      if (!fullBuffer || fullBuffer.length === 0) {
        chunkStore.delete(sessionId);
        return NextResponse.json(
          { error: 'Reassembled file is empty. Please try uploading again.' },
          { status: 400 }
        );
      }
      
      // Log buffer size for debugging
      console.log(`Reassembled PDF: ${fullBuffer.length} bytes, expected from ${orderedChunks.length} chunks`);
      
      // Validate PDF header
      const pdfHeader = fullBuffer.slice(0, 4).toString();
      if (pdfHeader !== '%PDF') {
        chunkStore.delete(sessionId);
        console.error(`Invalid PDF header: ${pdfHeader}, first 20 bytes: ${fullBuffer.slice(0, 20).toString('hex')}`);
        return NextResponse.json(
          { error: 'Invalid PDF file: file does not start with PDF header. The file may be corrupted.' },
          { status: 400 }
        );
      }

      // Delete chunks from memory immediately
      chunkStore.delete(sessionId);

      // Extract title from PDF
      const extractedTitle = await extractTitleFromPdf(fullBuffer, filename);

      // Process PDF
      const useAI = session.extractionMode !== 'extract';
      const slides = await processPdf(fullBuffer, filename, useAI, session.numSlides);

      // Generate PPTX with extracted title
      const pptxBuffer = await generatePptx(slides, filename, extractedTitle);

      // Generate HTML preview
      const htmlPreview = generateHtmlPreview(slides, filename);

      // Convert to base64 for JSON response
      const pptxBase64 = Buffer.from(pptxBuffer).toString('base64');

      // Return final result
      return NextResponse.json({
        slides,
        pptxBase64,
        htmlPreview,
        filename: filename.replace(/\.pdf$/i, '.pptx'),
        totalSlides: slides.length + 1, // Include title slide
      });
    }

    // Return progress update
    return NextResponse.json({
      success: true,
      receivedChunks: session.receivedChunks,
      totalChunks: session.totalChunks,
    });
  } catch (error: any) {
    console.error('Chunk upload error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to process chunk',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
