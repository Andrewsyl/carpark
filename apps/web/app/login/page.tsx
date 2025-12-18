"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../components/AuthProvider";
import { requestVerification } from "../../lib/api";

export default function LoginPage() {
  const { signIn, loading, error } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [debug, setDebug] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await signIn(email, password);
      setDebug(`Login success for ${email}`);
      router.push("/dashboard");
    } catch {
      setDebug("Login failed; check console for details.");
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="space-y-2 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Welcome back</p>
        <h1 className="text-3xl font-bold text-slate-900">Sign in</h1>
        <p className="text-sm text-slate-600">Access your bookings and host dashboard.</p>
      </div>
      <form onSubmit={handleSubmit} className="card space-y-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Email
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Password
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
          />
        </label>
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
        {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
        {notice && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{notice}</div>}
        {debug && <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">{debug}</div>}
        <p className="text-center text-sm text-slate-600">
          No account?{" "}
          <Link href="/signup" className="font-semibold text-brand-700">
            Sign up
          </Link>
        </p>
        <button
          type="button"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          onClick={async () => {
            try {
              await requestVerification(email);
              setNotice("Verification email sent (if the account exists).");
            } catch (err) {
              setNotice(err instanceof Error ? err.message : "Could not send verification email");
            }
          }}
        >
          Resend verification email
        </button>
      </form>
    </div>
  );
}
