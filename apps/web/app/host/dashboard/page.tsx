"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { deleteListing, getHostListings, getHostPayoutStatus, createHostPayoutAccount } from "../../../lib/api";
import { useAuth } from "../../../components/AuthProvider";

type HostListing = {
  id: string;
  title: string;
  address: string;
  pricePerDay: number;
  availability: string;
  latitude?: number;
  longitude?: number;
};

export default function HostDashboardPage() {
  const { user, token, loading } = useAuth();
  const [listings, setListings] = useState<HostListing[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [payoutAccount, setPayoutAccount] = useState<string | null>(null);
  const [payoutStatus, setPayoutStatus] = useState<"idle" | "loading" | "error" | "ready">("idle");

  const loadListings = async () => {
    if (!token) return;
    setStatus("loading");
    setError(null);
    try {
      const res = await getHostListings(token);
      setListings(res?.listings ?? []);
      setStatus("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load listings");
      setStatus("error");
    }
  };

  useEffect(() => {
    loadListings();
    const loadPayout = async () => {
      if (!token) return;
      setPayoutStatus("loading");
      try {
        const res = await getHostPayoutStatus(token);
        setPayoutAccount(res.accountId);
        setPayoutStatus(res.accountId ? "ready" : "idle");
      } catch (err) {
        setPayoutStatus("error");
      }
    };
    loadPayout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleDelete = async (id: string) => {
    if (!token) return;
    if (!confirm("Delete this listing?")) return;
    try {
      await deleteListing(id, token);
      setListings((prev) => prev.filter((l) => l.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not delete listing");
    }
  };

  if (loading) {
    return <div className="text-sm text-slate-600">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-700">Sign in to see your listings.</p>
        <Link href="/login" className="btn-primary w-fit">
          Go to login
        </Link>
      </div>
    );
  }

  const created = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("created") : null;

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-5 text-white shadow-lg">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-200">Host dashboard</p>
            <h1 className="text-3xl font-bold leading-tight">Your listings</h1>
            <p className="text-sm text-emerald-100/80">Manage spaces, payouts, and visibility.</p>
            <div className="flex flex-wrap gap-2 text-sm">
              <Link href="/host" className="rounded-full bg-emerald-500 px-3 py-1.5 font-semibold text-slate-900 hover:bg-emerald-400">
                Add new listing
              </Link>
              <Link href="/dashboard" className="rounded-full bg-white/10 px-3 py-1.5 font-semibold text-white hover:bg-white/15">
                View bookings
              </Link>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-sm font-semibold">
            {payoutAccount ? (
              <span className="rounded-full bg-emerald-100 px-3 py-2 text-emerald-800 ring-1 ring-emerald-200">
                Payouts ready • {payoutAccount}
              </span>
            ) : (
              <button
                onClick={async () => {
                  if (!token) return;
                  setPayoutStatus("loading");
                  try {
                    const res = await createHostPayoutAccount(token);
                    setPayoutAccount(res.accountId);
                    setPayoutStatus("ready");
                  } catch (err) {
                    setPayoutStatus("error");
                  }
                }}
                className="rounded-full bg-amber-100 px-3 py-2 text-amber-800 ring-1 ring-amber-200 hover:bg-amber-200"
                disabled={payoutStatus === "loading"}
              >
                {payoutStatus === "loading" ? "Enabling payouts…" : "Enable payouts"}
              </button>
            )}
          </div>
        </div>
      </header>

      {created && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Listing published successfully.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}
      {status === "loading" && <div className="text-sm text-slate-600">Loading listings...</div>}

      <div className="grid gap-4">
        {listings.map((listing) => (
          <div
            key={listing.id}
            className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between"
          >
            <a href={`/listing/${listing.id}`} className="space-y-1 hover:text-brand-700 sm:max-w-[70%]">
              <h3 className="text-lg font-semibold text-slate-900 line-clamp-1">{listing.title}</h3>
              <p className="text-sm text-slate-600 line-clamp-2">{listing.address}</p>
              <p className="text-sm font-semibold text-slate-800">
                €{listing.pricePerDay} / day • <span className="text-slate-600">{listing.availability}</span>
              </p>
            </a>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <button
                onClick={() => handleDelete(listing.id)}
                className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {status === "idle" && listings.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            No listings yet. Add your first on the host page.
          </div>
        )}
      </div>
    </div>
  );
}
