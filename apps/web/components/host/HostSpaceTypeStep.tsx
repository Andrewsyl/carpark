"use client";

import type { HostStepProps } from "./types";

const OPTIONS = [
  { id: "driveway", label: "Driveway", detail: "Easy pull-in, right outside a home." },
  { id: "garage", label: "Garage", detail: "Sheltered space, extra weather protection." },
  { id: "carpark", label: "Car park / lot", detail: "Marked bay in a shared car park." },
  { id: "street", label: "Private street bay", detail: "Reserved kerbside spot with clear access." },
];

export function HostSpaceTypeStep({ data, onUpdate }: HostStepProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {OPTIONS.map((option) => {
        const selected = data.spaceType === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onUpdate({ spaceType: option.id })}
            className={`rounded-xl border px-4 py-4 text-left transition hover:-translate-y-0.5 hover:shadow-card ${
              selected ? "border-brand-500 bg-brand-50 shadow-card" : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-base font-semibold text-slate-900">{option.label}</div>
              {selected && <span className="text-sm font-semibold text-brand-700">Selected</span>}
            </div>
            <p className="mt-1 text-sm text-slate-600">{option.detail}</p>
          </button>
        );
      })}
    </div>
  );
}
