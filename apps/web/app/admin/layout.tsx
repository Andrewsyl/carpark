"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../components/AuthProvider";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    if (user.role !== "admin") {
      router.replace("/");
    }
  }, [user, router]);

  if (!user || user.role !== "admin") {
    return <div className="p-6 text-sm text-slate-600">Checking admin access…</div>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[240px,1fr]">
      <aside className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Admin</p>
          <p className="text-sm font-semibold text-slate-900">Platform controls</p>
        </div>
        <nav className="space-y-2 text-sm font-semibold text-slate-700">
          <Link href="/admin/users" className="block rounded-lg px-3 py-2 hover:bg-slate-100">
            Users
          </Link>
          <Link href="/admin/listings" className="block rounded-lg px-3 py-2 hover:bg-slate-100">
            Listings
          </Link>
        </nav>
      </aside>
      <section>{children}</section>
    </div>
  );
}
