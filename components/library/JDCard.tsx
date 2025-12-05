'use client';

import Chip from '@/components/ui/chip';
import Button from '@/components/ui/button';
import { JDSummary } from '@/types/jd';
import { formatDate } from '@/lib/utils';

interface JDCardProps {
  jd: JDSummary;
  onOpen: (id: string) => void;
  onCopy: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function JDCard({ jd, onOpen, onCopy, onDelete }: JDCardProps) {
  return (
    <div className="group rounded-lg border border-gray-200 bg-white p-5 transition-colors hover:border-gray-300">
      <h3 className="mb-3 text-base font-semibold text-gray-900">{jd.job_title}</h3>
      
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Chip selected={false} className="cursor-default text-xs">
          {jd.tone.charAt(0).toUpperCase() + jd.tone.slice(1)}
        </Chip>
        <Chip selected={false} className="cursor-default text-xs">
          {jd.seniority.charAt(0).toUpperCase() + jd.seniority.slice(1)}
        </Chip>
        <Chip selected={false} className="cursor-default text-xs">
          {jd.length.charAt(0).toUpperCase() + jd.length.slice(1)}
        </Chip>
      </div>

      <p className="mb-4 text-sm text-gray-500">
        Created on {formatDate(jd.created_at)}
      </p>

      <div className="flex gap-2">
        <Button onClick={() => onOpen(jd.jd_id)} variant="primary" size="sm">
          Open
        </Button>
        <Button onClick={() => onCopy(jd.jd_id)} variant="secondary" size="sm">
          Copy JD
        </Button>
        <Button 
          onClick={() => onDelete(jd.jd_id)} 
          variant="ghost" 
          size="sm"
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          Delete
        </Button>
      </div>
    </div>
  );
}

