"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../components/AuthProvider";

type ListingRow = {
  id: string;
  title: string;
  address: string;
  status: string;
  moderation_reason?: string | null;
  moderation_note?: string | null;
  created_at: string;
};

const statusOptions = [
  { value: "approved", label: "Approved" },
  { value: "pending", label: "Pending" },
  { value: "rejected", label: "Rejected" },
  { value: "disabled", label: "Disabled" },
];

const reasons = [
  "Violates terms",
  "Inaccurate info",
  "Inappropriate content",
  "Safety concern",
  "Other",
];

export default function AdminListingsPage() {
  const { token } = useAuth();
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string | undefined>();
  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";
  const [confirm, setConfirm] = useState<{ id: string; action: "approve" | "rejected" | "disabled"; title: string } | null>(null);
  const [confirmReason, setConfirmReason] = useState("");

  const parseSafe = async (res: Response) => {
    try {
      return await res.clone().json();
    } catch {
      const text = await res.text();
      return text && !text.startsWith("<!DOCTYPE") ? { message: text } : { message: "Admin API unavailable" };
    }
  };

  const formatDate = (value: string) => {
    try {
      return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
    } catch {
      return value;
    }
  };

  const loadListings = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const url = filter ? `${apiBase}/api/admin/listings?status=${filter}` : `${apiBase}/api/admin/listings`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = await parseSafe(res);
      if (!res.ok) throw new Error((data as any).message ?? "Failed to load listings");
      setListings((data as any).listings ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load listings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filter]);

  const updateListing = async (id: string, body: Record<string, any>) => {
    if (!token) return;
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/admin/listings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await parseSafe(res);
      if (!res.ok) throw new Error((data as any).message ?? "Failed to update listing");
      setListings((prev) => prev.map((l) => (l.id === id ? { ...l, ...(data as any).listing } : l)));
      setConfirm(null);
      setConfirmReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update listing");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl tracking-tight font-semibold text-slate-900">Listings</h1>
          <p className="text-sm text-slate-600">Approve, reject, or disable listings.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter ?? ""}
            onChange={(e) => setFilter(e.target.value || undefined)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            {statusOptions.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            onClick={loadListings}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
      </div>
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Title</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Reason</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Created</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {listings.map((listing) => (
              <tr key={listing.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-900">{listing.title}</div>
                  <div className="text-xs text-slate-500">{listing.address}</div>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={listing.status}
                    onChange={(e) => updateListing(listing.id, { status: e.target.value })}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
                  >
                    {statusOptions.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={listing.moderation_reason ?? ""}
                    onChange={(e) => updateListing(listing.id, { moderationReason: e.target.value || null })}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
                  >
                    <option value="">None</option>
                    {reasons.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <textarea
                    placeholder="Note (optional)"
                    defaultValue={listing.moderation_note ?? ""}
                    onBlur={(e) => updateListing(listing.id, { moderationNote: e.target.value })}
                    className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
                  />
                </td>
                <td className="px-4 py-3 text-slate-500">{formatDate(listing.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex gap-2">
                    <button
                      onClick={() => setConfirm({ id: listing.id, action: "approve", title: listing.title })}
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => setConfirm({ id: listing.id, action: "rejected", title: listing.title })}
                      className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-500"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => setConfirm({ id: listing.id, action: "disabled", title: listing.title })}
                      className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-600"
                    >
                      Disable
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <div className="p-3 text-sm text-slate-600">Loading…</div>}
      </div>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">
              {confirm.action === "approve"
                ? "Approve listing"
                : confirm.action === "rejected"
                ? "Reject listing"
                : "Disable listing"}
            </h2>
            <p className="mt-1 text-sm text-slate-600">Listing: {confirm.title}</p>
            {confirm.action !== "approve" && (
              <textarea
                className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                placeholder="Reason (optional)"
                value={confirmReason}
                onChange={(e) => setConfirmReason(e.target.value)}
              />
            )}
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => {
                  setConfirm(null);
                  setConfirmReason("");
                }}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const status = confirm.action === "approve" ? "approved" : confirm.action;
                  updateListing(confirm.id, {
                    status,
                    moderationReason: confirmReason || undefined,
                    reason: confirmReason || undefined,
                  });
                }}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${
                  confirm.action === "approve"
                    ? "bg-emerald-600 hover:bg-emerald-500"
                    : confirm.action === "reject"
                    ? "bg-rose-600 hover:bg-rose-500"
                    : "bg-slate-700 hover:bg-slate-600"
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
