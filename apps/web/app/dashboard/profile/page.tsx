"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "../../../components/AuthProvider";
import { deleteAccount, requestEmailVerification } from "../../../lib/api";

export default function ProfilePage() {
  const { user, token, signOut } = useAuth();
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const resendVerification = async () => {
    if (!user?.email) return;
    setSending(true);
    setMessage(null);
    setError(null);
    try {
      await requestEmailVerification(user.email);
      setMessage("Verification email sent. Check your inbox.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send verification email");
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async () => {
    const ok = confirm("Delete your account permanently? This cannot be undone.");
    if (!ok) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteAccount(token ?? undefined);
      signOut();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete account");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Profile</p>
        <h1 className="text-3xl font-bold text-slate-900">Account settings</h1>
        <p className="text-sm text-slate-600">Manage your account info, verification, and security.</p>
      </header>

      {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Account</p>
              <h2 className="text-lg font-semibold text-slate-900">User details</h2>
            </div>
            {user?.emailVerified ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Email verified</span>
            ) : (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">Verification needed</span>
            )}
          </div>
          <div className="mt-3 space-y-3 text-sm text-slate-700">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Email</p>
              <p className="font-semibold text-slate-900">{user?.email}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Role</p>
              <p className="font-semibold text-slate-900">{user?.role ?? "driver"}</p>
            </div>
          </div>
          {!user?.emailVerified && (
            <button
              onClick={resendVerification}
              disabled={sending}
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-60"
            >
              {sending ? "Sending…" : "Resend verification"}
            </button>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">Danger zone</p>
          <h2 className="text-lg font-semibold text-slate-900">Delete account</h2>
          <p className="mt-2 text-sm text-slate-700">
            This will permanently remove your account, listings, and bookings. This action cannot be undone.
          </p>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="mt-4 inline-flex items-center justify-center rounded-lg border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
          >
            {deleting ? "Deleting…" : "Delete account"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Shortcuts</p>
        <div className="mt-2 flex flex-wrap gap-3 text-sm font-semibold text-brand-700">
          <Link href="/dashboard" className="rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50">
            Your trips
          </Link>
          <Link href="/host/dashboard" className="rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50">
            Host dashboard
          </Link>
          <Link href="/dashboard/payments" className="rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50">
            Payments
          </Link>
          <Link href="/dashboard/earnings" className="rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50">
            Earnings
          </Link>
        </div>
      </div>
    </div>
  );
}
