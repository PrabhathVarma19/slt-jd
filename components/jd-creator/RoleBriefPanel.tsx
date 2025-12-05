'use client';

import { useState, useEffect, useRef } from 'react';
import Input from '@/components/ui/input';
import Textarea from '@/components/ui/textarea';
import Button from '@/components/ui/button';
import Chip from '@/components/ui/chip';
import { Tone, Seniority, LengthOption } from '@/types/jd';
import { detectSeniorityFromTitle, debounce } from '@/lib/utils';

interface RoleBriefPanelProps {
  onGenerate: (params: {
    job_title: string;
    context?: string;
    tone: Tone;
    seniority: Seniority;
    length: LengthOption;
  }) => void;
  isGenerating: boolean;
}

export default function RoleBriefPanel({
  onGenerate,
  isGenerating,
}: RoleBriefPanelProps) {
  const [jobTitle, setJobTitle] = useState('');
  const [context, setContext] = useState('');
  const [tone, setTone] = useState<Tone>('standard');
  const [seniority, setSeniority] = useState<Seniority>('mid');
  const [length, setLength] = useState<LengthOption>('standard');
  const [jobTitleSuggestion, setJobTitleSuggestion] = useState('');
  const [isJobTitleFocused, setIsJobTitleFocused] = useState(false);
  const jobTitleInputRef = useRef<HTMLInputElement>(null);

  // Autocomplete for job title using AI
  const fetchJobTitleSuggestion = debounce(async (currentValue: string) => {
    if (!isJobTitleFocused || !currentValue.trim() || currentValue.length < 2) {
      setJobTitleSuggestion('');
      return;
    }

    try {
      const response = await fetch('/api/autocomplete-job-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partial_title: currentValue }),
      });

      if (response.ok) {
        const data = await response.json();
        const suggestion = data.suggestion?.trim() || '';
        
        // Filter out bad suggestions:
        // 1. Must have content
        // 2. Must be at least 1 character (allow single letters if they make sense)
        // 3. Should not be exactly the same as what's already typed
        // 4. Should not be a duplicate (if current value already ends with the suggestion)
        if (suggestion.length >= 1 && 
            suggestion.toLowerCase() !== currentValue.toLowerCase() &&
            !currentValue.toLowerCase().endsWith(suggestion.toLowerCase())) {
          setJobTitleSuggestion(suggestion);
        } else {
          setJobTitleSuggestion('');
        }
      } else {
        setJobTitleSuggestion('');
      }
    } catch (error) {
      console.error('Job title autocomplete error:', error);
      setJobTitleSuggestion('');
    }
  }, 500);

  useEffect(() => {
    if (isJobTitleFocused && jobTitle) {
      fetchJobTitleSuggestion(jobTitle);
    } else {
      setJobTitleSuggestion('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobTitle, isJobTitleFocused]);

  // Auto-detect seniority from job title
  useEffect(() => {
    if (jobTitle.trim()) {
      const detectedSeniority = detectSeniorityFromTitle(jobTitle);
      setSeniority(detectedSeniority);
    }
  }, [jobTitle]);

  const handleSubmit = () => {
    if (!jobTitle.trim()) return;
    onGenerate({
      job_title: jobTitle.trim(),
      context: context.trim() || undefined,
      tone,
      seniority,
      length,
    });
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-base font-semibold text-gray-900">Describe the Role</h2>
      </div>

      <div className="p-6">
        <div className="space-y-5">
          {/* Row 1: Job Title & Context */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Job Title <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Input
                  ref={jobTitleInputRef}
                  value={jobTitle}
                  onChange={(e) => {
                    setJobTitle(e.target.value);
                    // Don't clear suggestion here - let useEffect handle it
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Tab' && jobTitleSuggestion) {
                      e.preventDefault();
                      const input = e.currentTarget;
                      const cursorPosition = input.selectionStart ?? jobTitle.length;
                      const textBeforeCursor = jobTitle.substring(0, cursorPosition);
                      const textAfterCursor = jobTitle.substring(cursorPosition);
                      
                      // Safety check: Don't insert if suggestion would create duplicates or invalid text
                      const wouldCreateDuplicate = textBeforeCursor.toLowerCase().endsWith(jobTitleSuggestion.toLowerCase()) ||
                                                   textAfterCursor.toLowerCase().startsWith(jobTitleSuggestion.toLowerCase());
                      
                      if (wouldCreateDuplicate || jobTitleSuggestion.length < 2) {
                        setJobTitleSuggestion('');
                        return;
                      }
                      
                      // Store suggestion length before clearing
                      const suggestionLength = jobTitleSuggestion.length;
                      // Insert suggestion at cursor position
                      const newValue = textBeforeCursor + jobTitleSuggestion + textAfterCursor;
                      setJobTitle(newValue);
                      setJobTitleSuggestion('');
                      setTimeout(() => {
                        if (jobTitleInputRef.current) {
                          const newPosition = cursorPosition + suggestionLength;
                          jobTitleInputRef.current.selectionStart = newPosition;
                          jobTitleInputRef.current.selectionEnd = newPosition;
                          jobTitleInputRef.current.focus();
                        }
                      }, 0);
                    }
                  }}
                  onFocus={() => setIsJobTitleFocused(true)}
                  onBlur={() => {
                    setIsJobTitleFocused(false);
                    setTimeout(() => setJobTitleSuggestion(''), 200);
                  }}
                  placeholder="e.g. Senior Cloud Architect"
                  disabled={isGenerating}
                  className="w-full"
                />
                {jobTitleSuggestion && isJobTitleFocused && (
                  <div className="absolute left-0 top-full mt-2 z-10 rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-gray-700 shadow-sm">
                    <span className="font-medium">Suggestion:</span>{' '}
                    <span className="text-blue-700 font-medium">{jobTitleSuggestion}</span>
                    {' '}
                    <span className="text-gray-500">(Press <kbd className="px-1.5 py-0.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded">Tab</kbd> to accept)</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Context <span className="text-xs font-normal text-gray-500">(optional)</span>
              </label>
              <Input
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="e.g. For a banking client, leading cloud modernization..."
                disabled={isGenerating}
                className="w-full"
              />
            </div>
          </div>

          {/* Row 2: Tone, Seniority, Length */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Tone</label>
              <div className="flex flex-wrap gap-2">
                {(['standard', 'executive', 'technical', 'client-facing'] as Tone[]).map(
                  (t) => (
                    <Chip
                      key={t}
                      selected={tone === t}
                      onClick={() => setTone(t)}
                      disabled={isGenerating}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </Chip>
                  )
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Seniority</label>
              <div className="flex flex-wrap gap-2">
                {(['junior', 'mid', 'senior', 'lead', 'director+'] as Seniority[]).map(
                  (s) => (
                    <Chip
                      key={s}
                      selected={seniority === s}
                      onClick={() => setSeniority(s)}
                      disabled={isGenerating}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </Chip>
                  )
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Length</label>
              <div className="flex flex-wrap gap-2">
                {(['short', 'standard', 'detailed'] as LengthOption[]).map((l) => (
                  <Chip
                    key={l}
                    selected={length === l}
                    onClick={() => setLength(l)}
                    disabled={isGenerating}
                  >
                    {l.charAt(0).toUpperCase() + l.slice(1)}
                  </Chip>
                ))}
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <div className="pt-2">
            <Button
              onClick={handleSubmit}
              disabled={!jobTitle.trim() || isGenerating}
              className="w-full"
              size="lg"
            >
              {isGenerating ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Drafting JD…
                </span>
              ) : (
                'Generate JD'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

