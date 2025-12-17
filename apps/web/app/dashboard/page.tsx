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
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Dashboard</p>
        <h1 className="text-3xl font-bold text-slate-900">Your bookings</h1>
        <p className="text-slate-600">Upcoming trips and host earnings in one place.</p>
      </header>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {status === "loading" && <div className="text-sm text-slate-600">Loading bookings…</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Driver</h2>
            <span className="text-sm font-semibold text-brand-700">History + upcoming</span>
          </div>
          <div className="grid gap-3">
            {driverBookings.map((booking) => (
              <button key={booking.id} onClick={() => setSelected(booking)} className="text-left">
                <BookingCard booking={booking} />
              </button>
            ))}
            {driverBookings.length === 0 && status === "idle" && (
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                No driver bookings yet. Head to search to book a space.
              </div>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Host earnings</h2>
            <span className="text-sm font-semibold text-brand-700">Stripe payouts</span>
          </div>
          <div className="grid gap-3">
            {hostBookings.map((booking) => (
              <button key={booking.id} onClick={() => setSelected(booking)} className="text-left">
                <BookingCard booking={booking} />
              </button>
            ))}
            {hostBookings.length === 0 && status === "idle" && (
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                No host bookings yet. List a space to start earning.
              </div>
            )}
          </div>
          <div className="card text-sm text-slate-700">
            Payouts flow via Stripe Connect. Store each host's `stripe_account_id`, send application fees per booking, and confirm transfers via webhook.
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
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
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
