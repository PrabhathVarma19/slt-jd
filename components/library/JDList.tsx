'use client';

import { useState, useEffect } from 'react';
import Input from '@/components/ui/input';
import JDCard from './JDCard';
import { JDSummary } from '@/types/jd';

interface JDListProps {
  onOpenJD: (id: string) => void;
  onCopyJD: (id: string) => void;
  onDeleteJD: (id: string) => void;
}

export default function JDList({ onOpenJD, onCopyJD, onDeleteJD }: JDListProps) {
  const [jds, setJds] = useState<JDSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchJDs = async (query?: string) => {
    setIsLoading(true);
    try {
      const url = query
        ? `/api/jds?query=${encodeURIComponent(query)}`
        : '/api/jds';
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setJds(data);
      } else {
        console.error('Failed to fetch JDs');
      }
    } catch (error) {
      console.error('Error fetching JDs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJDs();
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchJDs(searchQuery || undefined);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  return (
    <div className="space-y-6">
      <div>
        <Input
          type="text"
          placeholder="Search by title or keywords…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full max-w-md"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-lg border border-gray-200 bg-gray-50"
            />
          ))}
        </div>
      ) : jds.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-12 text-center">
          <p className="text-sm text-gray-600">
            {searchQuery ? 'No JDs found matching your search' : 'No JDs yet. Generate your first JD!'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {jds.map((jd) => (
            <JDCard
              key={jd.jd_id}
              jd={jd}
              onOpen={onOpenJD}
              onCopy={onCopyJD}
              onDelete={onDeleteJD}
            />
          ))}
        </div>
      )}
    </div>
  );
}

