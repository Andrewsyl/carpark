"use client";

import type { HostStepProps } from "./types";

const QUICK_PRESETS = [
  "Available 24/7",
  "Weekdays 07:00 - 19:00",
  "Weekends only",
  "Evenings after 18:00",
];

export function HostAvailabilityStep({ data, onUpdate }: HostStepProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {QUICK_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onUpdate({ availabilityText: preset })}
            className="rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            {preset}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-800">Describe when the space is available</label>
        <textarea
          value={data.availabilityText}
          onChange={(e) => onUpdate({ availabilityText: e.target.value })}
          rows={4}
          placeholder="Example: Available 24/7, please call on arrival for gate code."
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
        />
        <p className="text-xs text-slate-500">This text appears on your listing. Keep it simple and clear.</p>
      </div>
    </div>
  );
}
