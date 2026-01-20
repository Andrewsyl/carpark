"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

export default function BookingSuccessPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-slate-600">Loading booking...</div>}>
      <BookingSuccessContent />
    </Suspense>
  );
}

function BookingSuccessContent() {
  const params = useSearchParams();
  const sessionId = params.get("session_id");

  return (
    <div className="mx-auto max-w-2xl space-y-6 text-center">
      <p className="text-sm font-semibold tracking-wide text-emerald-700">Booking confirmed</p>
      <h1 className="text-3xl tracking-tight font-semibold text-slate-900">Payment successful</h1>
      <p className="text-slate-600">We’ve received your booking. You’ll see it in your dashboard shortly.</p>
      {sessionId && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Stripe session: <span className="font-semibold">{sessionId}</span>
        </div>
      )}
      <div className="flex justify-center gap-3 text-sm">
        <Link href="/dashboard" className="btn-primary">
          View dashboard
        </Link>
        <Link href="/search" className="rounded-lg px-3 py-2 font-semibold text-slate-700 hover:bg-slate-100">
          Find another space
        </Link>
      </div>
    </div>
  );
}
