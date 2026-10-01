/**
 * Dashboard: upload an Excel file, preview the validated rows, send valid leads in batches.
 *
 * Exports: `Dashboard`.
 *
 * Notes:
 * - Parsing happens in the browser. SheetJS is loaded on demand when a file is chosen.
 * - Sending: batches of `SEND_BATCH_SIZE` go to /api/leads/send one at a time. Cancel
 *   takes effect between batches. Only rows that are sendable in the current mode are
 *   queued, so rows already sent are never sent again.
 * - In LIVE mode, sending asks for confirmation with the lead count first.
 */
"use client";

import { Download, FileSpreadsheet, RotateCcw, Send, Square, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useReducer, useRef, useState } from "react";
import { useMode } from "@/components/layout/ModeProvider";
import { Alert, type AlertTone } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EXPECTED_HEADERS } from "@/config/excel-layout";
import { postSendBatch } from "@/lib/client/leads-api";
import { checkUploadFile } from "@/lib/excel/check-file";
import { buildErrorReportCsv, REPORTED_STATUSES } from "@/lib/excel/error-report";
import {
  applySendResults,
  countByStatus,
  isSendable,
  markBatchFailed,
  markSending,
  resetFailed,
  revertSending,
} from "@/lib/excel/row-state";
import type { LeadRow } from "@/lib/excel/types";
import { SEND_BATCH_SIZE, type Mode } from "@/lib/validation/api-schemas";
import { Dropzone } from "./Dropzone";
import { LeadTable } from "./LeadTable";
import { ProgressBar } from "./ProgressBar";
import { SummaryBar } from "./SummaryBar";

type State =
  | { readonly phase: "empty" }
  | { readonly phase: "parsing"; readonly fileName: string }
  | { readonly phase: "error"; readonly title: string; readonly problems: string[] }
  | { readonly phase: "ready"; readonly fileName: string; readonly sheetName: string; readonly rows: LeadRow[] };

type Action =
  | { readonly type: "reset" }
  | { readonly type: "parsing"; readonly fileName: string }
  | { readonly type: "failed"; readonly title: string; readonly problems: string[] }
  | { readonly type: "loaded"; readonly fileName: string; readonly sheetName: string; readonly rows: LeadRow[] }
  | { readonly type: "update"; readonly update: (rows: LeadRow[]) => LeadRow[] };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "reset":
      return { phase: "empty" };
    case "parsing":
      return { phase: "parsing", fileName: action.fileName };
    case "failed":
      return { phase: "error", title: action.title, problems: action.problems };
    case "loaded":
      return { phase: "ready", fileName: action.fileName, sheetName: action.sheetName, rows: action.rows };
    case "update":
      if (state.phase !== "ready") {
        return state;
      }
      return { ...state, rows: action.update(state.rows) };
  }
}

interface Notice {
  readonly tone: AlertTone;
  readonly text: string;
}

interface Progress {
  readonly done: number;
  readonly total: number;
}

const MODE_NOTE: Readonly<Record<Mode, { tone: AlertTone; text: string }>> = {
  dev: {
    tone: "info",
    text: "DEV mode: sends are validated on the server and not delivered to the OEM (dry run). Switch to LIVE to deliver leads.",
  },
  live: {
    tone: "warning",
    text: "LIVE mode: sends create real leads in the production OEM system.",
  },
};

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
}

