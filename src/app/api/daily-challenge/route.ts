import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export const dynamic = 'force-dynamic';

const defaultChallenges = [
  {
    category: 'Product',
    prompt: 'Describe your product in one sentence that makes someone want to try it.',
    difficulty: 'easy',
  },
  {
    category: 'Market',
    prompt: 'Who is your clearest customer, and what painful problem do they already know they have?',
    difficulty: 'medium',
  },
  {
    category: 'Traction',
    prompt: 'What proof do you have that people want this now?',
    difficulty: 'medium',
  },
  {
    category: 'Ask',
    prompt: 'End your pitch with one specific ask: feedback, intros, pilots, or customers.',
    difficulty: 'easy',
  },
] as const;

function getFallbackChallenge(today: string) {
  const daySeed = today.split('-').reduce((sum, part) => sum + Number(part), 0);
  const challenge = defaultChallenges[daySeed % defaultChallenges.length];

  return {
    id: `daily-${today}`,
    date: today,
    category: challenge.category,
    prompt: challenge.prompt,
    difficulty: challenge.difficulty,
    hasResponded: false,
    responseCount: 0,
  };
}

/**
 * GET /api/daily-challenge/today
 * Get today's daily challenge
 *
 * Response:
 * {
 *   "success": true,
 *   "challenge": {
 *     "id": "uuid",
 *     "date": "YYYY-MM-DD",
 *     "category": "string",
 *     "prompt": "string",
 *     "difficulty": "easy" | "medium" | "hard",
 *     "hasResponded": boolean,
 *     "responseCount": number
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );

  try {
    // Get today's date
    const today = new Date().toISOString().split('T')[0];

    // Get today's challenge. Older MVP databases may not have a `date` column yet,
    // so this endpoint must gracefully fall back instead of breaking the challenge CTA.
    const { data: challenge, error: challengeError } = await supabase
      .from('daily_challenges')
      .select('*')
      .eq('date', today)
      .single();

    if (challengeError && challengeError.code !== 'PGRST116') {
      console.warn('Daily challenge date lookup failed, using fallback challenge:', challengeError.message);
      return NextResponse.json({
        success: true,
        challenge: getFallbackChallenge(today),
      });
    }

    // If no challenge exists for today, create a default one
    if (!challenge) {
      // Pick a random challenge for today
      const fallbackChallenge = getFallbackChallenge(today);

      const { data: newChallenge, error: createError } = await supabase
        .from('daily_challenges')
        .insert({
          date: today,
          category: fallbackChallenge.category,
          prompt: fallbackChallenge.prompt,
          difficulty: fallbackChallenge.difficulty,
        })
        .select()
        .single();

      if (createError) {
        console.warn('Daily challenge create failed, using fallback challenge:', createError.message);
        return NextResponse.json({
          success: true,
          challenge: fallbackChallenge,
        });
      }

      return NextResponse.json({
        success: true,
        challenge: {
          id: newChallenge.id,
          date: newChallenge.date,
          category: newChallenge.category,
          prompt: newChallenge.prompt,
          difficulty: newChallenge.difficulty,
          hasResponded: false,
          responseCount: 0,
        },
      });
    }

    // Check if user has already responded to today's challenge
    let hasResponded = false;
    let responseCount = 0;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Count total responses
        const { count } = await supabase
          .from('challenge_responses')
          .select('id', { count: 'exact', head: true })
          .eq('challenge_id', challenge.id);

        responseCount = count || 0;

        // Check if this user responded
        const { data: userResponse } = await supabase
          .from('challenge_responses')
          .select('id')
          .eq('challenge_id', challenge.id)
          .eq('user_id', user.id)
          .single();

        hasResponded = !!userResponse;
      }
    } catch (error) {
      // User not authenticated, that's fine
      console.log('User not authenticated for challenge check');
    }

    return NextResponse.json({
      success: true,
      challenge: {
        id: challenge.id,
        date: challenge.date,
        category: challenge.category,
        prompt: challenge.prompt,
        difficulty: challenge.difficulty,
        hasResponded,
        responseCount,
      },
    });
  } catch (error) {
    console.error('Error fetching daily challenge:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch daily challenge',
      },
      { status: 500 }
    );
  }
}
