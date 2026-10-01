/**
 * HTTP client for the OEM lead endpoint, with timeout and a single retry.
 *
 * Exports: `OemTarget`, `OemCallResult`, `OemClientOptions`, `resolveOemTarget()`,
 * `postLead()`, `summarizeResponseBody()`.
 *
 * Notes:
 * - Auth is an `auth-token` header (API doc curl sample). The token never leaves the server.
 * - Network errors, timeouts and 5xx responses get one retry with backoff; 4xx responses
 *   are never retried.
 * - The doc doesn't define a response shape, so any 2xx counts as success. A short,
 *   sanitised piece of the body is returned as the row message.
 * - DEV runs as a dry run (no network call) unless a DEV URL and token are configured.
 */
import { OEM_LEAD_PATH } from "@/config/oem-defaults";
import type { ServerEnv } from "@/lib/env";
import type { Mode } from "@/lib/validation/api-schemas";
import type { OemLeadPayload } from "./payload";

export type OemTarget =
  | { readonly kind: "http"; readonly url: string; readonly token: string }
  | { readonly kind: "dry-run" };

export interface OemCallResult {
  readonly ok: boolean;
  readonly httpStatus: number | null;
  readonly message: string;
  readonly attempts: number;
  readonly dryRun: boolean;
}

export interface OemClientOptions {
  readonly timeoutMs: number;
  readonly retryDelayMs?: number;
  readonly fetchImpl?: typeof fetch;
  readonly sleep?: (ms: number) => Promise<void>;
}

const MAX_ATTEMPTS = 2;
const MAX_MESSAGE_LENGTH = 200;

type AttemptOutcome =
  | { readonly kind: "response"; readonly status: number; readonly body: string }
  | { readonly kind: "network"; readonly reason: string };

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
}

/**
 * Picks the OEM target for a mode. LIVE always calls the live URL; DEV is a dry run
 * unless both OEM_DEV_BASE_URL and OEM_DEV_TOKEN are set.
 */
export function resolveOemTarget(mode: Mode, env: Pick<ServerEnv, "oemLive" | "oemDev">): OemTarget {
  if (mode === "live") {
    return { kind: "http", url: joinUrl(env.oemLive.baseUrl, OEM_LEAD_PATH), token: env.oemLive.token };
  }
  if (!env.oemDev) {
    return { kind: "dry-run" };
  }
  return { kind: "http", url: joinUrl(env.oemDev.baseUrl, OEM_LEAD_PATH), token: env.oemDev.token };
}

/** Reduces a response body to a short, single-line, printable message. */
export function summarizeResponseBody(status: number, body: string): string {
  let text = body;
  try {
    const parsed: unknown = JSON.parse(body);
    if (parsed && typeof parsed === "object" && "message" in parsed && typeof parsed.message === "string") {
      text = parsed.message;
    }
  } catch {
    // Not JSON: use the raw text.
  }
  const clean = text
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_MESSAGE_LENGTH);
  if (!clean) {
    return `HTTP ${status}`;
  }
  return `HTTP ${status}: ${clean}`;
}

function networkReason(error: unknown, timeoutMs: number): string {
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return `timed out after ${Math.round(timeoutMs / 1000)}s`;
  }
  return "connection failed";
}

async function attempt(
  target: Extract<OemTarget, { kind: "http" }>,
  payload: OemLeadPayload,
  options: OemClientOptions,
): Promise<AttemptOutcome> {
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(target.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "auth-token": target.token },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(options.timeoutMs),
      cache: "no-store",
    });
    const body = await response.text();
    return { kind: "response", status: response.status, body };
  } catch (error) {
    return { kind: "network", reason: networkReason(error, options.timeoutMs) };
  }
}

function isRetryable(outcome: AttemptOutcome): boolean {
  return outcome.kind === "network" || outcome.status >= 500;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sends one lead to the OEM.
 * @returns the outcome; never throws.
 */
export async function postLead(
  target: OemTarget,
  payload: OemLeadPayload,
  options: OemClientOptions,
): Promise<OemCallResult> {
  if (target.kind === "dry-run") {
    return { ok: true, httpStatus: null, message: "DEV dry run: payload valid, not delivered", attempts: 0, dryRun: true };
  }

  const sleep = options.sleep ?? defaultSleep;
  const baseDelay = options.retryDelayMs ?? 500;
  let outcome = await attempt(target, payload, options);
  let attempts = 1;
  while (isRetryable(outcome) && attempts < MAX_ATTEMPTS) {
    await sleep(baseDelay * attempts + Math.floor(Math.random() * 100));
    outcome = await attempt(target, payload, options);
    attempts += 1;
  }

  if (outcome.kind === "network") {
    return { ok: false, httpStatus: null, message: `Network error: ${outcome.reason}`, attempts, dryRun: false };
  }
  const ok = outcome.status >= 200 && outcome.status < 300;
  return { ok, httpStatus: outcome.status, message: summarizeResponseBody(outcome.status, outcome.body), attempts, dryRun: false };
}
