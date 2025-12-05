'use client';

import { useRef, useEffect, useState } from 'react';
import Textarea from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface NumberedTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}

export default function NumberedTextarea({
  value,
  onChange,
  placeholder,
  rows = 8,
  className,
}: NumberedTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const [lineCount, setLineCount] = useState(rows);

  useEffect(() => {
    const lines = value.split('\n').length || 1;
    setLineCount(Math.max(rows, lines, 8));
  }, [value, rows]);

  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const lines = value.split('\n');
  const displayLines = lines.length > 0 ? lines : [''];

  return (
    <div className="relative flex w-full overflow-hidden rounded-lg border-2 border-gray-300 bg-white">
      {/* Line Numbers */}
      <div
        ref={lineNumbersRef}
        className="flex-shrink-0 select-none overflow-y-auto bg-gray-50 text-right text-sm text-gray-500"
        style={{ 
          width: '50px',
          fontFamily: 'ui-monospace, monospace',
          paddingTop: '12px',
          paddingBottom: '12px',
          paddingRight: '12px',
          paddingLeft: '8px'
        }}
      >
        {displayLines.map((_, index) => (
          <div key={index} style={{ lineHeight: '1.75rem', height: '1.75rem' }}>
            {index + 1}.
          </div>
        ))}
        {displayLines.length === 0 && (
          <div style={{ lineHeight: '1.75rem', height: '1.75rem' }}>1.</div>
        )}
      </div>

      {/* Textarea */}
      <div className="flex-1 overflow-hidden">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          placeholder={placeholder}
          rows={rows}
          className={cn(
            'border-0 border-l-2 border-gray-200 rounded-none resize-none focus-visible:ring-0 focus-visible:border-blue-500 px-4 py-3',
            className
          )}
          style={{ 
            lineHeight: '1.75rem',
            fontFamily: 'inherit'
          }}
        />
      </div>
    </div>
  );
}

