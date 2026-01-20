"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookingCard, type Booking } from "../../components/BookingCard";
import { getMyBookings } from "../../lib/api";
import { useAuth } from "../../components/AuthProvider";

export default function DashboardPage() {
  const { user, token, loading } = useAuth();
  const [driverBookings, setDriverBookings] = useState<Booking[]>([]);
  const [hostBookings, setHostBookings] = useState<Booking[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [stats, setStats] = useState<{ driverCount: number; hostCount: number; hostEarnings: number }>({
    driverCount: 0,
    hostCount: 0,
    hostEarnings: 0,
  });

  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const date = startDate.toLocaleDateString();
    const timeRange = `${startDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${endDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    return { date, timeRange };
  };

  const load = useMemo(
    () => async () => {
      if (!token) return;
      setStatus("loading");
      setError(null);
      try {
        const data = await getMyBookings(token);
        const driverData = data?.driverBookings ?? [];
        const hostData = data?.hostBookings ?? [];
        setDriverBookings(
          driverData.map((b) => {
            const { date, timeRange } = formatDateRange(b.startTime, b.endTime);
            return {
              id: b.id,
              address: b.address,
              title: b.title,
              date,
              timeRange,
              payout: 0,
              driver: user?.email ?? "You",
              status: (b.status as Booking["status"]) ?? "pending",
            };
          })
        );
        setHostBookings(
          hostData.map((b) => {
            const { date, timeRange } = formatDateRange(b.startTime, b.endTime);
            return {
              id: b.id,
              address: b.address,
              title: b.title,
              date,
              timeRange,
              payout: (b.amountCents ?? 0) / 100,
              driver: undefined,
              status: (b.status as Booking["status"]) ?? "pending",
            };
          })
        );
        setStats({
          driverCount: driverData.length,
          hostCount: hostData.length,
          hostEarnings: hostData.reduce((sum, b) => sum + (b.amountCents ?? 0), 0) / 100,
        });
        setStatus("idle");
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Could not load bookings");
      }
    },
    [token, user?.email]
  );

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <div className="text-sm text-slate-600">Loading...</div>;

  if (!user) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-700">Sign in to view your bookings.</p>
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
    <div className="space-y-8">
      <header className="space-y-3 rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-6 text-white shadow-lg">
        <div className="text-xs font-semibold tracking-[0.28em] text-emerald-200">Dashboard</div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl tracking-tight font-semibold leading-tight sm:text-4xl">Welcome back{user?.email ? `, ${user.email}` : ""}</h1>
            <p className="text-sm text-emerald-100/85">Track bookings, payouts, and saved payment methods.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-100">
            <Link href="/dashboard/payments" className="rounded-full bg-white/10 px-3 py-1.5 hover:bg-white/15">
              Payments
            </Link>
            <Link href="/dashboard/earnings" className="rounded-full bg-white/10 px-3 py-1.5 hover:bg-white/15">
              Earnings
            </Link>
            <Link href="/host" className="rounded-full bg-emerald-500 px-3 py-1.5 text-slate-900 hover:bg-emerald-400">
              List a space
            </Link>
          </div>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Driver bookings" value={stats.driverCount.toString()} hint="Completed + upcoming" />
        <StatCard
          label="Host earnings"
          value={`€${stats.hostEarnings.toFixed(2)}`}
          hint="Gross payouts (test mode)"
          accent
        />
        <StatCard label="Host bookings" value={stats.hostCount.toString()} hint="Confirmed + pending" />
      </section>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {status === "loading" && <div className="text-sm text-slate-600">Loading bookings…</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold tracking-wide text-emerald-600">Driver</p>
              <h2 className="text-xl font-semibold text-slate-900">Your trips</h2>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              {driverBookings.length} total
            </span>
          </div>
          <div className="grid gap-3">
            {driverBookings.map((booking) => (
              <button key={booking.id} onClick={() => setSelected(booking)} className="text-left">
                <BookingCard booking={booking} />
              </button>
            ))}
            {driverBookings.length === 0 && status === "idle" && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                No driver bookings yet. Head to search to book a space.
              </div>
            )}
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold tracking-wide text-slate-700">Host</p>
              <h2 className="text-xl font-semibold text-slate-900">Earnings</h2>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {hostBookings.length} payouts
            </span>
          </div>
          <div className="grid gap-3">
            {hostBookings.map((booking) => (
              <button key={booking.id} onClick={() => setSelected(booking)} className="text-left">
                <BookingCard booking={booking} />
              </button>
            ))}
            {hostBookings.length === 0 && status === "idle" && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                No host bookings yet. List a space to start earning.
              </div>
            )}
          </div>
          <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Payouts flow via Stripe Connect. Store each host Stripe account and send application fees per booking.
          </div>
        </section>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-lg space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">
                  {selected.title ?? selected.address}
                </h3>
                <p className="text-sm text-slate-600">
                  {selected.date} • {selected.timeRange}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-lg px-3 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold tracking-wide">
              <span
                className={`rounded-full px-2 py-1 ${
                  selected.status === "pending"
                    ? "bg-amber-100 text-amber-800"
                    : selected.status === "confirmed"
                    ? "bg-emerald-100 text-emerald-800"
                    : selected.status === "canceled"
                    ? "bg-rose-100 text-rose-700"
                    : "bg-slate-100 text-slate-800"
                }`}
              >
                {selected.status}
              </span>
              {typeof selected.payout === "number" && <span>€{selected.payout.toFixed(2)} payout</span>}
            </div>
            <p className="text-sm text-slate-700">Driver: {selected.driver ?? "You"}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 shadow-sm ${
        accent
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-slate-200 bg-white/80 text-slate-900 backdrop-blur"
      }`}
    >
      <p className={`text-xs font-semibold tracking-wide ${accent ? "text-emerald-700" : "text-slate-500"}`}>
        {label}
      </p>
      <div className="text-2xl tracking-tight font-semibold">{value}</div>
      {hint && <p className={`text-xs ${accent ? "text-emerald-800/80" : "text-slate-500"}`}>{hint}</p>}
    </div>
  );
}
