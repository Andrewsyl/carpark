"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  createPayoutOnboardingLink,
  getPayoutBalance,
  getPayoutConnectStatus,
  listPayoutHistory,
} from "../../../lib/api";
import { useAuth } from "../../../components/AuthProvider";
import type { PayoutBalance, PayoutHistoryItem } from "../../../types/payments";

type LoadingState = "idle" | "loading" | "error";

const fallbackPayouts: PayoutHistoryItem[] = [
  {
    id: "po_demo_1",
    amount: 8500,
    gross_amount: 10000,
    platform_fee: 1500,
    status: "paid",
    arrival_date: "2024-12-20",
    created_at: "2024-12-18",
    bookings_count: 5,
    statement_url: "#",
  },
  {
    id: "po_demo_2",
    amount: 4200,
    status: "pending",
    arrival_date: "2024-12-22",
    created_at: "2024-12-19",
    bookings_count: 2,
  },
];

export default function EarningsPage() {
  const { user, token, loading } = useAuth();
  const [connectStatus, setConnectStatus] = useState<{ connected: boolean; accountId?: string } | null>(null);
  const [balance, setBalance] = useState<PayoutBalance | null>(null);
  const [payouts, setPayouts] = useState<PayoutHistoryItem[]>([]);
  const [status, setStatus] = useState<LoadingState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);

  const loadData = useMemo(
    () => async () => {
      if (!token) return;
      setStatus("loading");
      setError(null);
      try {
        const [conn, bal, history] = await Promise.all([
          getPayoutConnectStatus(token),
          getPayoutBalance(token),
          listPayoutHistory(token),
        ]);
        setConnectStatus(conn);
        setBalance(bal);
        setPayouts(history);
        setStatus("idle");
      } catch (err) {
        setStatus("error");
        const msg = err instanceof Error ? err.message : "Could not load payouts";
        setError(msg.includes("Not Found") ? "Payout API unavailable; showing demo data" : msg);
        // Fallback for dev/demo
        setPayouts(fallbackPayouts);
        setBalance((prev) => prev ?? { available: 0, pending: 0, currency: "eur" });
      }
    },
    [token]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleConnect = async () => {
    if (!token) return;
    setLinkLoading(true);
    try {
      const link = await createPayoutOnboardingLink(token);
      if (link) {
        window.open(link, "_blank");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start onboarding");
    } finally {
      setLinkLoading(false);
    }
  };

  if (loading) return <div className="p-4 text-sm text-slate-600">Loading…</div>;

  if (!user) {
    return (
      <div className="space-y-4 p-4">
        <p className="text-sm text-slate-700">Sign in to view earnings.</p>
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
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">Earnings</p>
        <h1 className="text-3xl font-bold text-slate-900">Host payouts</h1>
        <p className="text-sm text-slate-600">Connect Stripe, view balances, and download payout statements.</p>
      </header>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Stripe connect</p>
          <div className="mt-2 flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold text-slate-900">
                {connectStatus?.connected ? "Connected" : "Not connected"}
              </p>
              {connectStatus?.accountId && <p className="text-xs text-slate-500">Account: {connectStatus.accountId}</p>}
            </div>
            <StatusPill tone={connectStatus?.connected ? "success" : "warning"}>
              {connectStatus?.connected ? "Active" : "Action needed"}
            </StatusPill>
          </div>
          {!connectStatus?.connected && (
            <button
              onClick={handleConnect}
              disabled={linkLoading}
              className="mt-3 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
            >
              {linkLoading ? "Opening…" : "Complete onboarding"}
            </button>
          )}
        </div>

        <BalanceCard
          title="Available"
          amount={(balance?.available ?? 0) / 100}
          currency={balance?.currency ?? "EUR"}
          tone="success"
        />
        <BalanceCard
          title="Pending"
          amount={(balance?.pending ?? 0) / 100}
          currency={balance?.currency ?? "EUR"}
          tone="muted"
        />
      </div>

      <section className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Payout history</h2>
            <p className="text-sm text-slate-600">Recent payouts to your bank.</p>
          </div>
        </div>

        {status === "loading" && <div className="text-sm text-slate-600">Loading payouts…</div>}
        {payouts.length === 0 && status === "idle" && <div className="text-sm text-slate-600">No payouts yet.</div>}

        <div className="divide-y divide-slate-100">
          {payouts.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm text-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">€{(p.amount / 100).toFixed(2)}</span>
                  <StatusPill tone={p.status === "paid" ? "success" : p.status === "pending" ? "warning" : "danger"}>
                    {p.status}
                  </StatusPill>
                </div>
                <div className="text-[12px] text-slate-600">
                  <span>{p.arrival_date ?? p.created_at}</span>
                  {p.bookings_count && <span className="ml-2 text-slate-500">{p.bookings_count} bookings</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {p.statement_url && (
                  <a
                    href={p.statement_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Statement
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatusPill({ tone, children }: { tone: "success" | "warning" | "danger" | "muted"; children: React.ReactNode }) {
  const map = {
    success: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-800",
    danger: "bg-rose-100 text-rose-700",
    muted: "bg-slate-100 text-slate-700",
  };
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${map[tone]}`}>{children}</span>;
}

function BalanceCard({ title, amount, currency, tone }: { title: string; amount: number; currency: string; tone: "success" | "muted" }) {
  const colors = tone === "success" ? "bg-emerald-50 text-emerald-700 ring-emerald-100" : "bg-slate-50 text-slate-700 ring-slate-100";
  return (
    <div className={`rounded-2xl border border-slate-100 ${colors} p-4 shadow-sm ring-1`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">
        €{amount.toFixed(2)} <span className="text-sm font-semibold text-slate-500">{currency.toUpperCase?.() ?? currency}</span>
      </p>
    </div>
  );
}
