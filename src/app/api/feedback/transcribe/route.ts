import { NextRequest, NextResponse } from 'next/server';
import { isUserAllowedForPilot } from '@/lib/pilot-access';
import { getClientIp, rateLimit } from '@/lib/ratelimit';
import { createClient } from '@/lib/supabase/server';
import { extractDeepgramTranscript } from '@/lib/deepgram';

export const runtime = 'nodejs';

const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const ALLOWED_AUDIO_TYPES = new Set([
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/x-m4a',
]);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Sign in to dictate feedback.' }, { status: 401 });
  if (!(await isUserAllowedForPilot(user))) {
    return NextResponse.json({ error: 'Your account cannot transcribe feedback.' }, { status: 403 });
  }

  const limit = await rateLimit({
    key: `feedback-transcription:${user.id}:${getClientIp(request)}`,
    limit: 12,
    window: 3600,
  });
  if (!limit.success) {
    return NextResponse.json(
      { error: 'You have reached the voice-note limit. Type this note or try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter || 3600) } }
    );
  }

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Voice notes are temporarily unavailable.' }, { status: 503 });
  }

  try {
    const form = await request.formData();
    const audio = form.get('audio');
    if (!(audio instanceof File) || audio.size === 0) {
      return NextResponse.json({ error: 'No microphone recording was received.' }, { status: 400 });
    }
    if (audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: 'Keep voice notes under 45 seconds.' }, { status: 413 });
    }

    const normalizedType = audio.type.split(';')[0].toLowerCase();
    if (normalizedType && !ALLOWED_AUDIO_TYPES.has(normalizedType)) {
      return NextResponse.json({ error: 'This audio format is not supported.' }, { status: 415 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    let response: Response;
    try {
      response = await fetch('https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true', {
        method: 'POST',
        headers: {
          Authorization: `Token ${apiKey}`,
          'Content-Type': normalizedType || 'application/octet-stream',
        },
        body: audio,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return NextResponse.json({ error: 'We could not transcribe that recording. Please try again.' }, { status: 502 });
    }

    const payload = await response.json();
    const transcript = extractDeepgramTranscript(payload);
    if (!transcript) {
      return NextResponse.json({ error: 'No speech was detected. Try again closer to the microphone.' }, { status: 422 });
    }

    return NextResponse.json({ transcript });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return NextResponse.json({ error: 'Transcription took too long. Please try again.' }, { status: 504 });
    }
    return NextResponse.json({ error: 'Voice-note transcription failed. Please try again.' }, { status: 500 });
  }
}
