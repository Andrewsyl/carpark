"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

export default function BookingCancelPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-slate-600">Loading booking...</div>}>
      <BookingCancelContent />
    </Suspense>
  );
}

function BookingCancelContent() {
  const params = useSearchParams();
  const sessionId = params.get("session_id");

  return (
    <div className="mx-auto max-w-2xl space-y-6 text-center">
      <p className="text-sm font-semibold tracking-wide text-amber-700">Booking canceled</p>
      <h1 className="text-3xl tracking-tight font-semibold text-slate-900">Payment not completed</h1>
      <p className="text-slate-600">Your booking was not confirmed. You can try again or choose another time.</p>
      {sessionId && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Stripe session: <span className="font-semibold">{sessionId}</span>
        </div>
      )}
      <div className="flex justify-center gap-3 text-sm">
        <Link href="/search" className="btn-primary">
          Find another slot
        </Link>
        <Link href="/dashboard" className="rounded-lg px-3 py-2 font-semibold text-slate-700 hover:bg-slate-100">
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
