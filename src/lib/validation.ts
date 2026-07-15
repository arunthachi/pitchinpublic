import { z } from 'zod';

/**
 * Input validation schemas using Zod
 * Ensures all user inputs meet strict requirements before processing
 */

// Email validation - RFC 5322 simplified
export const emailSchema = z.string().email('Invalid email address').toLowerCase().trim();

// Phone validation - E.164 format support
// Accepts: +14155551212, 4155551212, +1 (415) 555-1212, etc.
export const phoneSchema = z
  .string()
  .refine(
    (val) => {
      const digitsOnly = val.replace(/\D/g, '');
      return digitsOnly.length >= 10 && digitsOnly.length <= 15;
    },
    {
      message: 'Phone number must be between 10 and 15 digits',
    }
  )
  .transform((val) => {
    // Normalize US early-access numbers to E.164 when users enter 10 digits.
    const digitsOnly = val.replace(/\D/g, '');
    if (digitsOnly.length === 10) {
      return `+1${digitsOnly}`;
    }
    return `+${digitsOnly}`;
  });

/**
 * Sign in validation
 * Accepts either email OR phone number
 */
export const signInSchema = z.union([
  z.object({
    email: emailSchema,
  }),
  z.object({
    phone: phoneSchema,
  }),
]);

export type SignInInput = z.infer<typeof signInSchema>;

/**
 * OTP verification validation
 */
export const otpSchema = z.object({
  code: z
    .string()
    .length(6, 'Code must be exactly 6 digits')
    .regex(/^\d+$/, 'Code must contain only numbers'),
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
});

export type OtpInput = z.infer<typeof otpSchema>;

/**
 * Profile validation
 */
export const profileSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name must be at most 100 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'Full name can only contain letters, spaces, hyphens, and apostrophes'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-z0-9_-]+$/, 'Username can only contain lowercase letters, numbers, hyphens, and underscores')
    .optional()
    .or(z.literal('')),
  bio: z.string().max(160, 'Bio must be at most 160 characters').optional().or(z.literal('')),
  website: z.string().url('Invalid website URL').optional().or(z.literal('')),
  twitterHandle: z
    .string()
    .regex(/^[a-zA-Z0-9_]{1,15}$/, 'Invalid Twitter handle')
    .optional()
    .or(z.literal('')),
  linkedinUrl: z.string().url('Invalid LinkedIn URL').optional().or(z.literal('')),
});

export type ProfileInput = z.infer<typeof profileSchema>;

/**
 * Profile edit validation (similar to profile but all optional)
 */
export const profileEditSchema = z.object({
  bio: z.string().max(160, 'Bio must be at most 160 characters').nullable().optional(),
  website: z.string().url('Invalid website URL').nullable().optional(),
  twitterHandle: z
    .string()
    .regex(/^[a-zA-Z0-9_]{1,15}$/, 'Invalid Twitter handle')
    .nullable()
    .optional(),
  linkedinUrl: z.string().url('Invalid LinkedIn URL').nullable().optional(),
});

export type ProfileEditInput = z.infer<typeof profileEditSchema>;

/**
 * Video upload validation
 */
export const videoUploadSchema = z.object({
  maxDurationSeconds: z
    .number()
    .min(1, 'Duration must be at least 1 second')
    .max(180, 'Pitch videos must be at most 3 minutes')
    .default(60),
});

export type VideoUploadInput = z.infer<typeof videoUploadSchema>;

/**
 * Pitch creation validation
 */
export const pitchSchema = z.object({
  companyId: z.string().uuid('Invalid company ID').optional().nullable(),
  startupName: z
    .string()
    .min(2, 'Startup name must be at least 2 characters')
    .max(120, 'Startup name must be at most 120 characters')
    .trim()
    .optional(),
  oneLinePitch: z
    .string()
    .min(10, 'One-line pitch must be at least 10 characters')
    .max(280, 'One-line pitch must be at most 280 characters')
    .trim()
    .optional(),
  feedbackAsk: z
    .string()
    .min(4, 'Feedback ask must be specific enough to guide builders')
    .max(220, 'Feedback ask must be at most 220 characters')
    .trim()
    .optional(),
  extraContext: z
    .string()
    .max(800, 'Extra context must be at most 800 characters')
    .trim()
    .optional()
    .or(z.literal('')),
  hook: z
    .string()
    .min(10, 'Hook must be at least 10 characters')
    .max(280, 'Hook must be at most 280 characters')
    .trim(),
  description: z
    .string()
    .max(2000, 'Description must be at most 2000 characters')
    .trim()
    .optional()
    .or(z.literal('')),
  videoId: z.string().min(1, 'Video ID is required').trim(),
  playbackUrl: z.string().url('Invalid playback URL'),
  videoProvider: z.string().min(1, 'Video provider is required').trim().optional(),
  thumbnailUrl: z.string().url('Invalid thumbnail URL').optional().or(z.literal('')),
  duration: z.number().min(30, 'Video must be at least 30 seconds').max(180, 'Video must be at most 3 minutes'),
  practiceGoalId: z.string().uuid('Invalid practice goal ID').optional().nullable(),
  promptKey: z.string().min(2).max(80).optional(),
  promptText: z.string().min(2).max(500).optional(),
});

export type PitchInput = z.infer<typeof pitchSchema>;

/**
 * Helper function to safely validate and parse user input
 * Returns { success, data, errors }
 */
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): {
  success: boolean;
  data: T | null;
  errors: Record<string, string[]> | null;
} {
  const result = schema.safeParse(data);

  if (result.success) {
    return {
      success: true,
      data: result.data,
      errors: null,
    };
  }

  // Format Zod errors into a user-friendly object
  const errors: Record<string, string[]> = {};
  result.error.issues.forEach((issue) => {
    const path = issue.path.join('.');
    if (!errors[path]) {
      errors[path] = [];
    }
    errors[path].push(issue.message);
  });

  return {
    success: false,
    data: null,
    errors,
  };
}

/**
 * Get the first error message from validation errors
 * Useful for showing a single error in UI
 */
export function getFirstError(errors: Record<string, string[]> | null): string | null {
  if (!errors) return null;

  for (const key in errors) {
    if (errors[key].length > 0) {
      return errors[key][0];
    }
  }

  return null;
}
