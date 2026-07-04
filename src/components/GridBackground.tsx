import React from 'react';

export function GridBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Dark gradient base */}
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#05070a,#090d14_48%,#05070a)]" />

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(0, 230, 246, 0.72) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0, 230, 246, 0.72) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Radial gradient spotlight effect */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[1000px] bg-neon-cyan/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-[800px] h-[800px] bg-neon-lime/5 rounded-full blur-3xl" />

      {/* Subtle vignette */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
    </div>
  );
}
