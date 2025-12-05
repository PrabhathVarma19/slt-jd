'use client';

import { useState, useRef, useEffect } from 'react';
import Textarea from '@/components/ui/textarea';
import { debounce } from '@/lib/utils';
import { AutocompleteRequest } from '@/types/jd';

interface EditableTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  field: 'responsibility' | 'skill';
  jobTitle: string;
  context?: string;
  tone: string;
  seniority: string;
  onDelete?: () => void;
}

export default function EditableTextarea({
  value,
  onChange,
  placeholder,
  field,
  jobTitle,
  context,
  tone,
  seniority,
  onDelete,
}: EditableTextareaProps) {
  const [suggestion, setSuggestion] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchSuggestion = debounce(async (currentValue: string) => {
    if (!currentValue.trim() || currentValue.endsWith(' ') || !isFocused) {
      setSuggestion('');
      return;
    }

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
    }
  }, 600);

  useEffect(() => {
    if (isFocused && value) {
      fetchSuggestion(value);
    } else {
      setSuggestion('');
    }
  }, [value, isFocused, jobTitle, context, tone, seniority]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab' && suggestion) {
      e.preventDefault();
      onChange(value + (value.endsWith(' ') ? '' : ' ') + suggestion);
      setSuggestion('');
    }
  };

  return (
    <div className="relative w-full">
      <div className="flex items-start gap-2">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setSuggestion('');
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            // Delay clearing suggestion to allow Tab key to work
            setTimeout(() => setSuggestion(''), 200);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={2}
          className="flex-1 resize-none text-gray-900"
        />
        {onDelete && (
          <button
            onClick={onDelete}
            className="mt-2 shrink-0 text-gray-400 hover:text-red-600 transition-colors"
            type="button"
          >
            ×
          </button>
        )}
      </div>
      {suggestion && isFocused && value && !value.endsWith(' ') && (
        <div className="mt-1 text-sm text-gray-400 italic">
          Press Tab to accept: <span className="text-gray-500">{suggestion}</span>
        </div>
      )}
    </div>
  );
}

