import { NextRequest, NextResponse } from 'next/server';
import { eventOutcomeCsv } from '@/lib/event-outcomes';
import { loadEventOutcomeReport } from '@/lib/event-outcomes-server';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
};

function csvFilename(slug: string) {
  const safeSlug = slug.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'event';
  return `${safeSlug}-outcomes.csv`;
}

export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const result = await loadEventOutcomeReport(request, slug);

  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.status, headers: PRIVATE_HEADERS }
    );
  }

  if (request.nextUrl.searchParams.get('format') === 'csv') {
    return new NextResponse(eventOutcomeCsv(result.report), {
      status: 200,
      headers: {
        ...PRIVATE_HEADERS,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${csvFilename(result.report.event.slug)}"`,
      },
    });
  }

  return NextResponse.json(
    { success: true, report: result.report },
    { headers: PRIVATE_HEADERS }
  );
}
