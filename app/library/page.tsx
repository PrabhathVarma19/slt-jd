'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import JDList from '@/components/library/JDList';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { formatJDText } from '@/lib/utils';
import { useToast } from '@/lib/hooks/useToast';

export default function LibraryPage() {
  const router = useRouter();
  const { showToast, ToastContainer } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [jdToDelete, setJdToDelete] = useState<string | null>(null);

  const handleOpenJD = (id: string) => {
    router.push(`/?jd=${id}`);
  };

  const handleCopyJD = async (id: string) => {
    try {
      const response = await fetch(`/api/jds/${id}`);
      if (response.ok) {
        const jd = await response.json();
        const textToCopy = formatJDText(jd.sections);
        await navigator.clipboard.writeText(textToCopy);
        showToast('JD copied to clipboard', 'success');
      } else {
        showToast('Failed to copy JD', 'error');
      }
    } catch (error) {
      console.error('Failed to copy JD:', error);
      showToast('Failed to copy JD', 'error');
    }
  };

  const handleDeleteJD = (id: string) => {
    setJdToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!jdToDelete) return;

    try {
      const response = await fetch(`/api/jds/${jdToDelete}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        showToast('JD deleted successfully', 'success');
        setDeleteDialogOpen(false);
        setJdToDelete(null);
        // Refresh the list by reloading the page or refetching
        window.location.reload();
      } else {
        const errorData = await response.json();
        showToast(errorData.error || 'Failed to delete JD', 'error');
        setDeleteDialogOpen(false);
        setJdToDelete(null);
      }
    } catch (error) {
      console.error('Failed to delete JD:', error);
      showToast('Failed to delete JD. Please try again.', 'error');
      setDeleteDialogOpen(false);
      setJdToDelete(null);
    }
  };

  const cancelDelete = () => {
    setDeleteDialogOpen(false);
    setJdToDelete(null);
  };

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">My JDs</h1>
          <p className="mt-1 text-sm text-gray-600">
            Reuse, edit, or share any JD you've generated.
          </p>
        </div>
        <JDList onOpenJD={handleOpenJD} onCopyJD={handleCopyJD} onDeleteJD={handleDeleteJD} />
      </div>
      
      <ConfirmDialog
        isOpen={deleteDialogOpen}
        title="Delete JD"
        message="Are you sure you want to delete this JD? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
      
      <ToastContainer />
    </>
  );
}

