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

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const [date, setDate] = useState(today);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");

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
      const amountCents = Math.max(1, listing.pricePerDay) * 100; // simple day rate
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
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Checkout</p>
        <h1 className="text-3xl font-bold text-slate-900">{listing.title}</h1>
        <p className="text-sm text-slate-600">{listing.address}</p>
      </header>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Date
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Start time
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            End time
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
              required
            />
          </label>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <div className="flex items-center justify-between">
            <span>Price</span>
            <span className="font-semibold">€{listing.pricePerDay} / day</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Platform fee (10%)</span>
            <span className="font-semibold">included</span>
          </div>
        </div>

        <button type="submit" className="btn-primary w-full" disabled={status === "loading"}>
          {status === "loading" ? "Redirecting to Stripe…" : "Pay with Stripe"}
        </button>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        )}
        {status === "success" && checkoutUrl && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Redirecting to Stripe… If not redirected, <a className="underline" href={checkoutUrl}>click here</a>.
          </div>
        )}
      </form>

      <p className="text-xs text-slate-500">
        After payment, you’ll see a confirmation on the success page and in your dashboard. If the host hasn’t finished payouts, the booking uses a mock Stripe session for demo.
      </p>
    </div>
  );
}
