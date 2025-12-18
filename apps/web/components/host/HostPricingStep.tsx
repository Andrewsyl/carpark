"use client";

import type { HostStepProps } from "./types";

export function HostPricingStep({ data, onUpdate }: HostStepProps) {
  const value = data.pricePerDay ?? "";

  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-slate-800">Price per day (€)</label>
      <input
        type="number"
        min={1}
        step={1}
        value={value}
        onChange={(e) => {
          const parsed = Number(e.target.value);
          onUpdate({ pricePerDay: Number.isNaN(parsed) ? undefined : parsed });
        }}
        placeholder="15"
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none sm:w-64"
      />
      <p className="text-xs text-slate-500">You can update pricing anytime from your dashboard.</p>
    </div>
  );
}
