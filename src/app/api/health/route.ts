import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export const dynamic = 'force-dynamic';

/**
 * Health check endpoint for monitoring and load balancers
 * Returns status of app and dependencies
 *
 * GET /api/health
 *
 * Response:
 * {
 *   "status": "healthy" | "degraded" | "unhealthy",
 *   "timestamp": "2025-11-24T12:00:00Z",
 *   "uptime": 3600,
 *   "database": "healthy" | "unhealthy",
 *   "checks": {
 *     "supabase_connection": true,
 *     "auth_system": true
 *   }
 * }
 */
export async function GET() {
  const startTime = Date.now();
  const checks: Record<string, boolean> = {};
  let databaseStatus = 'unhealthy';

  try {
    // Test Supabase connection
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

    // Quick health check - verify we can reach Supabase
    try {
      const result = await Promise.race([
        supabase.from('profiles').select('count', { count: 'exact', head: true }).then(result => ({ data: result.data, error: result.error })),
        new Promise<{ data: null; error: Error }>((_resolve, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 3000)
        ),
      ]);

      // Type guard for the result
      const { error } = result as { data: unknown; error: unknown };

      if (!error) {
        checks.supabase_connection = true;
        databaseStatus = 'healthy';
      } else {
        checks.supabase_connection = false;
      }
    } catch (err) {
      checks.supabase_connection = false;
    }

    // Auth system check
    try {
      await supabase.auth.getUser();
      checks.auth_system = true;
    } catch {
      checks.auth_system = false;
    }

    const duration = Date.now() - startTime;

    // Determine overall health
    const allChecksPassed = Object.values(checks).every(v => v);
    const status = allChecksPassed ? 'healthy' : 'degraded';

    return NextResponse.json({
      status,
      timestamp: new Date().toISOString(),
      responseTime: `${duration}ms`,
      database: databaseStatus,
      checks,
      environment: process.env.NODE_ENV,
    });
  } catch (error) {
    console.error('Health check failed:', error);
    const duration = Date.now() - startTime;

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        responseTime: `${duration}ms`,
        database: 'unhealthy',
        checks: {
          supabase_connection: false,
          auth_system: false,
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
