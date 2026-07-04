'use client';

import React from 'react';

interface BrandMarkProps {
  className?: string;
}

export function BrandMark({ className = 'h-10 w-10' }: BrandMarkProps) {
  const gradientId = React.useId();

  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Pitch in Public"
      fill="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00E6F6" />
          <stop offset="1" stopColor="#B7FF2A" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${gradientId})`} />
      <text
        x="32"
        y="41"
        textAnchor="middle"
        fill="#020617"
        fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
        fontSize="30"
        fontWeight="950"
        letterSpacing="-1.5"
      >
        PiP
      </text>
      <circle cx="32" cy="18" r="4.5" fill="#F8FAFC" />
      <path d="M31 16.2v3.6l3.2-1.8-3.2-1.8z" fill="#020617" />
    </svg>
  );
}
