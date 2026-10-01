/**
 * Server-side batch sender: re-validates each row, builds the payload and calls the
 * OEM with capped concurrency.
 *
 * Exports: `SEND_CONCURRENCY`, `mapWithConcurrency()`, `sendBatch()`.
 *
 * Notes: The server trusts nothing from the client. It re-runs row validation and city
 * mapping on the raw cells, validates the final payload with zod, and logs one line per
 * row (mode, row, outcome, HTTP status, masked phone).
 */
import type { LeadCells } from "@/config/excel-layout";
import { logEvent, maskPhone, type LogFields } from "@/lib/log";
import type { Mode, SendRowResult } from "@/lib/validation/api-schemas";
import { validateLeadCells } from "@/lib/validation/lead-row";
import { postLead, type OemClientOptions, type OemTarget } from "./client";
import { buildOemPayload, oemLeadPayloadSchema } from "./payload";

/** Concurrent OEM calls per batch request. */
export const SEND_CONCURRENCY = 3;

/**
 * Maps items with at most `limit` promises in flight, preserving input order.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const run = async (): Promise<void> => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index] as T, index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

export interface SendBatchDeps {
  readonly mode: Mode;
  readonly target: OemTarget;
  readonly client: OemClientOptions;
  readonly log?: (event: string, fields: LogFields) => void;
}

/**
 * Validates and sends a batch of rows.
 * @returns one result per input row, in input order.
 */
export async function sendBatch(
  rows: ReadonlyArray<{ rowNumber: number; cells: LeadCells }>,
  deps: SendBatchDeps,
): Promise<SendRowResult[]> {
  const log = deps.log ?? logEvent;
  const dryRun = deps.target.kind === "dry-run";

  return mapWithConcurrency(rows, SEND_CONCURRENCY, async ({ rowNumber, cells }): Promise<SendRowResult> => {
    const base = { mode: deps.mode, rowNumber, phone: maskPhone(cells.mobile) };
    const validation = validateLeadCells(cells);
    if (!validation.lead) {
      log("lead.rejected", { ...base, reason: "row_validation" });
      return {
        rowNumber,
        status: "failed",
        message: `Rejected by server validation: ${Object.values(validation.errors).join("; ")}`,
        httpStatus: null,
        dryRun,
      };
    }

    const payload = oemLeadPayloadSchema.safeParse(buildOemPayload(validation.lead));
    if (!payload.success) {
      log("lead.rejected", { ...base, reason: "payload_validation" });
      return { rowNumber, status: "failed", message: "Rejected: payload failed validation", httpStatus: null, dryRun };
    }

    const result = await postLead(deps.target, payload.data, deps.client);
    const status = statusFor(result.ok);
    log("lead.sent", {
      ...base,
      outcome: status,
      dryRun: result.dryRun,
      httpStatus: result.httpStatus,
      attempts: result.attempts,
    });
    return { rowNumber, status, message: result.message, httpStatus: result.httpStatus, dryRun: result.dryRun };
  });
}

function statusFor(ok: boolean): SendRowResult["status"] {
  if (ok) {
    return "sent";
  }
  return "failed";
}
