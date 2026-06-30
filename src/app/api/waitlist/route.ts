import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { emailSchema } from '@/lib/validation';
import { formatRateLimitHeaders, getClientIp, rateLimit, RATE_LIMITS } from '@/lib/ratelimit';

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const result = await rateLimit({
    key: `waitlist:${ip}`,
    limit: RATE_LIMITS.WAITLIST.limit,
    window: RATE_LIMITS.WAITLIST.window,
  });

  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'Too many requests. Please try again later.',
      },
      {
        status: 429,
        headers: formatRateLimitHeaders(result),
      }
    );
  }

  try {
    const body = await request.json();
    const emailValidation = emailSchema.safeParse(body.email);

    if (!emailValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Enter a valid email address.',
        },
        {
          status: 400,
          headers: formatRateLimitHeaders(result),
        }
      );
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        cookies: {
          get: () => undefined,
          set: () => {},
          remove: () => {},
        },
      }
    );

    const { error } = await supabase.from('waitlist_signups').insert({
      email: emailValidation.data,
      source: typeof body.source === 'string' ? body.source.slice(0, 80) : 'landing',
      referrer: typeof body.referrer === 'string' ? body.referrer.slice(0, 500) : null,
      user_agent: request.headers.get('user-agent'),
    });

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          {
            success: true,
            message: 'You are already on the waitlist.',
          },
          {
            status: 200,
            headers: formatRateLimitHeaders(result),
          }
        );
      }

      console.error('Waitlist signup error:', error);
      throw error;
    }

    return NextResponse.json(
      {
        success: true,
        message: 'You are on the waitlist.',
      },
      {
        status: 201,
        headers: formatRateLimitHeaders(result),
      }
    );
  } catch (error) {
    console.error('Waitlist endpoint error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Could not join the waitlist right now. Please try again later.',
      },
      {
        status: 500,
        headers: formatRateLimitHeaders(result),
      }
    );
  }
}
