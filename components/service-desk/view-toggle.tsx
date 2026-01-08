'use client';

import { MessageSquare, FileText } from 'lucide-react';
import Button from '@/components/ui/button';

interface ViewToggleProps {
  value: 'chat' | 'form';
  onChange: (value: 'chat' | 'form') => void;
}

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
      <button
        type="button"
        onClick={() => onChange('chat')}
        className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
          value === 'chat'
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-gray-700 hover:bg-gray-50'
        }`}
      >
        <MessageSquare className="h-3.5 w-3.5" />
        Chat with Beacon
      </button>
      <button
        type="button"
        onClick={() => onChange('form')}
        className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
          value === 'form'
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-gray-700 hover:bg-gray-50'
        }`}
      >
        <FileText className="h-3.5 w-3.5" />
        Use Form
      </button>
    </div>
  );
}

