"use client";

import type { ReactNode } from "react";

type Props = {
  title: string;
  step: number;
  totalSteps: number;
  description?: string;
  children: ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  backDisabled?: boolean;
  loading?: boolean;
};

export function HostStepperLayout({
  title,
  step,
  totalSteps,
  description,
  children,
  onBack,
  onNext,
  nextLabel = "Next",
  nextDisabled,
  backDisabled,
  loading,
}: Props) {
  const progress = Math.round((step / totalSteps) * 100);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-brand-700">
              Step {step} of {totalSteps}
            </p>
            <h1 className="text-3xl tracking-tight font-semibold text-slate-900">{title}</h1>
          </div>
          <div className="hidden h-10 flex-1 items-center rounded-full bg-slate-100 sm:flex">
            <div
              className="h-full rounded-full bg-brand-600 transition-all"
              style={{ width: `${progress}%` }}
              aria-label={`Progress ${progress}%`}
            />
          </div>
        </div>
        {description && <p className="max-w-3xl text-sm text-slate-600">{description}</p>}
      </header>

      <div className="card space-y-6">
        <div className="h-2 w-full rounded-full bg-slate-100 sm:hidden">
          <div
            className="h-full rounded-full bg-brand-600 transition-all"
            style={{ width: `${progress}%` }}
            aria-hidden
          />
        </div>
        <div className="space-y-4">{children}</div>
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onBack}
            disabled={!onBack || backDisabled}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Back
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={nextDisabled}
            className="btn-primary min-w-[140px] justify-center disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Saving…" : nextLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
