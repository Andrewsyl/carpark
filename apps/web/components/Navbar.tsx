"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";
import { useAppStatus } from "./AppStatusProvider";

const links: { href: Route; label: string }[] = [
  { href: "/", label: "Home" },
  { href: "/search", label: "Find parking" },
  { href: "/host", label: "List a space" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/host/dashboard", label: "Host dashboard" },
];

export function Navbar() {
  const { user, signOut } = useAuth();
  const { isLoading, error, setError } = useAppStatus();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (open && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("click", onClickOutside);
    return () => document.removeEventListener("click", onClickOutside);
  }, [open]);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/80 backdrop-blur">
      {isLoading && <div className="h-1 animate-pulse bg-brand-500" />}
      {error && (
        <div className="bg-rose-500 p-2 text-center text-sm text-white">
          {error}
          <button onClick={() => setError(null)} className="ml-4 font-bold">
            ✕
          </button>
        </div>
      )}
      <div className="flex w-full items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="text-lg font-bold text-brand-700">
          ParkShare Dublin
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-700 sm:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-brand-700">
              {link.label}
            </Link>
          ))}
        </nav>
        {user ? (
          <div className="relative text-sm" ref={menuRef}>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-900 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-bold uppercase text-white">
                {user.email.slice(0, 2)}
              </span>
              <span className="hidden sm:inline">{user.email}</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-4 w-4 text-slate-500 transition ${open ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {open && (
              <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                <div className="px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Signed in</p>
                  <p className="truncate text-sm font-semibold text-slate-900">{user.email}</p>
                </div>
                <div className="border-t border-slate-100">
                  <Link
                    href="/dashboard"
                    className="block px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    onClick={() => setOpen(false)}
                  >
                    Profile & trips
                  </Link>
                  <Link
                    href="/host/dashboard"
                    className="block px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    onClick={() => setOpen(false)}
                  >
                    Host dashboard
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      signOut();
                    }}
                    className="block w-full px-4 py-3 text-left text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                  >
                    Log out
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <Link href="/login" className="rounded-lg px-3 py-2 font-semibold text-slate-700 hover:bg-slate-100">
              Sign in
            </Link>
            <Link href="/signup" className="btn-primary">
              Get started
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
