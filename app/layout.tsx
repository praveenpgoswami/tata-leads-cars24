/**
 * Root layout: HTML shell, Inter font, global styles.
 *
 * Exports: `metadata`, default `RootLayout`.
 */
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "OEM Lead Dispatcher",
  description: "Upload, validate and dispatch leads to the OEM API.",
  robots: { index: false, follow: false },
};

/** Root HTML layout shared by every route. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen font-sans text-sm">{children}</body>
    </html>
  );
}
