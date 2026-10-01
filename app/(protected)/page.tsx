/**
 * / (dashboard): upload, preview and send leads.
 *
 * Exports: `metadata`, default `DashboardPage`.
 */
import type { Metadata } from "next";
import { Dashboard } from "@/components/dashboard/Dashboard";

export const metadata: Metadata = { title: "Dashboard · OEM Lead Dispatcher" };

/** Dashboard page. */
export default function DashboardPage() {
  return <Dashboard />;
}
