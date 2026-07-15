'use client';

export default function TopNavBar() {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/82 via-black/55 to-transparent">
      <div className="flex items-center justify-between px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <div className="flex flex-1 items-center gap-4">
          <div className="relative text-sm font-semibold text-white">
            Practice
            <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-white" />
          </div>
        </div>
      </div>
    </div>
  );
}
