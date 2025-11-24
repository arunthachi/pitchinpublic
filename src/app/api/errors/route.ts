import { NextRequest, NextResponse } from 'next/server';

interface ErrorReport {
  message: string;
  stack?: string;
  componentStack?: string;
  timestamp: string;
  url: string;
}

/**
 * Error reporting endpoint for client-side errors
 * Logs client errors for debugging and monitoring
 *
 * POST /api/errors
 *
 * Body:
 * {
 *   "message": "error message",
 *   "stack": "error stack trace",
 *   "componentStack": "react component stack",
 *   "timestamp": "2025-11-24T12:00:00Z",
 *   "url": "https://pitchinpublic.com/page"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ErrorReport;

    // Log the error on server
    console.error('Client Error Report:', {
      message: body.message,
      stack: body.stack,
      componentStack: body.componentStack,
      timestamp: body.timestamp,
      url: body.url,
      userAgent: request.headers.get('user-agent'),
    });

    // In production, send to error tracking service like Sentry
    // Example:
    // if (process.env.SENTRY_DSN) {
    //   await fetch(process.env.SENTRY_DSN, {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({
    //       eventID: generateId(),
    //       message: body.message,
    //       exception: {
    //         values: [{
    //           type: 'Error',
    //           value: body.message,
    //           stacktrace: {
    //             frames: parseStack(body.stack)
    //           }
    //         }]
    //       },
    //       contexts: {
    //         react: {
    //           componentStack: body.componentStack
    //         }
    //       },
    //       request: {
    //         url: body.url,
    //         headers: {
    //           'User-Agent': request.headers.get('user-agent') || ''
    //         }
    //       },
    //       timestamp: body.timestamp
    //     })
    //   });
    // }

    return NextResponse.json(
      {
        success: true,
        message: 'Error report received',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Failed to process error report:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process error report',
      },
      { status: 500 }
    );
  }
}
