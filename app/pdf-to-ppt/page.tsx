'use client';

import { useState, useRef } from 'react';
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
  const [numSlides, setNumSlides] = useState<number>(20);
  const [numSlidesInput, setNumSlidesInput] = useState<string>('20');
  const [totalSlides, setTotalSlides] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (selectedFile: File) => {
    // Validate file type
    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a PDF file.');
      return;
    }

    // Validate file size (10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File size exceeds 10MB limit. Please upload a smaller file.');
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

  const handleGenerate = async () => {
    if (!file) {
      setError('Please select a PDF file first.');
      return;
    }

    // Validate and normalize numSlides before submitting
    let validatedNumSlides = numSlides;
    const inputValue = parseInt(numSlidesInput, 10);
    if (!isNaN(inputValue) && inputValue >= 5 && inputValue <= 50) {
      validatedNumSlides = inputValue;
      setNumSlides(inputValue);
      setNumSlidesInput(inputValue.toString());
    } else {
      // Use default if invalid
      validatedNumSlides = 20;
      setNumSlides(20);
      setNumSlidesInput('20');
    }

    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (validatedNumSlides && validatedNumSlides >= 5 && validatedNumSlides <= 50) {
        formData.append('numSlides', validatedNumSlides.toString());
      }

      const response = await fetch('/api/pdf-to-ppt', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to convert PDF to PowerPoint');
      }

      setSlides(data.slides || []);
      setHtmlPreview(data.htmlPreview || null);
      setPptxBase64(data.pptxBase64 || null);
      setPptxFilename(data.filename || 'presentation.pptx');
      setTotalSlides(data.totalSlides || data.slides.length + 1);
    } catch (err: any) {
      setError(err.message || 'Failed to convert PDF to PowerPoint');
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
            <CardDescription>Select a PDF file (max 10MB) to convert to PowerPoint</CardDescription>
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
              <label htmlFor="numSlides" className="block text-sm font-medium text-gray-700">
                Number of Slides (optional)
              </label>
              <input
                id="numSlides"
                type="number"
                min="5"
                max="50"
                value={numSlidesInput}
                onChange={(e) => {
                  const value = e.target.value;
                  // Allow free typing - just update the input value
                  setNumSlidesInput(value);
                  // Also update numSlides if valid, but don't reset if invalid
                  const numValue = parseInt(value, 10);
                  if (!isNaN(numValue) && numValue >= 5 && numValue <= 50) {
                    setNumSlides(numValue);
                  }
                }}
                onBlur={(e) => {
                  const inputValue = e.target.value.trim();
                  if (inputValue === '') {
                    // Reset to default if empty
                    setNumSlidesInput('20');
                    setNumSlides(20);
                    return;
                  }
                  
                  const value = parseInt(inputValue, 10);
                  if (isNaN(value) || value < 5 || value > 50) {
                    // Clamp to valid range instead of resetting
                    const clampedValue = Math.min(Math.max(value || 20, 5), 50);
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
                placeholder="20"
              />
              <p className="text-xs text-gray-500">
                Specify the desired number of slides (5-50). Default is 20 for automatic generation.
              </p>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={!file || isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Generating PowerPoint...
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
