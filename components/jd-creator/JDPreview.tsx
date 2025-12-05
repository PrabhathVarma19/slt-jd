'use client';

import { useState, useEffect, useRef } from 'react';
import Button from '@/components/ui/button';
import Chip from '@/components/ui/chip';
import Textarea from '@/components/ui/textarea';
import { JDRecord, Tone, Seniority, AutocompleteRequest } from '@/types/jd';
import { formatDate, debounce } from '@/lib/utils';

interface JDPreviewProps {
  jd: JDRecord | null;
  onCopy: (sections?: { responsibilities: string[]; requiredSkills: string[] }) => void;
  onRegenerate?: (sections?: { responsibilities: string[]; requiredSkills: string[] }) => void;
}

export default function JDPreview({ jd, onCopy, onRegenerate }: JDPreviewProps) {
  const [editableSections, setEditableSections] = useState<{
    responsibilities: string[];
    requiredSkills: string[];
  } | null>(null);
  const [rawResponsibilitiesText, setRawResponsibilitiesText] = useState('');
  const [rawRequiredSkillsText, setRawRequiredSkillsText] = useState('');
  const [responsibilitiesSuggestion, setResponsibilitiesSuggestion] = useState('');
  const [requiredSkillsSuggestion, setRequiredSkillsSuggestion] = useState('');
  const [isResponsibilitiesFocused, setIsResponsibilitiesFocused] = useState(false);
  const [isRequiredSkillsFocused, setIsRequiredSkillsFocused] = useState(false);
  const responsibilitiesTextareaRef = useRef<HTMLTextAreaElement>(null);
  const requiredSkillsTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (jd) {
      const responsibilities = [...jd.sections.key_responsibilities];
      const requiredSkills = [...jd.sections.required_skills];
      setEditableSections({
        responsibilities,
        requiredSkills,
      });
      // Initialize raw text with bullets
      setRawResponsibilitiesText(
        responsibilities.map(r => {
          const trimmed = r.trim();
          return trimmed.startsWith('•') ? trimmed : `• ${trimmed}`;
        }).join('\n')
      );
      setRawRequiredSkillsText(
        requiredSkills.map(s => {
          const trimmed = s.trim();
          return trimmed.startsWith('•') ? trimmed : `• ${trimmed}`;
        }).join('\n')
      );
    } else {
      setEditableSections(null);
      setRawResponsibilitiesText('');
      setRawRequiredSkillsText('');
    }
  }, [jd]);

  // Autocomplete for responsibilities
  const fetchResponsibilitiesSuggestion = debounce(async (currentLine: string) => {
    if (!jd || !isResponsibilitiesFocused) {
      setResponsibilitiesSuggestion('');
      return;
    }
    
    const trimmed = currentLine.trim();
    // Only fetch if there's meaningful text (at least 2 characters) and not ending with space
    if (!trimmed || trimmed.length < 2 || currentLine.endsWith(' ')) {
      setResponsibilitiesSuggestion('');
      return;
    }

    try {
      const request: AutocompleteRequest = {
        field: 'responsibility',
        current_line: currentLine.replace(/^•\s*/, '').trim(),
        job_title: jd.job_title,
        context: jd.brief_context || undefined,
        tone: jd.tone,
        seniority: jd.seniority,
      };

      const response = await fetch('/api/autocomplete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.suggestion && !currentLine.toLowerCase().includes(data.suggestion.toLowerCase())) {
          setResponsibilitiesSuggestion(data.suggestion || '');
        } else {
          setResponsibilitiesSuggestion('');
        }
      } else {
        setResponsibilitiesSuggestion('');
      }
    } catch (error) {
      console.error('Autocomplete error:', error);
      setResponsibilitiesSuggestion('');
    }
  }, 600);

  // Autocomplete for required skills
  const fetchRequiredSkillsSuggestion = debounce(async (currentLine: string) => {
    if (!jd || !isRequiredSkillsFocused) {
      setRequiredSkillsSuggestion('');
      return;
    }
    
    const trimmed = currentLine.trim();
    // Only fetch if there's meaningful text (at least 2 characters) and not ending with space
    if (!trimmed || trimmed.length < 2 || currentLine.endsWith(' ')) {
      setRequiredSkillsSuggestion('');
      return;
    }

    try {
      const request: AutocompleteRequest = {
        field: 'skill',
        current_line: currentLine.replace(/^•\s*/, '').trim(),
        job_title: jd.job_title,
        context: jd.brief_context || undefined,
        tone: jd.tone,
        seniority: jd.seniority,
      };

      const response = await fetch('/api/autocomplete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.suggestion && !currentLine.toLowerCase().includes(data.suggestion.toLowerCase())) {
          setRequiredSkillsSuggestion(data.suggestion || '');
        } else {
          setRequiredSkillsSuggestion('');
        }
      } else {
        setRequiredSkillsSuggestion('');
      }
    } catch (error) {
      console.error('Autocomplete error:', error);
      setRequiredSkillsSuggestion('');
    }
  }, 600);

  // Update autocomplete suggestions when text changes
  useEffect(() => {
    if (isResponsibilitiesFocused && jd) {
      const lines = rawResponsibilitiesText.split('\n');
      const currentLine = lines[lines.length - 1] || '';
      fetchResponsibilitiesSuggestion(currentLine);
    } else {
      setResponsibilitiesSuggestion('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawResponsibilitiesText, isResponsibilitiesFocused, jd?.job_title, jd?.brief_context, jd?.tone, jd?.seniority]);

  useEffect(() => {
    if (isRequiredSkillsFocused && jd) {
      const lines = rawRequiredSkillsText.split('\n');
      const currentLine = lines[lines.length - 1] || '';
      fetchRequiredSkillsSuggestion(currentLine);
    } else {
      setRequiredSkillsSuggestion('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawRequiredSkillsText, isRequiredSkillsFocused, jd?.job_title, jd?.brief_context, jd?.tone, jd?.seniority]);

  if (!jd) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-16 text-center">
        <p className="text-base font-medium text-gray-900">Generated JD will appear here</p>
        <p className="mt-1 text-sm text-gray-500">Fill in the form above and click "Generate JD"</p>
      </div>
    );
  }

  // Check if changes were made
  const hasChanges = () => {
    if (!jd || !editableSections) return false;
    const originalResps = jd.sections.key_responsibilities.join('\n');
    const editedResps = editableSections.responsibilities.join('\n');
    const originalSkills = jd.sections.required_skills.join('\n');
    const editedSkills = editableSections.requiredSkills.join('\n');
    return originalResps !== editedResps || originalSkills !== editedSkills;
  };

  // Update responsibilities text (preserve user input, add bullets if missing)
  const updateResponsibilities = (text: string) => {
    setRawResponsibilitiesText(text);
    // Process and update editable sections
    const lines = text.split('\n');
    const processedLines = lines.map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      return trimmed.startsWith('•') ? trimmed.replace(/^•\s*/, '') : trimmed;
    }).filter(line => line.length > 0);
    
    if (editableSections) {
      setEditableSections({
        ...editableSections,
        responsibilities: processedLines,
      });
    }
  };

  // Update required skills text (preserve user input, add bullets if missing)
  const updateRequiredSkills = (text: string) => {
    setRawRequiredSkillsText(text);
    // Process and update editable sections
    const lines = text.split('\n');
    const processedLines = lines.map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      return trimmed.startsWith('•') ? trimmed.replace(/^•\s*/, '') : trimmed;
    }).filter(line => line.length > 0);
    
    if (editableSections) {
      setEditableSections({
        ...editableSections,
        requiredSkills: processedLines,
      });
    }
  };

  // Handle Enter key to auto-add bullet points
  const handleResponsibilitiesKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab' && responsibilitiesSuggestion) {
      e.preventDefault();
      const textarea = e.currentTarget;
      const cursorPosition = textarea.selectionStart;
      const textBeforeCursor = rawResponsibilitiesText.substring(0, cursorPosition);
      const textAfterCursor = rawResponsibilitiesText.substring(cursorPosition);
      const linesBefore = textBeforeCursor.split('\n');
      const currentLine = linesBefore[linesBefore.length - 1];
      const newLine = currentLine + (currentLine.endsWith(' ') ? '' : ' ') + responsibilitiesSuggestion;
      const newText = textBeforeCursor.substring(0, textBeforeCursor.length - currentLine.length) + newLine + textAfterCursor;
      setRawResponsibilitiesText(newText);
      updateResponsibilities(newText);
      setResponsibilitiesSuggestion('');
      
      setTimeout(() => {
        if (responsibilitiesTextareaRef.current) {
          const newPosition = cursorPosition + responsibilitiesSuggestion.length + 1;
          responsibilitiesTextareaRef.current.selectionStart = newPosition;
          responsibilitiesTextareaRef.current.selectionEnd = newPosition;
          responsibilitiesTextareaRef.current.focus();
        }
      }, 0);
      return;
    }

    if (e.key === 'Enter') {
      const textarea = e.currentTarget;
      const cursorPosition = textarea.selectionStart;
      const textBeforeCursor = rawResponsibilitiesText.substring(0, cursorPosition);
      const textAfterCursor = rawResponsibilitiesText.substring(cursorPosition);
      const linesBefore = textBeforeCursor.split('\n');
      const currentLine = linesBefore[linesBefore.length - 1];
      
      // Always add bullet on new line
      const newText = textBeforeCursor + '\n• ' + textAfterCursor;
      setRawResponsibilitiesText(newText);
      updateResponsibilities(newText);
      
      // Set cursor position after the bullet
      setTimeout(() => {
        if (responsibilitiesTextareaRef.current) {
          const newPosition = cursorPosition + 3;
          responsibilitiesTextareaRef.current.selectionStart = newPosition;
          responsibilitiesTextareaRef.current.selectionEnd = newPosition;
          responsibilitiesTextareaRef.current.focus();
        }
      }, 0);
      e.preventDefault();
    }
  };

  const handleRequiredSkillsKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab' && requiredSkillsSuggestion) {
      e.preventDefault();
      const textarea = e.currentTarget;
      const cursorPosition = textarea.selectionStart;
      const textBeforeCursor = rawRequiredSkillsText.substring(0, cursorPosition);
      const textAfterCursor = rawRequiredSkillsText.substring(cursorPosition);
      const linesBefore = textBeforeCursor.split('\n');
      const currentLine = linesBefore[linesBefore.length - 1];
      const newLine = currentLine + (currentLine.endsWith(' ') ? '' : ' ') + requiredSkillsSuggestion;
      const newText = textBeforeCursor.substring(0, textBeforeCursor.length - currentLine.length) + newLine + textAfterCursor;
      setRawRequiredSkillsText(newText);
      updateRequiredSkills(newText);
      setRequiredSkillsSuggestion('');
      
      setTimeout(() => {
        if (requiredSkillsTextareaRef.current) {
          const newPosition = cursorPosition + requiredSkillsSuggestion.length + 1;
          requiredSkillsTextareaRef.current.selectionStart = newPosition;
          requiredSkillsTextareaRef.current.selectionEnd = newPosition;
          requiredSkillsTextareaRef.current.focus();
        }
      }, 0);
      return;
    }

    if (e.key === 'Enter') {
      const textarea = e.currentTarget;
      const cursorPosition = textarea.selectionStart;
      const textBeforeCursor = rawRequiredSkillsText.substring(0, cursorPosition);
      const textAfterCursor = rawRequiredSkillsText.substring(cursorPosition);
      
      // Always add bullet on new line
      const newText = textBeforeCursor + '\n• ' + textAfterCursor;
      setRawRequiredSkillsText(newText);
      updateRequiredSkills(newText);
      
      // Set cursor position after the bullet
      setTimeout(() => {
        if (requiredSkillsTextareaRef.current) {
          const newPosition = cursorPosition + 3;
          requiredSkillsTextareaRef.current.selectionStart = newPosition;
          requiredSkillsTextareaRef.current.selectionEnd = newPosition;
          requiredSkillsTextareaRef.current.focus();
        }
      }, 0);
      e.preventDefault();
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-5 lg:px-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
          <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-gray-900">{jd.job_title}</h1>
          
          {/* Right side: Chips + Action Buttons */}
          <div className="flex items-center gap-3 lg:gap-4 flex-shrink-0 flex-wrap">
            {/* Chips */}
            <div className="flex items-center gap-2">
              <Chip selected={false} className="cursor-default text-xs">
                {jd.tone.charAt(0).toUpperCase() + jd.tone.slice(1)}
              </Chip>
              <span className="text-gray-400">·</span>
              <Chip selected={false} className="cursor-default text-xs">
                {jd.seniority.charAt(0).toUpperCase() + jd.seniority.slice(1)}
              </Chip>
              <span className="text-gray-400">·</span>
              <Chip selected={false} className="cursor-default text-xs">
                {jd.length.charAt(0).toUpperCase() + jd.length.slice(1)}
              </Chip>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-2 border-l border-gray-200 pl-4">
              <Button 
                onClick={() => onCopy(editableSections || undefined)} 
                size="sm"
                title="Copy JD"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </Button>
              {onRegenerate && (
                <Button 
                  onClick={() => {
                    // Read directly from textarea DOM to get absolute latest value
                    const respTextarea = responsibilitiesTextareaRef.current;
                    const skillsTextarea = requiredSkillsTextareaRef.current;
                    
                    const respText = respTextarea?.value || rawResponsibilitiesText;
                    const skillsText = skillsTextarea?.value || rawRequiredSkillsText;
                    
                    // Process: strip bullets and filter empty lines
                    const currentResps = respText
                      .split('\n')
                      .map(line => line.trim().replace(/^•\s*/, '').trim())
                      .filter(line => line.length > 0);
                    const currentSkills = skillsText
                      .split('\n')
                      .map(line => line.trim().replace(/^•\s*/, '').trim())
                      .filter(line => line.length > 0);
                    
                    // Compare with original to detect changes
                    const originalResps = jd.sections.key_responsibilities.join('\n');
                    const editedResps = currentResps.join('\n');
                    const originalSkills = jd.sections.required_skills.join('\n');
                    const editedSkills = currentSkills.join('\n');
                    
                    const hasEdits = originalResps !== editedResps || originalSkills !== editedSkills;
                    
                    console.log('Regenerating with:', {
                      hasEdits,
                      respCount: currentResps.length,
                      skillsCount: currentSkills.length,
                      sampleResp: currentResps[0]?.substring(0, 50)
                    });
                    
                    onRegenerate(hasEdits ? { responsibilities: currentResps, requiredSkills: currentSkills } : undefined);
                  }} 
                  variant="secondary"
                  size="sm"
                  title={hasChanges() ? 'Regenerate with Changes' : 'Regenerate'}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-8">
        <div className="space-y-10">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Job Summary</h2>
          <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{jd.sections.summary}</p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Key Responsibilities
          </h2>
          <div className="relative">
            <Textarea
              ref={responsibilitiesTextareaRef}
              value={rawResponsibilitiesText}
              onChange={(e) => {
                const newValue = e.target.value;
                setRawResponsibilitiesText(newValue);
                updateResponsibilities(newValue);
                // Don't clear suggestion here - let useEffect handle it
              }}
              onKeyDown={handleResponsibilitiesKeyDown}
              onFocus={() => setIsResponsibilitiesFocused(true)}
              onBlur={(e) => {
                setIsResponsibilitiesFocused(false);
                // Format with bullets on blur - ensure all non-empty lines have bullets
                const lines = e.target.value.split('\n');
                const formatted = lines.map(line => {
                  const trimmed = line.trim();
                  if (!trimmed) return '';
                  return trimmed.startsWith('•') ? trimmed : `• ${trimmed}`;
                }).join('\n');
                setRawResponsibilitiesText(formatted);
                setTimeout(() => setResponsibilitiesSuggestion(''), 200);
              }}
              placeholder="• Enter responsibilities, one per line..."
              rows={Math.max(8, (rawResponsibilitiesText.split('\n').length || 1) + 2)}
              className="w-full font-normal"
            />
            {responsibilitiesSuggestion && isResponsibilitiesFocused && (
              <div className="mt-2 rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-gray-700">
                <span className="font-medium">Suggestion:</span>{' '}
                <span className="text-blue-700 font-medium">{responsibilitiesSuggestion}</span>
                {' '}
                <span className="text-gray-500">(Press <kbd className="px-1.5 py-0.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded">Tab</kbd> to accept)</span>
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-gray-500">Enter one responsibility per line (bullet points added automatically)</p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Required Skills & Qualifications
          </h2>
          <div className="relative">
            <Textarea
              ref={requiredSkillsTextareaRef}
              value={rawRequiredSkillsText}
              onChange={(e) => {
                const newValue = e.target.value;
                setRawRequiredSkillsText(newValue);
                updateRequiredSkills(newValue);
                // Don't clear suggestion here - let useEffect handle it
              }}
              onKeyDown={handleRequiredSkillsKeyDown}
              onFocus={() => setIsRequiredSkillsFocused(true)}
              onBlur={(e) => {
                setIsRequiredSkillsFocused(false);
                // Format with bullets on blur - ensure all non-empty lines have bullets
                const lines = e.target.value.split('\n');
                const formatted = lines.map(line => {
                  const trimmed = line.trim();
                  if (!trimmed) return '';
                  return trimmed.startsWith('•') ? trimmed : `• ${trimmed}`;
                }).join('\n');
                setRawRequiredSkillsText(formatted);
                setTimeout(() => setRequiredSkillsSuggestion(''), 200);
              }}
              placeholder="• Enter skills, one per line..."
              rows={Math.max(8, (rawRequiredSkillsText.split('\n').length || 1) + 2)}
              className="w-full font-normal"
            />
            {requiredSkillsSuggestion && isRequiredSkillsFocused && (
              <div className="mt-2 rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-gray-700">
                <span className="font-medium">Suggestion:</span>{' '}
                <span className="text-blue-700 font-medium">{requiredSkillsSuggestion}</span>
                {' '}
                <span className="text-gray-500">(Press <kbd className="px-1.5 py-0.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded">Tab</kbd> to accept)</span>
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-gray-500">Enter one skill per line (bullet points added automatically)</p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Preferred Skills</h2>
          <ul className="list-disc list-inside space-y-2 text-gray-700 leading-relaxed">
            {jd.sections.preferred_skills.map((skill, index) => (
              <li key={index}>{skill}</li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Behavioral Competencies
          </h2>
          <ul className="list-disc list-inside space-y-2 text-gray-700 leading-relaxed">
            {jd.sections.behavioral_competencies.map((comp, index) => (
              <li key={index}>{comp}</li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">About Trianz</h2>
          <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{jd.sections.about_company}</p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Diversity & Inclusion Statement
          </h2>
          <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{jd.sections.diversity_statement}</p>
        </section>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm text-gray-600">
            <svg className="h-4 w-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Saved to your library
          </span>
          <a
            href="/library"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            Go to My JDs →
          </a>
        </div>
      </div>
    </div>
  );
}

