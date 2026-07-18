'use client';

import React, { useState } from 'react';
import { QuickFeedbackPanel } from '@/components/QuickFeedbackPanel';
import { Button } from '@/components/ui/button';
import type { FeedbackFormData } from '@/types';

interface FeedbackModalProps {
  pitchId: string;
  onSubmit: (feedback: FeedbackFormData) => Promise<void> | void;
}

/** Keep assigned reviews and feed feedback on the same structured workflow. */
export function FeedbackModal({ onSubmit }: FeedbackModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        size="lg"
        className="font-heading text-base font-bold"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        Leave Feedback
      </Button>
      <QuickFeedbackPanel
        isOpen={open}
        onClose={() => setOpen(false)}
        onSubmit={onSubmit}
      />
    </>
  );
}
