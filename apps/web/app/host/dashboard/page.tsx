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
      <header className="flex flex-col gap-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Host dashboard</p>
        <h1 className="text-3xl font-bold text-slate-900">Your listings</h1>
        <p className="text-slate-600">Manage and delete your spaces.</p>
        <div className="flex gap-2 text-sm">
          <Link href="/host" className="btn-primary">
            Add new listing
          </Link>
          <Link href="/dashboard" className="rounded-lg px-3 py-2 font-semibold text-slate-700 hover:bg-slate-100">
            View bookings
          </Link>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          {payoutAccount ? (
            <span className="rounded-lg bg-emerald-100 px-3 py-2 font-semibold text-emerald-800">
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
              className="rounded-lg bg-amber-100 px-3 py-2 font-semibold text-amber-800 hover:bg-amber-200"
              disabled={payoutStatus === "loading"}
            >
              {payoutStatus === "loading" ? "Enabling payouts…" : "Enable payouts"}
            </button>
          )}
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
          <div key={listing.id} className="card flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <a href={`/listing/${listing.id}`} className="space-y-1 hover:text-brand-700">
              <h3 className="text-lg font-semibold text-slate-900">{listing.title}</h3>
              <p className="text-sm text-slate-600">{listing.address}</p>
              <p className="text-sm text-slate-700">
                €{listing.pricePerDay} / day • {listing.availability}
              </p>
            </a>
            <div className="flex flex-col gap-2 sm:items-end">
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
