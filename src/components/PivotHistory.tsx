'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { PitchVersion } from '@/types';

interface PivotHistoryProps {
  versions: PitchVersion[];
}

export function PivotHistory({ versions }: PivotHistoryProps) {
  if (!versions || versions.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-heading font-bold text-slate-100">
        Pivot History
      </h3>
      <p className="text-sm text-slate-400 font-body">
        See how this pitch evolved over time
      </p>

      <div className="relative space-y-6 mt-6">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-roast via-neon-cyan to-neon-lime" />

        {versions.map((version, index) => {
          const isLatest = index === versions.length - 1;

          return (
            <motion.div
              key={version.version}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.15, duration: 0.4 }}
              className="relative pl-12"
            >
              {/* Timeline node */}
              <div
                className={`absolute left-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  isLatest
                    ? 'bg-neon-lime border-4 border-neon-lime/30 animate-glow-pulse'
                    : 'bg-slate-800 border-2 border-slate-700'
                }`}
              >
                {isLatest ? (
                  <CheckCircle2 className="w-4 h-4 text-slate-900" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-slate-600" />
                )}
              </div>

              {/* Content */}
              <div
                className={`p-4 rounded-lg border ${
                  isLatest
                    ? 'bg-neon-lime/5 border-neon-lime/30'
                    : 'bg-slate-900/50 border-slate-800'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`text-xs font-heading font-bold px-2 py-1 rounded ${
                      isLatest
                        ? 'bg-neon-lime text-slate-900'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {version.version}
                  </span>
                  <span className="text-xs text-slate-500 font-body">
                    {new Date(version.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                  {isLatest && (
                    <span className="text-xs font-bold text-neon-lime font-heading uppercase">
                      Current
                    </span>
                  )}
                </div>

                <p className="text-sm font-medium text-slate-200 mb-3 font-body leading-relaxed">
                  {version.hook}
                </p>

                {version.changes && version.changes.length > 0 && (
                  <div className="space-y-1 pt-2 border-t border-slate-800">
                    <p className="text-xs font-heading font-bold text-slate-400 uppercase tracking-wider">
                      Key Changes:
                    </p>
                    <ul className="space-y-1">
                      {version.changes.map((change, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-xs text-slate-400 font-body"
                        >
                          <ArrowRight className="w-3 h-3 mt-0.5 text-neon-cyan flex-shrink-0" />
                          <span>{change}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
