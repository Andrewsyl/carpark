"use client";

import Link from "next/link";

export default function AdminHome() {
  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl tracking-tight font-semibold text-slate-900">Admin dashboard</h1>
      <p className="text-sm text-slate-600">Quick links</p>
      <div className="flex flex-wrap gap-3">
        <Link href="/admin/users" className="btn-primary">
          Manage users
        </Link>
        <Link href="/admin/listings" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Moderate listings
        </Link>
      </div>
    </div>
  );
}
