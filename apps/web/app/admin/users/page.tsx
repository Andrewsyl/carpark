"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../components/AuthProvider";

type UserRow = {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
};

export default function AdminUsersPage() {
  const { token } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "";
  const [confirm, setConfirm] = useState<{ id: string; action: "suspend" | "activate"; email: string } | null>(null);
  const [confirmReason, setConfirmReason] = useState("");

  const loadUsers = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/admin/users`, { headers: { Authorization: `Bearer ${token}` } });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.message ?? "Failed to load users");
      setUsers(data.users ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (value: string) => {
    try {
      return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
    } catch {
      return value;
    }
  };

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const updateUser = async (id: string, body: Record<string, any>) => {
    if (!token) return;
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.message ?? "Failed to update user");
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...data.user } : u)));
      setConfirm(null);
      setConfirmReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Users</h1>
          <p className="text-sm text-slate-600">Suspend/reactivate and adjust roles.</p>
        </div>
        <button
          onClick={loadUsers}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Email</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Role</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Created</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-semibold text-slate-900">{user.email}</td>
                <td className="px-4 py-3">
                  <select
                    value={user.role}
                    onChange={(e) => updateUser(user.id, { role: e.target.value })}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
                  >
                    <option value="driver">Driver</option>
                    <option value="host">Host</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      user.status === "suspended"
                        ? "bg-rose-100 text-rose-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {user.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">{formatDate(user.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  {user.status === "suspended" ? (
                    <button
                      onClick={() => setConfirm({ id: user.id, action: "activate", email: user.email })}
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                    >
                      Activate
                    </button>
                  ) : (
                    <button
                      onClick={() => setConfirm({ id: user.id, action: "suspend", email: user.email })}
                      className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-500"
                    >
                      Suspend
                    </button>
                  )}
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
            <h2 className="text-lg font-bold text-slate-900">
              {confirm.action === "suspend" ? "Suspend user" : "Activate user"}
            </h2>
            <p className="mt-1 text-sm text-slate-600">User: {confirm.email}</p>
            {confirm.action === "suspend" && (
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
                onClick={() =>
                  updateUser(confirm.id, {
                    status: confirm.action === "suspend" ? "suspended" : "active",
                    reason: confirmReason || undefined,
                  })
                }
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${
                  confirm.action === "suspend" ? "bg-rose-600 hover:bg-rose-500" : "bg-emerald-600 hover:bg-emerald-500"
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
