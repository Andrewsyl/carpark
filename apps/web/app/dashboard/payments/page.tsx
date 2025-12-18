"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  addPaymentMethod,
  deletePaymentMethod,
  listPaymentHistory,
  listPaymentMethods,
  retryPayment,
  setDefaultPaymentMethod,
} from "../../../lib/api";
import { useAuth } from "../../../components/AuthProvider";
import type { PaymentMethod, PaymentHistoryItem } from "../../../types/payments";

type LoadingState = "idle" | "loading" | "error";

export default function PaymentsPage() {
  const { user, token, loading } = useAuth();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [history, setHistory] = useState<PaymentHistoryItem[]>([]);
  const [status, setStatus] = useState<LoadingState>("idle");
  const [historyStatus, setHistoryStatus] = useState<LoadingState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [form, setForm] = useState({ number: "", expMonth: "", expYear: "", cvc: "" });

  const loadMethods = useMemo(
    () => async () => {
      if (!token) return;
      setStatus("loading");
      setError(null);
      try {
        const data = await listPaymentMethods(token);
        setMethods(data);
        setStatus("idle");
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Could not load payment methods");
      }
    },
    [token]
  );

  const loadHistory = useMemo(
    () => async () => {
      if (!token) return;
      setHistoryStatus("loading");
      setHistoryError(null);
      try {
        const data = await listPaymentHistory(token);
        setHistory(data);
        setHistoryStatus("idle");
      } catch (err) {
        setHistoryStatus("error");
        setHistoryError(err instanceof Error ? err.message : "Could not load payments");
      }
    },
    [token]
  );

  useEffect(() => {
    loadMethods();
    loadHistory();
  }, [loadMethods, loadHistory]);

  const handleAdd = async () => {
    if (!token) return;
    setAddLoading(true);
    setError(null);
    try {
      // NOTE: In production, replace with Stripe Elements and send setup intent confirmation.
      await addPaymentMethod(
        {
          number: form.number,
          exp_month: form.expMonth,
          exp_year: form.expYear,
          cvc: form.cvc,
        },
        token
      );
      setShowAdd(false);
      setForm({ number: "", expMonth: "", expYear: "", cvc: "" });
      loadMethods();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add card");
    } finally {
      setAddLoading(false);
    }
  };

  const handleDefault = async (id: string) => {
    if (!token) return;
    try {
      await setDefaultPaymentMethod(id, token);
      loadMethods();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set default");
    }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    try {
      await deletePaymentMethod(id, token);
      loadMethods();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete card");
    }
  };

  const handleRetry = async (id: string) => {
    if (!token) return;
    try {
      await retryPayment(id, token);
      loadHistory();
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : "Retry failed");
    }
  };

  if (loading) return <div className="p-4 text-sm text-slate-600">Loading…</div>;

  if (!user) {
    return (
      <div className="space-y-4 p-4">
        <p className="text-sm text-slate-700">Sign in to manage payments.</p>
        <div className="flex gap-2 text-sm">
          <Link href="/login" className="btn-primary">
            Sign in
          </Link>
          <Link href="/signup" className="rounded-lg px-3 py-2 font-semibold text-slate-700 hover:bg-slate-100">
            Create account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">Payments</p>
        <h1 className="text-3xl font-bold text-slate-900">Manage payment methods</h1>
        <p className="text-sm text-slate-600">Add a card, set a default, and review your booking charges.</p>
      </header>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {historyError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{historyError}</div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Saved payment methods</h2>
              <p className="text-sm text-slate-600">Use a card for faster checkout.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
            >
              Add card
            </button>
          </div>

          {status === "loading" && <div className="text-sm text-slate-600">Loading cards…</div>}
          {methods.length === 0 && status === "idle" && <div className="text-sm text-slate-600">No cards saved yet.</div>}

          <div className="space-y-2">
            {methods.map((pm) => (
              <div
                key={pm.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-sm text-slate-800"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold uppercase">{pm.brand}</span>
                    <span className="text-slate-500">•••• {pm.last4}</span>
                    <span className="text-slate-500">
                      {pm.exp_month}/{pm.exp_year}
                    </span>
                    {pm.is_default && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Default</span>
                    )}
                  </div>
                  {pm.created_at && <p className="text-[11px] text-slate-500">Added {new Date(pm.created_at).toLocaleDateString()}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {!pm.is_default && (
                    <button
                      onClick={() => handleDefault(pm.id)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Make default
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(pm.id)}
                    className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Payment history</h2>
              <p className="text-sm text-slate-600">Recent booking charges.</p>
            </div>
          </div>

          {historyStatus === "loading" && <div className="text-sm text-slate-600">Loading payments…</div>}
          {history.length === 0 && historyStatus === "idle" && (
            <div className="text-sm text-slate-600">No payments recorded yet.</div>
          )}

          <div className="space-y-2">
            {history.map((p) => (
              <div key={p.id} className="flex flex-col gap-1 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-sm text-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-slate-900">{p.description ?? "Booking payment"}</div>
                  <StatusChip status={p.status} />
                </div>
                <div className="flex items-center justify-between gap-2 text-[12px] text-slate-600">
                  <div className="space-x-2">
                    <span>{new Date(p.created_at).toLocaleString()}</span>
                    {p.booking_id && <span className="text-slate-500">Booking {p.booking_id}</span>}
                  </div>
                  <div className="text-sm font-semibold text-slate-900">
                    €{(p.amount / 100).toFixed(2)} {p.currency?.toUpperCase?.() ?? ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {p.receipt_url && (
                    <a
                      href={p.receipt_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Receipt
                    </a>
                  )}
                  {p.status === "failed" && (
                    <button
                      onClick={() => handleRetry(p.id)}
                      className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50"
                    >
                      Retry
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Add card</p>
                <p className="text-sm text-slate-600">Demo form — replace with Stripe Elements in production.</p>
              </div>
              <button className="rounded-lg px-3 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-100" onClick={() => setShowAdd(false)}>
                Close
              </button>
            </div>
            <div className="mt-3 space-y-2">
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                placeholder="Card number"
                value={form.number}
                onChange={(e) => setForm((prev) => ({ ...prev, number: e.target.value }))}
              />
              <div className="flex gap-2">
                <input
                  className="w-1/2 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                  placeholder="Exp month"
                  value={form.expMonth}
                  onChange={(e) => setForm((prev) => ({ ...prev, expMonth: e.target.value }))}
                />
                <input
                  className="w-1/2 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                  placeholder="Exp year"
                  value={form.expYear}
                  onChange={(e) => setForm((prev) => ({ ...prev, expYear: e.target.value }))}
                />
              </div>
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                placeholder="CVC"
                value={form.cvc}
                onChange={(e) => setForm((prev) => ({ ...prev, cvc: e.target.value }))}
              />
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                onClick={() => setShowAdd(false)}
              >
                Cancel
              </button>
              <button
                disabled={addLoading}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
                onClick={handleAdd}
              >
                {addLoading ? "Saving…" : "Save card"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: PaymentHistoryItem["status"] }) {
  const map: Record<PaymentHistoryItem["status"], string> = {
    succeeded: "bg-emerald-100 text-emerald-700",
    pending: "bg-amber-100 text-amber-800",
    failed: "bg-rose-100 text-rose-700",
    refunded: "bg-blue-100 text-blue-700",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${map[status] ?? "bg-slate-100 text-slate-700"}`}>
      {status}
    </span>
  );
}
