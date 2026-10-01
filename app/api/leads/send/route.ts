/**
 * POST /api/leads/send: sends one batch (at most 10 rows) of leads to the OEM.
 *
 * Exports: `POST`, `maxDuration`.
 * Notes: The mode in the body picks the target; URLs and tokens come only from server
 * env. Rows are re-validated on the server. Worst case per batch: 4 waves of 3 calls,
 * each up to 2 attempts × the timeout, which stays inside `maxDuration`.
 */
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/require-session";
import { getEnv } from "@/lib/env";
import { jsonError, readJson } from "@/lib/http";
import { logEvent } from "@/lib/log";
import { resolveOemTarget } from "@/lib/oem/client";
import { sendBatch } from "@/lib/oem/send-batch";
import { sendRequestSchema, type SendResponse } from "@/lib/validation/api-schemas";

export const maxDuration = 60;

/** Sends a batch of rows and returns one result per row. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return jsonError(401, "Your session has expired. Sign in again.");
  }

  const parsed = sendRequestSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return jsonError(400, "Invalid send request.");
  }

  const env = getEnv();
  const { mode, rows } = parsed.data;
  const target = resolveOemTarget(mode, env);
  logEvent("batch.start", { mode, rows: rows.length, dryRun: target.kind === "dry-run" });

  const results = await sendBatch(rows, {
    mode,
    target,
    client: { timeoutMs: env.oemTimeoutMs },
  });

  const body: SendResponse = { results };
  return NextResponse.json(body);
}
