import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { emailSchema, profileSchema } from '@/lib/validation';
import { formatRateLimitHeaders, getClientIp, rateLimit, RATE_LIMITS } from '@/lib/ratelimit';

const normalizeOptionalText = (value: unknown, maxLength: number) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
};

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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = serviceRoleKey
      ? createSupabaseClient(supabaseUrl, serviceRoleKey)
      : createServerClient(
          supabaseUrl,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          {
            cookies: {
              get: () => undefined,
              set: () => {},
              remove: () => {},
            },
          }
        );

    const signupPayload = {
      email: emailValidation.data,
      source: typeof body.source === 'string' ? body.source.slice(0, 80) : 'landing',
      referrer: typeof body.referrer === 'string' ? body.referrer.slice(0, 500) : null,
      user_agent: request.headers.get('user-agent'),
    };

    const wantsFounderAccess = body.intent === 'founder_access';

    if (wantsFounderAccess) {
      if (!serviceRoleKey) {
        return NextResponse.json(
          {
            success: false,
            error: 'You are on the waitlist. Extra founder details can be added later.',
          },
          {
            status: 503,
            headers: formatRateLimitHeaders(result),
          }
        );
      }

      const fullName = normalizeOptionalText(body.fullName, 100);
      const companyName = normalizeOptionalText(body.companyName, 120);
      const websiteOrLinkedIn = normalizeOptionalText(body.websiteOrLinkedIn, 300);

      if (fullName && !profileSchema.shape.fullName.safeParse(fullName).success) {
        return NextResponse.json(
          {
            success: false,
            error: 'Enter a valid name.',
          },
          {
            status: 400,
            headers: formatRateLimitHeaders(result),
          }
        );
      }

      if (websiteOrLinkedIn) {
        const isLikelyUrl = /^https?:\/\/.+\..+/.test(websiteOrLinkedIn);
        if (!isLikelyUrl) {
          return NextResponse.json(
            {
              success: false,
              error: 'Enter a full website or LinkedIn URL.',
            },
            {
              status: 400,
              headers: formatRateLimitHeaders(result),
            }
          );
        }
      }

      const { error } = await supabase.from('waitlist_signups').upsert(
        {
          ...signupPayload,
          full_name: fullName,
          company_name: companyName,
          website_or_linkedin: websiteOrLinkedIn,
          wants_founder_access: true,
        },
        { onConflict: 'email' }
      );

      if (error) {
        console.error('Waitlist enrichment error:', error);
        throw error;
      }

      return NextResponse.json(
        {
          success: true,
          message: 'Founder access details saved.',
        },
        {
          status: 200,
          headers: formatRateLimitHeaders(result),
        }
      );
    }

    const { error } = await supabase.from('waitlist_signups').insert(signupPayload);

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
