'use client';

import { motion } from 'framer-motion';
import { Sparkles, Zap, TrendingUp } from 'lucide-react';

interface WelcomeHeroProps {
  onSignInClick?: () => void;
}

export function WelcomeHero({ onSignInClick }: WelcomeHeroProps) {
  return (
    <div className="relative w-full h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Animated gradient orbs */}
      <div className="absolute inset-0">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute top-1/4 -left-48 w-96 h-96 rounded-full bg-neon-cyan/20 blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 1,
          }}
          className="absolute bottom-1/4 -right-48 w-96 h-96 rounded-full bg-neon-lime/20 blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1, 1.4, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 2,
          }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-purple-500/10 blur-3xl"
        />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full px-4 text-center">
        {/* Logo/Icon */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
          className="mb-8"
        >
          <div className="relative">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-neon-cyan to-neon-lime flex items-center justify-center shadow-2xl shadow-neon-cyan/30">
              <svg className="w-14 h-14 text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
              className="absolute -inset-4 border-2 border-dashed border-neon-cyan/30 rounded-full"
            />
          </div>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-5xl md:text-7xl font-bold text-white font-heading mb-6 leading-tight"
        >
          Pitch in{' '}
          <span className="bg-gradient-to-r from-neon-cyan to-neon-lime bg-clip-text text-transparent">
            Public
          </span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="text-xl md:text-2xl text-slate-300 mb-12 max-w-2xl leading-relaxed"
        >
          Share your 60-second pitch. Get real feedback from founders, investors, and the startup community.
        </motion.p>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mb-16"
        >
          <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-slate-900/50 backdrop-blur-sm border border-slate-700/50">
            <div className="w-12 h-12 rounded-xl bg-neon-cyan/10 flex items-center justify-center">
              <Zap className="w-6 h-6 text-neon-cyan" />
            </div>
            <h3 className="text-white font-semibold">Instant Feedback</h3>
            <p className="text-slate-400 text-sm">
              Get roasted or toasted by the community
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-slate-900/50 backdrop-blur-sm border border-slate-700/50">
            <div className="w-12 h-12 rounded-xl bg-neon-lime/10 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-neon-lime" />
            </div>
            <h3 className="text-white font-semibold">Build in Public</h3>
            <p className="text-slate-400 text-sm">
              Iterate openly, grow your audience
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-slate-900/50 backdrop-blur-sm border border-slate-700/50">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-white font-semibold">Get Discovered</h3>
            <p className="text-slate-400 text-sm">
              Connect with founders, VCs & customers
            </p>
          </div>
        </motion.div>

        {/* CTA hint */}
        <motion.button
          onClick={onSignInClick}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="text-slate-400 hover:text-slate-300 text-lg font-medium cursor-pointer transition-colors"
        >
          Sign in above to get started →
        </motion.button>
      </div>

      {/* Bottom decorative element */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/50 to-transparent" />
    </div>
  );
}
