/**
 * Tests for the OEM client (retry rules, dry run, target selection) and the batch sender.
 */
import { describe, expect, it, vi } from "vitest";
import type { LeadCells } from "@/config/excel-layout";
import { postLead, resolveOemTarget, summarizeResponseBody, type OemTarget } from "@/lib/oem/client";
import { buildOemPayload } from "@/lib/oem/payload";
import { mapWithConcurrency, sendBatch } from "@/lib/oem/send-batch";
import { validateLeadCells } from "@/lib/validation/lead-row";

const cells: LeadCells = {
  mobile: "9812098765",
  customerName: "Kirti",
  modelSlug: "1348",
  customerCitySlug: "udaipur",
  areaName: "2",
  pincode: "313001",
};

const lead = validateLeadCells(cells).lead;
if (!lead) {
  throw new Error("fixture must be valid");
}
const payload = buildOemPayload(lead);
const target: OemTarget = { kind: "http", url: "https://oem.test/api/v1/consumer/leads/third-party-leads", token: "secret" };
const noSleep = () => Promise.resolve();

function fetchSequence(...steps: Array<Response | Error>) {
  const queue = [...steps];
  return vi.fn<typeof fetch>(async () => {
    const step = queue.shift();
    if (!step) {
      throw new Error("unexpected extra call");
    }
    if (step instanceof Error) {
      throw step;
    }
    return step;
  });
}

describe("resolveOemTarget", () => {
  const live = { baseUrl: "https://live.test/", token: "L" };
  it("uses the live URL with the doc's path", () => {
    expect(resolveOemTarget("live", { oemLive: live, oemDev: null })).toEqual({
      kind: "http",
      url: "https://live.test/api/v1/consumer/leads/third-party-leads",
      token: "L",
    });
  });
  it("makes DEV a dry run unless a DEV target is configured", () => {
    expect(resolveOemTarget("dev", { oemLive: live, oemDev: null })).toEqual({ kind: "dry-run" });
    expect(resolveOemTarget("dev", { oemLive: live, oemDev: { baseUrl: "https://uat.test", token: "D" } })).toMatchObject({
      kind: "http",
      token: "D",
    });
  });
});

describe("postLead", () => {
  it("posts JSON with the auth-token header", async () => {
    const fetchImpl = fetchSequence(new Response('{"message":"Lead created"}', { status: 201 }));
    const result = await postLead(target, payload, { timeoutMs: 1000, fetchImpl, sleep: noSleep });
    expect(result).toMatchObject({ ok: true, httpStatus: 201, message: "HTTP 201: Lead created", attempts: 1 });
    const init = fetchImpl.mock.calls[0]?.[1];
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ "auth-token": "secret", "Content-Type": "application/json" });
    expect(JSON.parse(String(init?.body))).toEqual(payload);
  });

  it("retries once on 5xx", async () => {
    const fetchImpl = fetchSequence(new Response("", { status: 503 }), new Response("ok", { status: 200 }));
    const result = await postLead(target, payload, { timeoutMs: 1000, fetchImpl, sleep: noSleep });
    expect(result).toMatchObject({ ok: true, attempts: 2 });
  });

  it("retries once on network errors and then gives up", async () => {
    const fetchImpl = fetchSequence(new TypeError("fetch failed"), new TypeError("fetch failed"));
    const result = await postLead(target, payload, { timeoutMs: 1000, fetchImpl, sleep: noSleep });
    expect(result).toMatchObject({ ok: false, httpStatus: null, attempts: 2, message: "Network error: connection failed" });
  });

  it("does not retry 4xx", async () => {
    const fetchImpl = fetchSequence(new Response('{"message":"Invalid city"}', { status: 400 }));
    const result = await postLead(target, payload, { timeoutMs: 1000, fetchImpl, sleep: noSleep });
    expect(result).toMatchObject({ ok: false, httpStatus: 400, attempts: 1, message: "HTTP 400: Invalid city" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("dry run makes no network call", async () => {
    const fetchImpl = fetchSequence();
    const result = await postLead({ kind: "dry-run" }, payload, { timeoutMs: 1000, fetchImpl });
    expect(result).toMatchObject({ ok: true, dryRun: true, attempts: 0 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("summarises bodies into one bounded line", () => {
    expect(summarizeResponseBody(500, "")).toBe("HTTP 500");
    expect(summarizeResponseBody(200, "a\n\tb")).toBe("HTTP 200: a b");
    expect(summarizeResponseBody(200, "x".repeat(500)).length).toBeLessThanOrEqual(210);
  });
});

describe("sendBatch", () => {
  it("re-validates rows on the server and logs masked phones only", async () => {
    const log = vi.fn();
    const fetchImpl = fetchSequence(new Response("{}", { status: 200 }));
    const results = await sendBatch(
      [
        { rowNumber: 2, cells },
        { rowNumber: 3, cells: { ...cells, customerCitySlug: "Atlantis" } },
      ],
      { mode: "live", target, client: { timeoutMs: 1000, fetchImpl, sleep: noSleep }, log },
    );
    expect(results.map((r) => [r.rowNumber, r.status])).toEqual([
      [2, "sent"],
      [3, "failed"],
    ]);
    expect(results[1]?.message).toMatch(/Rejected by server validation/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(log.mock.calls);
    expect(logged).not.toContain("9812098765");
    expect(logged).not.toContain("Kirti");
    expect(logged).not.toContain("secret");
    expect(logged).toContain("******8765");
  });

  it("caps concurrency and preserves order", async () => {
    let active = 0;
    let peak = 0;
    const out = await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return n * 10;
    });
    expect(out).toEqual([10, 20, 30, 40, 50, 60, 70]);
    expect(peak).toBe(3);
  });
});
