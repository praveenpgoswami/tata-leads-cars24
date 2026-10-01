/**
 * Next.js instrumentation hook: runs once when a server instance starts.
 *
 * Exports: `register()`.
 * Notes: Validates environment variables at startup so misconfiguration fails fast
 * with a clear message instead of on the first request.
 */

/** Validates server env on Node.js server startup. */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }
  const { getEnv } = await import("./lib/env");
  getEnv();
}
