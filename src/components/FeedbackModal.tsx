'use client';

import React, { useState } from 'react';
import { QuickFeedbackPanel } from '@/components/QuickFeedbackPanel';
import { Button } from '@/components/ui/button';
import type { FeedbackFormData } from '@/types';

interface FeedbackModalProps {
  pitchId: string;
  onSubmit: (feedback: FeedbackFormData) => Promise<void> | void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerLabel?: string;
  hideTrigger?: boolean;
}

/** Keep assigned reviews and feed feedback on the same structured workflow. */
export function FeedbackModal({
  onSubmit,
  open: controlledOpen,
  onOpenChange,
  triggerLabel = 'Leave Feedback',
  hideTrigger = false,
}: FeedbackModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };

  return (
    <>
      {!hideTrigger ? (
        <Button
          type="button"
          size="lg"
          className="font-heading text-base font-bold"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          {triggerLabel}
        </Button>
      ) : null}
      <QuickFeedbackPanel
        isOpen={open}
        onClose={() => setOpen(false)}
        onSubmit={onSubmit}
      />
    </>
  );
}
