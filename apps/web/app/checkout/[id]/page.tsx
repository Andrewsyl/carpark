"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createBooking, getListing, type ListingDetail } from "../../../lib/api";
import { useAuth } from "../../../components/AuthProvider";

export default function CheckoutPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [error, setError] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "google">("card");

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const [date, setDate] = useState(today);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");

  const startDateTime = useMemo(() => new Date(`${date}T${startTime}:00`), [date, startTime]);
  const endDateTime = useMemo(() => new Date(`${date}T${endTime}:00`), [date, endTime]);
  const durationHours = useMemo(() => {
    const diff = endDateTime.getTime() - startDateTime.getTime();
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60)));
  }, [endDateTime, startDateTime]);
  const billingDays = useMemo(() => Math.max(1, Math.ceil(durationHours / 24)), [durationHours]);
  const totalPrice = useMemo(() => listing ? listing.pricePerDay * billingDays : 0, [billingDays, listing]);

  useEffect(() => {
    const id = params?.id;
    if (!id) return;
    getListing(id)
      .then(setListing)
      .catch(() => setError("Listing not found"));
  }, [params?.id]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token || !listing) {
      setError("Please sign in to book.");
      return;
    }
    setStatus("loading");
    setError(null);
    try {
      const from = `${date}T${startTime}:00Z`;
      const to = `${date}T${endTime}:00Z`;
      const amountCents = Math.max(1, listing.pricePerDay * billingDays) * 100; // simple day rate
      const res = await createBooking(
        {
          listingId: listing.id,
          from,
          to,
          amountCents,
          currency: "eur",
          platformFeePercent: 0.1,
        },
        token
      );
      setCheckoutUrl(res.checkoutUrl);
      setStatus("success");
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      }
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Could not start booking");
    }
  };

  if (loading) return <div className="text-sm text-slate-600">Loading...</div>;

  if (!user) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-700">Sign in to start a booking.</p>
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

  if (!listing) {
    return <div className="text-sm text-slate-600">Loading listing…</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-2xl flex-col gap-5 px-4 pb-28 pt-8 sm:px-6">
        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">Booking confirmation</p>
          <h1 className="text-3xl font-bold text-slate-900">{listing.title}</h1>
          <p className="text-sm text-slate-600">{listing.address}</p>
        </header>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Parking location</h2>
          <p className="mt-2 text-sm text-slate-600">Review the space details before confirming.</p>
          <div className="mt-4 rounded-xl border border-slate-200 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">{listing.title}</p>
            <p className="text-sm text-slate-600">{listing.address}</p>
          </div>
        </div>

        <form id="checkout-form" onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Session details</h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                {durationHours} hrs
              </span>
            </div>
            <div className="mt-4 space-y-3">
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-600">
                Date
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none"
                  required
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-600">
                  Start time
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none"
                    required
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-600">
                  End time
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none"
                    required
                  />
                </label>
              </div>
            </div>
            <div className="mt-5 rounded-xl border border-slate-200">
              {[
                { label: "START", value: startDateTime.toLocaleString() },
                { label: "END", value: endDateTime.toLocaleString() },
                { label: "DURATION", value: `${durationHours} hours` },
              ].map((row, index) => (
                <div
                  key={row.label}
                  className={`flex items-center justify-between px-4 py-3 text-sm ${index !== 0 ? "border-t border-slate-200" : ""}`}
                >
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{row.label}</span>
                  <span className="text-sm font-semibold text-slate-900">{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Price breakdown</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">RATE</span>
                <span className="text-sm font-semibold text-slate-900">€{listing.pricePerDay} / day</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">BILLING</span>
                <span className="text-sm font-semibold text-slate-900">{billingDays} day(s)</span>
              </div>
              <div className="rounded-xl bg-emerald-50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">TOTAL</span>
                  <span className="text-lg font-bold text-emerald-700">€{totalPrice.toFixed(2)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">PLATFORM FEE</span>
                <span className="text-sm font-semibold text-slate-900">Included</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Cancellation policy</h2>
            <p className="mt-3 text-sm text-slate-600">
              Cancel up to 2 hours before the start time for a full refund. Late cancellations may incur a fee.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Payment method</h2>
            <div className="mt-4 space-y-3">
              <button
                type="button"
                onClick={() => setPaymentMethod("google")}
                className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                  paymentMethod === "google"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                }`}
              >
                <span>Google Pay</span>
                <span className="text-xs font-semibold uppercase tracking-wide">Fast checkout</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("card")}
                className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                  paymentMethod === "card"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                }`}
              >
                <span>Add card</span>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Stripe</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
          )}
          {status === "success" && checkoutUrl && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              Redirecting to Stripe… If not redirected,{" "}
              <a className="underline" href={checkoutUrl}>
                click here
              </a>
              .
            </div>
          )}
        </form>

        <p className="text-xs text-slate-500">
          After payment, you’ll see a confirmation on the success page and in your dashboard. If the host hasn’t finished
          payouts, the booking uses a mock Stripe session for demo.
        </p>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="text-lg font-bold text-slate-900">€{totalPrice.toFixed(2)}</p>
            <p className="text-sm text-slate-500">{durationHours} hours</p>
          </div>
          <button
            type="submit"
            form="checkout-form"
            className="h-12 w-44 rounded-xl bg-emerald-500 text-sm font-semibold text-white shadow-md transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-300"
            disabled={status === "loading"}
          >
            {status === "loading"
              ? "Processing..."
              : paymentMethod === "google"
                ? "Buy with Google Pay"
                : "Pay & reserve"}
          </button>
        </div>
      </div>
    </div>
  );
}