function downloadCsv(fileName: string, csv: string): void {
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function summaryNotice(sent: number, failed: number, stopped: "cancelled" | null): Notice {
  const parts = [`${sent} sent`, `${failed} failed`];
  if (stopped === "cancelled") {
    return { tone: "warning", text: `Sending cancelled: ${parts.join(", ")}. Remaining rows were not sent.` };
  }
  if (failed > 0) {
    return { tone: "warning", text: `Finished: ${parts.join(", ")}. Download the error report for details.` };
  }
  return { tone: "success", text: `Finished: ${sent} lead(s) sent.` };
}

/** Upload, preview and send workflow. */
export function Dashboard() {
  const router = useRouter();
  const { mode, setBusy, setLiveReadyCount } = useMode();
  const [state, dispatch] = useReducer(reducer, { phase: "empty" });
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const sendingRef = useRef(false);
  const cancelRef = useRef(false);
  const [cancelling, setCancelling] = useState(false);

  const rows = state.phase === "ready" && state.rows;
  const allRows: readonly LeadRow[] = rows || [];
  const counts = countByStatus(allRows, mode);
  const sendable = allRows.filter((row) => isSendable(row, mode));
  const reportable = allRows.filter((row) => REPORTED_STATUSES.has(row.status)).length;

  const liveReady = allRows.filter((row) => isSendable(row, "live")).length;

  useEffect(() => {
    setLiveReadyCount(liveReady);
  }, [liveReady, setLiveReadyCount]);

  useEffect(() => {
    if (!sending) {
      return;
    }
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [sending]);

  const handleFiles = async (files: File[]) => {
    setNotice(null);
    setProgress(null);
    const problem = checkUploadFile(files);
    const file = files[0];
    if (problem || !file) {
      dispatch({ type: "failed", title: "File not accepted", problems: [problem ?? "No file selected."] });
      return;
    }
    dispatch({ type: "parsing", fileName: file.name });
    try {
      const [excel, buffer] = await Promise.all([import("@/lib/excel/parse"), file.arrayBuffer()]);
      const outcome = excel.parseLeadWorkbook(buffer);
      if (outcome.kind === "structure-error") {
        dispatch({ type: "failed", title: `"${file.name}" does not have the expected layout`, problems: outcome.problems });
        return;
      }
      dispatch({
        type: "loaded",
        fileName: file.name,
        sheetName: outcome.sheetName,
        rows: excel.validateRows(outcome.rows),
      });
    } catch {
      dispatch({ type: "failed", title: "File could not be read", problems: ["Try saving it again as .xlsx."] });
    }
  };

  const runSend = async () => {
    if (sendingRef.current || sendable.length === 0) {
      return;
    }
    const sendMode = mode;
    const queue = sendable;
    sendingRef.current = true;
    cancelRef.current = false;
    setCancelling(false);
    setSending(true);
    setBusy(true);
    setNotice(null);
    setProgress({ done: 0, total: queue.length });

    let done = 0;
    let sent = 0;
    let failed = 0;
    let stopped: "cancelled" | null = null;
    let unauthorized = false;

    for (const batch of chunk(queue, SEND_BATCH_SIZE)) {
      if (cancelRef.current) {
        stopped = "cancelled";
        break;
      }
      const numbers = new Set(batch.map((row) => row.rowNumber));
      dispatch({ type: "update", update: (current) => markSending(current, numbers) });
      const outcome = await postSendBatch(
        sendMode,
        batch.map((row) => ({ rowNumber: row.rowNumber, cells: row.cells })),
      );
      if (outcome.kind === "unauthorized") {
        dispatch({ type: "update", update: revertSending });
        unauthorized = true;
        break;
      }
      if (outcome.kind === "error") {
        dispatch({ type: "update", update: (current) => markBatchFailed(current, numbers, outcome.message) });
        failed += batch.length;
      }
      if (outcome.kind === "ok") {
        dispatch({ type: "update", update: (current) => applySendResults(current, outcome.results, sendMode) });
        const batchSent = outcome.results.filter((result) => result.status === "sent").length;
        sent += batchSent;
        failed += outcome.results.length - batchSent;
      }
      done += batch.length;
      setProgress({ done, total: queue.length });
    }

    sendingRef.current = false;
    setSending(false);
    setCancelling(false);
    setBusy(false);
    if (unauthorized) {
      router.replace("/login");
      return;
    }
    setNotice(summaryNotice(sent, failed, stopped));
  };

  const requestSend = () => {
    if (mode === "live") {
      setConfirmSend(true);
      return;
    }
    void runSend();
  };

  const clear = () => {
    dispatch({ type: "reset" });
    setNotice(null);
    setProgress(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Upload leads</h1>
        <p className="mt-1 text-sm text-gray-600">
          Excel columns, in order: <span className="font-mono text-xs text-gray-800">{EXPECTED_HEADERS.join(", ")}</span>
        </p>
      </div>

      <Alert tone={MODE_NOTE[mode].tone}>{MODE_NOTE[mode].text}</Alert>

      {state.phase !== "ready" && (
        <Dropzone onFiles={(files) => void handleFiles(files)} disabled={state.phase === "parsing"} />
      )}

      {state.phase === "parsing" && (
        <p role="status" className="text-sm text-gray-700">
          Reading {state.fileName}…
        </p>
      )}

      {state.phase === "error" && (
        <Alert tone="error" title={state.title}>
          <ul className="list-disc pl-4">
            {state.problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </Alert>
      )}

      {rows && state.phase === "ready" && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-200 bg-white px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <FileSpreadsheet aria-hidden className="size-5 shrink-0 text-gray-500" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">{state.fileName}</p>
                <p className="text-xs text-gray-600">Sheet: {state.sheetName}</p>
              </div>
            </div>
            <Button size="sm" onClick={clear} disabled={sending}>
              <X aria-hidden className="size-4" />
              Clear file
            </Button>
          </div>

          <SummaryBar total={rows.length} counts={counts} />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={reportable === 0}
                onClick={() =>
                  downloadCsv(`${state.fileName.replace(/\.[^.]+$/, "")}-errors.csv`, buildErrorReportCsv(rows))
                }
              >
                <Download aria-hidden className="size-4" />
                Download error report
              </Button>
              {counts.failed > 0 && (
                <Button
                  size="sm"
                  disabled={sending}
                  onClick={() => dispatch({ type: "update", update: resetFailed })}
                >
                  <RotateCcw aria-hidden className="size-4" />
                  Mark {counts.failed} failed for retry
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">Invalid and unmapped-city rows are not sent.</span>
              {sending && (
                <Button
                  size="sm"
                  disabled={cancelling}
                  onClick={() => {
                    cancelRef.current = true;
                    setCancelling(true);
                  }}
                >
                  <Square aria-hidden className="size-3.5" />
                  {cancelling && "Stopping after this batch…"}
                  {!cancelling && "Cancel"}
                </Button>
              )}
              <Button variant="primary" disabled={sending || sendable.length === 0} onClick={requestSend}>
                <Send aria-hidden className="size-4" />
                Send {sendable.length} valid lead(s)
              </Button>
            </div>
          </div>

          {progress && (
            <ProgressBar
              done={progress.done}
              total={progress.total}
              label={`Sending to ${mode.toUpperCase()} in batches of ${SEND_BATCH_SIZE}`}
            />
          )}

          {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

          <LeadTable rows={rows} mode={mode} counts={counts} />
        </>
      )}

      <ConfirmDialog
        open={confirmSend}
        title={`Send ${sendable.length} lead(s) to LIVE?`}
        confirmLabel={`Send ${sendable.length} to LIVE`}
        confirmVariant="danger"
        onCancel={() => setConfirmSend(false)}
        onConfirm={() => {
          setConfirmSend(false);
          void runSend();
        }}
      >
        <p>
          <strong>{sendable.length}</strong> lead(s) will be delivered to the production OEM API. This cannot be undone.
        </p>
      </ConfirmDialog>
    </div>
  );
}
