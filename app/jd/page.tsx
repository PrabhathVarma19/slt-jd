'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import RoleBriefPanel from '@/components/jd-creator/RoleBriefPanel';
import JDPreview from '@/components/jd-creator/JDPreview';
import { JDRecord, GenerateJDRequest } from '@/types/jd';
import { formatJDText } from '@/lib/utils';
import { useToast } from '@/lib/hooks/useToast';
import Button from '@/components/ui/button';

function JDContent() {
  const searchParams = useSearchParams();
  const [jd, setJd] = useState<JDRecord | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast, ToastContainer } = useToast();

  // Load JD from query param if present
  useEffect(() => {
    const jdId = searchParams?.get('jd');
    if (jdId) {
      fetch(`/api/jds/${jdId}`)
        .then((res) => res.json())
        .then((data) => setJd(data))
        .catch((err) => console.error('Failed to load JD:', err));
    }
  }, [searchParams]);

  const handleGenerate = async (params: GenerateJDRequest) => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/generate-jd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate JD');
      }

      const data = await response.json();
      
      // Fetch the full JD record
      const jdResponse = await fetch(`/api/jds/${data.jd_id}`);
      if (jdResponse.ok) {
        const jdData = await jdResponse.json();
        setJd(jdData);
      } else {
        throw new Error('Failed to fetch generated JD');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      console.error('Generate JD error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async (editedSections?: { responsibilities: string[]; requiredSkills: string[]; preferredSkills: string[] }) => {
    if (!jd) return;

    // Use edited sections if provided, otherwise use original
    const sectionsToUse = editedSections
      ? {
          ...jd.sections,
          key_responsibilities: editedSections.responsibilities,
          required_skills: editedSections.requiredSkills,
          preferred_skills: editedSections.preferredSkills,
        }
      : jd.sections;

    const textToCopy = formatJDText(sectionsToUse);
    try {
      await navigator.clipboard.writeText(textToCopy);
      showToast('JD copied to clipboard', 'success');
    } catch (err) {
      console.error('Failed to copy:', err);
      showToast('Failed to copy JD', 'error');
    }
  };

  const handleRegenerate = async (editedSections?: { responsibilities: string[]; requiredSkills: string[]; preferredSkills: string[] }) => {
    if (!jd) return;

    setIsGenerating(true);
    setError(null);

    try {
      const params: GenerateJDRequest = {
        job_title: jd.job_title,
        context: jd.brief_context || undefined,
        tone: jd.tone as any,
        seniority: jd.seniority as any,
        length: jd.length as any,
      };

      // If edited sections provided, include them in context for regeneration
      if (editedSections) {
        params.edited_responsibilities = editedSections.responsibilities;
        params.edited_required_skills = editedSections.requiredSkills;
        params.edited_preferred_skills = editedSections.preferredSkills;
        console.log('Regenerating with edited content:', {
          responsibilities: editedSections.responsibilities.length,
          skills: editedSections.requiredSkills.length,
          preferredSkills: editedSections.preferredSkills.length
        });
      } else {
        console.log('Regenerating without edited content');
      }

      // Generate new JD content
      const response = await fetch('/api/generate-jd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to regenerate JD');
      }

      const data = await response.json();
      
      // Update the existing JD instead of creating a new one
      const updateResponse = await fetch(`/api/jds/${jd.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sections: data.sections,
          full_text: data.full_text,
        }),
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        throw new Error(errorData.error || 'Failed to update JD');
      }

      const updatedJd = await updateResponse.json();
      
      // Delete the newly created JD since we're updating the existing one
      if (data.jd_id !== jd.id) {
        try {
          await fetch(`/api/jds/${data.jd_id}`, {
            method: 'DELETE',
          });
        } catch (deleteError) {
          console.warn('Failed to delete temporary JD:', deleteError);
          // Non-critical error, continue
        }
      }
      
      console.log('Updated existing JD:', {
        jd_id: updatedJd.id,
        respCount: updatedJd.sections.key_responsibilities.length,
        skillsCount: updatedJd.sections.required_skills.length,
      });
      
      // Update the JD state with the updated data
      setJd(updatedJd);
      showToast('JD regenerated successfully', 'success');
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      console.error('Regenerate JD error:', err);
      showToast(err.message || 'Failed to regenerate JD', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <div className="mb-2">
        <Link
          href="/"
          className="inline-flex items-center text-xs font-medium text-blue-700 hover:underline"
        >
          ← Back to Home
        </Link>
      </div>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Beacon · Create JD
            </span>
            <h1 className="text-xl font-semibold text-gray-900 mt-1">Create Job Description</h1>
          </div>
          <Link href="/library">
            <Button variant="secondary" size="sm">
              My JDs
            </Button>
          </Link>
        </div>
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            {error}
          </div>
        )}
        <RoleBriefPanel onGenerate={handleGenerate} isGenerating={isGenerating} />
        <JDPreview jd={jd} onCopy={handleCopy} onRegenerate={handleRegenerate} />
      </div>
      <ToastContainer />
    </>
  );
}

export default function JDPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <JDContent />
    </Suspense>
  );
}
