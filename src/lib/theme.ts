/**
 * Centralized Theme Configuration for Pitch in Public
 *
 * This file contains all brand colors, gradients, typography, and styling constants
 * to ensure consistency across the application.
 *
 * USAGE GUIDE:
 * ============
 *
 * Brand Colors (Tailwind classes):
 * - Primary gradient: bg-gradient-to-r from-neon-cyan to-neon-lime
 * - Cyan accent: text-neon-cyan, bg-neon-cyan, border-neon-cyan
 * - Lime accent: text-neon-lime, bg-neon-lime, border-neon-lime
 * - Roast red: text-roast, bg-roast, text-roast-light, bg-roast-light
 * - Toast green: text-toast, bg-toast, text-toast-light, bg-toast-light
 *
 * Typography:
 * - Headings: font-heading (Space Grotesk)
 * - Body: font-body (Inter)
 *
 * Component Patterns:
 * - Primary buttons: Use components.button.primary or getButtonClass('primary')
 * - Glass cards: Use components.card.glass
 * - Text gradient: Use components.text.gradient for gradient text
 *
 * Example:
 * ```tsx
 * import { getGradientClass, getButtonClass } from '@/lib/theme';
 *
 * <button className={`px-4 py-2 rounded-lg ${getButtonClass('primary')}`}>
 *   Click me
 * </button>
 * ```
 */

// Brand Colors
export const colors = {
  // Primary brand colors
  neon: {
    cyan: '#00F0FF',
    lime: '#CCFF00',
  },

  // Action colors
  roast: {
    default: '#FF3B30',
    light: '#FF6B60',
  },
  toast: {
    default: '#34C759',
    light: '#64D779',
  },

  // Neutral colors
  dark: {
    950: '#0a0a0a',
    900: '#1a1a1a',
    800: '#2a2a2a',
  },

  // State colors
  notification: '#FF3B30',
} as const;

// Brand Gradients
export const gradients = {
  // Primary brand gradient (cyan to lime)
  primary: 'linear-gradient(135deg, #00F0FF 0%, #CCFF00 100%)',
  primaryCss: 'from-neon-cyan to-neon-lime',

  // Alternate gradient
  alternate: 'linear-gradient(135deg, #CCFF00 0%, #00F0FF 100%)',
  alternateCss: 'from-neon-lime to-neon-cyan',

  // Video overlay gradients
  overlayBottom: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)',
  overlayTop: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)',
} as const;

// Typography
export const typography = {
  fonts: {
    heading: 'var(--font-space-grotesk), sans-serif',
    body: 'var(--font-inter), sans-serif',
  },

  sizes: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem', // 36px
  },
} as const;

// Component-specific styles (reusable classes)
export const components = {
  // Buttons
  button: {
    primary: 'bg-gradient-to-r from-neon-cyan to-neon-lime text-slate-900 font-bold hover:shadow-lg hover:shadow-neon-cyan/50 transition-all',
    secondary: 'bg-slate-800 text-white hover:bg-slate-700 transition-colors',
    ghost: 'bg-transparent text-white hover:bg-white/10 transition-colors',
  },

  // Cards
  card: {
    glass: 'bg-slate-900/80 backdrop-blur-md border border-slate-700',
    dark: 'bg-slate-950 border border-slate-800',
  },

  // Navigation
  nav: {
    bottom: 'fixed bottom-0 left-0 right-0 z-50 bg-black border-t border-white/10',
    top: 'fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/60 to-transparent',
  },

  // Text styles
  text: {
    gradient: 'bg-gradient-to-r from-neon-cyan to-neon-lime bg-clip-text text-transparent',
  },
} as const;

// Border radius
export const borderRadius = {
  sm: '0.25rem',   // 4px
  md: '0.5rem',    // 8px
  lg: '0.75rem',   // 12px
  xl: '1rem',      // 16px
  '2xl': '1.5rem', // 24px
  full: '9999px',
} as const;

// Shadows
export const shadows = {
  glow: {
    cyan: '0 0 20px rgba(0, 240, 255, 0.3), 0 0 40px rgba(0, 240, 255, 0.1)',
    lime: '0 0 20px rgba(204, 255, 0, 0.3), 0 0 40px rgba(204, 255, 0, 0.1)',
    primary: '0 0 30px rgba(0, 240, 255, 0.5), 0 0 60px rgba(0, 240, 255, 0.2)',
  },
} as const;

// Z-index layers
export const zIndex = {
  base: 1,
  dropdown: 10,
  sticky: 20,
  overlay: 30,
  modal: 40,
  popover: 50,
  toast: 60,
  tooltip: 70,
} as const;

// Export helper functions
export const getGradientClass = (type: 'primary' | 'alternate' = 'primary') => {
  return type === 'primary' ? gradients.primaryCss : gradients.alternateCss;
};

export const getButtonClass = (variant: 'primary' | 'secondary' | 'ghost' = 'primary') => {
  return components.button[variant];
};
