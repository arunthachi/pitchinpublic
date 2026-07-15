import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { rateLimit, getClientIp, RATE_LIMITS, formatRateLimitHeaders } from '@/lib/ratelimit';
import { emailSchema, phoneSchema } from '@/lib/validation';

/**
 * POST /api/auth/otp
 *
 * Send OTP (One-Time Password) via email or SMS.
 * MVP UI uses email OTP; phone remains server-side only until SMS is enabled.
 *
 * Rate Limited: 5 requests per minute per IP address
 *
 * Request body:
 * {
 *   "email": "user@example.com"  // OR
 *   "phone": "+1234567890"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "OTP sent to email@example.com",
 *   "method": "email",
 *   "provider": "supabase"
 * }
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  // Apply rate limiting: 5 requests per minute per IP
  const result = await rateLimit({
    key: ip,
    limit: RATE_LIMITS.OTP_SEND.limit,
    window: RATE_LIMITS.OTP_SEND.window,
  });

  // Check if rate limit exceeded
  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'Too many OTP requests. Please try again later.',
        retryAfter: result.retryAfter,
      },
      {
        status: 429, // Too Many Requests
        headers: formatRateLimitHeaders(result),
      }
    );
  }

  try {
    const body = await request.json();
    const { email, phone, next } = body;
    const nextPath = typeof next === 'string' && next.startsWith('/') && !next.startsWith('//')
      ? next
      : '/?auth=1';
    const callbackUrl = new URL('/auth/callback', request.nextUrl.origin);
    callbackUrl.searchParams.set('next', nextPath);

    // Validate input
    let method: 'email' | 'phone';
    let destination: string;

    if (email) {
      // Validate email
      const emailValidation = emailSchema.safeParse(email);
      if (!emailValidation.success) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid email address',
            details: emailValidation.error.errors,
          },
          {
            status: 400,
            headers: formatRateLimitHeaders(result),
          }
        );
      }
      method = 'email';
      destination = emailValidation.data;
    } else if (phone) {
      // Validate phone
      const phoneValidation = phoneSchema.safeParse(phone);
      if (!phoneValidation.success) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid phone number',
            details: phoneValidation.error.errors,
          },
          {
            status: 400,
            headers: formatRateLimitHeaders(result),
          }
        );
      }
      method = 'phone';
      destination = phoneValidation.data;
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Either email or phone must be provided',
        },
        {
          status: 400,
          headers: formatRateLimitHeaders(result),
        }
      );
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: 'Sign in is not available in this environment yet. Please try Google or LinkedIn, or try again later.',
          code: 'auth_not_configured',
        },
        {
          status: 503,
          headers: formatRateLimitHeaders(result),
        }
      );
    }

    // Create Supabase client
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: () => undefined,
          set: () => {},
          remove: () => {},
        },
      }
    );

    // Send OTP via Supabase Auth
    if (method === 'email') {
      const { error } = await supabase.auth.signInWithOtp({
        email: destination,
        options: {
          emailRedirectTo: callbackUrl.toString(),
          shouldCreateUser: true,
        },
      });

      if (error) {
        // Handle specific rate limit errors from Supabase
        if (error.message.includes('over_email_send_limit')) {
          return NextResponse.json(
            {
              success: false,
              error: 'Too many email requests. Please try again later.',
            },
            {
              status: 429,
              headers: formatRateLimitHeaders(result),
            }
          );
        }

        throw error;
      }

      return NextResponse.json(
        {
          success: true,
          message: `Code sent to ${destination}`,
          method: 'email',
          provider: 'supabase',
          destination: destination.replace(/(.{3})(.*)(@.*)/, '$1***$3'), // Mask email
        },
        {
          status: 200,
          headers: formatRateLimitHeaders(result),
        }
      );
    } else {
      // Phone OTP
      const { error } = await supabase.auth.signInWithOtp({
        phone: destination,
      });

      if (error) {
        // Handle specific rate limit errors from Supabase
        if (error.message.includes('over_sms_limit')) {
          return NextResponse.json(
            {
              success: false,
              error: 'Too many SMS requests. Please try again later.',
            },
            {
              status: 429,
              headers: formatRateLimitHeaders(result),
            }
          );
        }

        if (error.message.toLowerCase().includes('unsupported phone provider')) {
          return NextResponse.json(
            {
              success: false,
              error: 'Text message login is not available right now. Please try Google or LinkedIn, or try again later.',
              code: 'sms_provider_not_configured',
            },
            {
              status: 503,
              headers: formatRateLimitHeaders(result),
            }
          );
        }

        throw error;
      }

      return NextResponse.json(
        {
          success: true,
          message: `OTP sent to ${destination}`,
          method: 'phone',
          provider: 'supabase',
          destination: destination.replace(/(.{2})(.*)(.{2})/, '$1***$3'), // Mask phone
        },
        {
          status: 200,
          headers: formatRateLimitHeaders(result),
        }
      );
    }
  } catch (error) {
    console.error('OTP endpoint error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send OTP',
      },
      {
        status: 500,
        headers: formatRateLimitHeaders(result),
      }
    );
  }
}
