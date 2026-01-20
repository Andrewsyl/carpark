"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { verifyEmail } from "../../lib/api";

export default function VerifyPage() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState<string>("Verifying your email…");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Missing token.");
      return;
    }
    verifyEmail(token)
      .then(() => {
        setStatus("success");
        setMessage("Email verified! You can continue.");
        setTimeout(() => router.push("/dashboard"), 1200);
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Verification failed.");
      });
  }, [token, router]);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="card space-y-3 text-center">
        <p className="text-sm font-semibold tracking-wide text-brand-700">Email verification</p>
        <h1 className="text-2xl tracking-tight font-semibold text-slate-900">
          {status === "loading" ? "Verifying…" : status === "success" ? "All set" : "Verification failed"}
        </h1>
        <p className="text-sm text-slate-600">{message}</p>
        <div className="flex justify-center gap-2">
          <Link href="/login" className="btn-primary">
            Back to login
          </Link>
          <Link href="/dashboard" className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            Go to app
          </Link>
        </div>
      </div>
    </div>
  );
}
