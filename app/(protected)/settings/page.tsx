/**
 * /settings: change the admin password.
 *
 * Exports: `metadata`, default `SettingsPage`.
 */
import type { Metadata } from "next";
import { ChangePasswordForm } from "@/components/forms/ChangePasswordForm";

export const metadata: Metadata = { title: "Settings · OEM Lead Dispatcher" };

/** Settings page with the change-password form. */
export default function SettingsPage() {
  return (
    <div className="max-w-md">
      <h1 className="text-lg font-semibold text-gray-900">Settings</h1>
      <section aria-labelledby="password-heading" className="mt-6 rounded-md border border-gray-200 bg-white p-6">
        <h2 id="password-heading" className="mb-4 text-base font-semibold text-gray-900">
          Change password
        </h2>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
