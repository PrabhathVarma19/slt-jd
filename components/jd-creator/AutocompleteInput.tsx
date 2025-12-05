'use client';

import { useState, useRef, useEffect } from 'react';
import { debounce, cn } from '@/lib/utils';
import { AutocompleteRequest } from '@/types/jd';

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  field: 'responsibility' | 'skill';
  jobTitle: string;
  context?: string;
  tone: string;
  seniority: string;
  className?: string;
}

export default function AutocompleteInput({
  value,
  onChange,
  placeholder,
  field,
  jobTitle,
  context,
  tone,
  seniority,
  className,
}: AutocompleteInputProps) {
  const [suggestion, setSuggestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchSuggestion = debounce(async (currentValue: string) => {
    if (!currentValue.trim() || currentValue.endsWith(' ')) {
      setSuggestion('');
      return;
    }

    setIsLoading(true);
    try {
      const request: AutocompleteRequest = {
        field,
        current_line: currentValue,
        job_title: jobTitle,
        context,
        tone: tone as any,
        seniority: seniority as any,
      };

      const response = await fetch('/api/autocomplete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      if (response.ok) {
        const data = await response.json();
        // Only set suggestion if it's different from what user typed
        if (data.suggestion && !currentValue.toLowerCase().includes(data.suggestion.toLowerCase())) {
          setSuggestion(data.suggestion || '');
        } else {
          setSuggestion('');
        }
      } else {
        setSuggestion('');
      }
    } catch (error) {
      console.error('Autocomplete error:', error);
      setSuggestion('');
    } finally {
      setIsLoading(false);
    }
  }, 600);

  useEffect(() => {
    fetchSuggestion(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, jobTitle, context, tone, seniority]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab' && suggestion) {
      e.preventDefault();
      onChange(value + (value.endsWith(' ') ? '' : ' ') + suggestion);
      setSuggestion('');
    }
  };

  return (
    <span className="relative inline-flex w-full min-w-0 items-center">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setSuggestion('');
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn('text-gray-900 flex-1 min-w-0 bg-transparent', className)}
      />
      {suggestion && value && !value.endsWith(' ') && (
        <span className="pointer-events-none ml-1 text-gray-400 opacity-50">
          {suggestion}
        </span>
      )}
    </span>
  );
}
