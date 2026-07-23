'use client';

import { ClipboardCheck } from 'lucide-react';

interface TopNavBarProps {
  onReviewerMode?: () => void;
}

export default function TopNavBar({ onReviewerMode }: TopNavBarProps) {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/82 via-black/55 to-transparent">
      <div className="flex items-center justify-between px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <div className="flex flex-1 items-center gap-4">
          <div className="relative text-sm font-semibold text-white">
            Practice
            <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-white" />
          </div>
        </div>
        {onReviewerMode ? (
          <button
            type="button"
            onClick={onReviewerMode}
            className="btn-glass flex min-h-11 items-center gap-2 px-3 text-xs font-bold text-slate-100"
            aria-label="Switch to trusted reviewer mode"
          >
            <ClipboardCheck className="h-4 w-4 text-neon-cyan" />
            Review
          </button>
        ) : null}
      </div>
    </div>
  );
}
