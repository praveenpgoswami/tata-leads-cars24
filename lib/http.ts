/**
 * Small helpers for route handlers.
 *
 * Exports: `readJson()`, `jsonError()`.
 */
import { NextResponse } from "next/server";

/** Parses a JSON request body; returns undefined for a missing or malformed body. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

/** JSON error response: `{ error, ...extra }`. */
export function jsonError(status: number, error: string, extra: Record<string, unknown> = {}, headers?: HeadersInit) {
  return NextResponse.json({ error, ...extra }, { status, headers });
}
