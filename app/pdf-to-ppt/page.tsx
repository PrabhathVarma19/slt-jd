'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Slide } from '@/types/pdf-to-ppt';

export default function PdfToPptPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [htmlPreview, setHtmlPreview] = useState<string | null>(null);
  const [pptxBase64, setPptxBase64] = useState<string | null>(null);
  const [pptxFilename, setPptxFilename] = useState<string>('');
  const [numSlides, setNumSlides] = useState<number>(10);
  const [numSlidesInput, setNumSlidesInput] = useState<string>('10');
  const [totalSlides, setTotalSlides] = useState<number>(0);
  const [extractionMode, setExtractionMode] = useState<'extract' | 'ai'>('ai');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const handleFileSelect = (selectedFile: File) => {
    // Validate file type
    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a PDF file.');
      return;
    }

    // Validate file size (25MB)
    if (selectedFile.size > 25 * 1024 * 1024) {
      setError('File size exceeds 25MB limit. Please upload a smaller file.');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setSlides([]);
    setHtmlPreview(null);
    setPptxBase64(null);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  // Split file into chunks
  const chunkFile = useCallback((file: File, chunkSize: number = 4 * 1024 * 1024): Blob[] => {
    const chunks: Blob[] = [];
    let start = 0;
    
    while (start < file.size) {
      const end = Math.min(start + chunkSize, file.size);
      chunks.push(file.slice(start, end));
      start = end;
    }
    
    return chunks;
  }, []);

  // Upload file using chunked upload
  const uploadChunked = useCallback(async (file: File, numSlides: number, extractionMode: 'extract' | 'ai', progressCallback: (progress: number) => void): Promise<any> => {
    const chunks = chunkFile(file);
    const sessionId = crypto.randomUUID();
    
    for (let i = 0; i < chunks.length; i++) {
      const formData = new FormData();
      formData.append('chunk', chunks[i]);
      formData.append('sessionId', sessionId);
      formData.append('chunkIndex', i.toString());
      formData.append('totalChunks', chunks.length.toString());
      formData.append('filename', file.name);
      formData.append('extractionMode', extractionMode);
      if (numSlides) {
        formData.append('numSlides', numSlides.toString());
      }
      
      const response = await fetch('/api/pdf-to-ppt/chunk', {
        method: 'POST',
        body: formData,
      });

      // Check response status before parsing JSON
      if (!response.ok) {
        let errorMessage = 'Chunk upload failed';
        const contentType = response.headers.get('content-type');
        
        if (contentType?.includes('application/json')) {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } else {
          const errorText = await response.text();
          errorMessage = errorText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      
      // If this was the final chunk, return the result
      if (data.slides) {
        return data;
      }
      
      // Update progress
      progressCallback(((i + 1) / chunks.length) * 100);
    }
    
    throw new Error('Upload completed but no result received');
  }, [chunkFile]);

  // Upload file directly (for files <4MB)
  const uploadDirect = useCallback(async (file: File, numSlides: number): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    if (numSlides && numSlides >= 5 && numSlides <= 25) {
      formData.append('numSlides', numSlides.toString());
    }

    const response = await fetch('/api/pdf-to-ppt', {
      method: 'POST',
      body: formData,
    });

    // Check response status before parsing JSON
    if (!response.ok) {
      let errorMessage = 'Failed to convert PDF to PowerPoint';
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } else {
        // Handle plain text errors (413, etc.)
        const errorText = await response.text();
        if (response.status === 413 || errorText.includes('payload too large') || errorText.includes('Content Too Large')) {
          errorMessage = 'File is too large. Please try again - the system will automatically use chunked upload for large files.';
        } else {
          errorMessage = errorText || errorMessage;
        }
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data;
  }, []);

  const handleGenerate = async () => {
    if (!file) {
      setError('Please select a PDF file first.');
      return;
    }

    // Validate and normalize numSlides before submitting
    let validatedNumSlides = numSlides;
    const inputValue = parseInt(numSlidesInput, 10);
    if (!isNaN(inputValue) && inputValue >= 5 && inputValue <= 25) {
      validatedNumSlides = inputValue;
      setNumSlides(inputValue);
      setNumSlidesInput(inputValue.toString());
    } else {
      // Use default if invalid
      validatedNumSlides = 10;
      setNumSlides(10);
      setNumSlidesInput('10');
    }

    setIsLoading(true);
    setError(null);
    setUploadProgress(0);

    try {
      // Use chunked upload for files >4MB (Vercel limit is 4.5MB)
      const CHUNK_THRESHOLD = 4 * 1024 * 1024; // 4MB
      const data = file.size > CHUNK_THRESHOLD
        ? await uploadChunked(file, validatedNumSlides, extractionMode, setUploadProgress)
        : await uploadDirect(file, validatedNumSlides, extractionMode);

      setSlides(data.slides || []);
      setHtmlPreview(data.htmlPreview || null);
      setPptxBase64(data.pptxBase64 || null);
      setPptxFilename(data.filename || 'presentation.pptx');
      setTotalSlides(data.totalSlides || data.slides.length + 1);
      setUploadProgress(100);
    } catch (err: any) {
      setError(err.message || 'Failed to convert PDF to PowerPoint');
      setUploadProgress(0);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!pptxBase64) return;

    try {
      const binaryString = atob(pptxBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = pptxFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to download PowerPoint file');
    }
  };

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Beacon · PDF to PPT</p>
          <h1 className="text-2xl font-semibold text-gray-900 mt-1">Convert PDF to PowerPoint</h1>
          <p className="text-sm text-gray-600">
            Upload a PDF file to generate a PowerPoint presentation using your custom template.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="mb-2">
          <Link
            href="/"
            className="inline-flex items-center text-xs font-medium text-blue-700 hover:underline"
          >
            ← Back to Home
          </Link>
        </div>

        <Card className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Upload PDF</CardTitle>
            <CardDescription>Select a PDF file (max 25MB) to convert to PowerPoint</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            )}

            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition ${
                isDragging
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileInputChange}
                className="hidden"
              />
              {file ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setFile(null);
                      setSlides([]);
                      setHtmlPreview(null);
                      setPptxBase64(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">Drag and drop a PDF file here, or</p>
                  <Button
                    variant="secondary"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Browse Files
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Content Extraction Mode
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setExtractionMode('extract')}
                  className={`flex-1 rounded-md border px-4 py-2 text-sm font-medium transition ${
                    extractionMode === 'extract'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Extract as is
                </button>
                <button
                  type="button"
                  onClick={() => setExtractionMode('ai')}
                  className={`flex-1 rounded-md border px-4 py-2 text-sm font-medium transition ${
                    extractionMode === 'ai'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  AI Based
                </button>
              </div>
              <p className="text-xs text-gray-500">
                {extractionMode === 'extract' 
                  ? 'Extract content directly from PDF without AI processing'
                  : 'Use AI to generate narrative, story-driven slides'}
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="numSlides" className="block text-sm font-medium text-gray-700">
                Number of Slides (optional)
              </label>
              <input
                id="numSlides"
                type="number"
                min="5"
                max="25"
                value={numSlidesInput}
                onChange={(e) => {
                  const value = e.target.value;
                  // Allow free typing - just update the input value
                  setNumSlidesInput(value);
                  // Also update numSlides if valid, but don't reset if invalid
                  const numValue = parseInt(value, 10);
                  if (!isNaN(numValue) && numValue >= 5 && numValue <= 25) {
                    setNumSlides(numValue);
                  }
                }}
                onBlur={(e) => {
                  const inputValue = e.target.value.trim();
                  if (inputValue === '') {
                    // Reset to default if empty
                    setNumSlidesInput('10');
                    setNumSlides(10);
                    return;
                  }
                  
                  const value = parseInt(inputValue, 10);
                  if (isNaN(value) || value < 5 || value > 25) {
                    // Clamp to valid range instead of resetting
                    const clampedValue = Math.min(Math.max(value || 10, 5), 25);
                    setNumSlidesInput(clampedValue.toString());
                    setNumSlides(clampedValue);
                  } else {
                    // Update both states with validated value
                    setNumSlidesInput(value.toString());
                    setNumSlides(value);
                  }
                }}
                onKeyDown={(e) => {
                  // Allow Enter key to trigger blur validation
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  }
                }}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="10"
              />
              <p className="text-xs text-gray-500">
                Specify the desired number of slides (5-25). Default is 10 for automatic generation.
              </p>
            </div>

            {isLoading && uploadProgress > 0 && uploadProgress < 100 && (
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}

            <Button
              onClick={handleGenerate}
              disabled={!file || isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  {uploadProgress > 0 && uploadProgress < 100
                    ? `Uploading... ${Math.round(uploadProgress)}%`
                    : 'Generating PowerPoint...'}
                </>
              ) : (
                'Generate PowerPoint'
              )}
            </Button>
          </CardContent>
        </Card>

        {slides.length > 0 && (
          <Card className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl">Preview</CardTitle>
              <CardDescription>
                {totalSlides || slides.length + 1} slide{(totalSlides || slides.length + 1) !== 1 ? 's' : ''} generated
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {htmlPreview && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <iframe
                    srcDoc={htmlPreview}
                    className="w-full h-[600px] border-0"
                    title="Slide Preview"
                  />
                </div>
              )}

              {pptxBase64 && (
                <div className="flex justify-end">
                  <Button onClick={handleDownload}>
                    Download PowerPoint (.pptx)
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
