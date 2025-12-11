import { useState } from 'react';

/**
 * Hook for pitch deletion with error handling and user feedback
 */
export function usePitchActions() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deletePitch = async (pitchId: string): Promise<boolean> => {
    if (!window.confirm('Are you sure you want to delete this pitch? Your streak is safe.')) {
      return false;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/pitches/${pitchId}/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete pitch');
      }

      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete pitch';
      setError(errorMsg);
      console.error('Error deleting pitch:', err);
      return false;
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    deletePitch,
    isDeleting,
    error,
  };
}
