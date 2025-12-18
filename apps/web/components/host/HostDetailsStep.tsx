"use client";

import { useMemo, useState } from "react";
import { ImageUploader } from "../ImageUploader";
import type { HostStepProps } from "./types";
import { buildTitleFromDraft } from "./utils";

const PRESET_AMENITIES = ["CCTV", "EV charging", "Sheltered", "Well lit", "Gated access", "Height-friendly"];

export function HostDetailsStep({ data, onUpdate }: HostStepProps) {
  const [customAmenity, setCustomAmenity] = useState("");
  const generatedTitle = useMemo(() => buildTitleFromDraft(data), [data]);

  const toggleAmenity = (value: string) => {
    const hasAmenity = data.amenities.includes(value);
    const nextAmenities = hasAmenity ? data.amenities.filter((a) => a !== value) : [...data.amenities, value];
    onUpdate({ amenities: nextAmenities });
  };

  const addCustomAmenity = () => {
    const trimmed = customAmenity.trim();
    if (!trimmed) return;
    if (!data.amenities.includes(trimmed)) {
      onUpdate({ amenities: [...data.amenities, trimmed] });
    }
    setCustomAmenity("");
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-800">Auto-generated title</label>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900">
          {generatedTitle}
        </div>
        <p className="text-xs text-slate-500">We&apos;ll generate the title from your address and space type—no typing needed.</p>
      </div>

      <div className="space-y-3">
        <div className="text-sm font-semibold text-slate-800">Amenities</div>
        <div className="flex flex-wrap gap-2">
          {PRESET_AMENITIES.map((item) => {
            const selected = data.amenities.includes(item);
            return (
              <button
                key={item}
                type="button"
                onClick={() => toggleAmenity(item)}
                className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                  selected
                    ? "bg-brand-50 text-brand-800 ring-1 ring-brand-300"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={customAmenity}
            onChange={(e) => setCustomAmenity(e.target.value)}
            placeholder="Add your own"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none sm:w-64"
          />
          <button
            type="button"
            onClick={addCustomAmenity}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Add
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <ImageUploader
          onUpload={(url) => {
            onUpdate({ imageUrls: [...data.imageUrls, url] });
          }}
        />
        {data.imageUrls.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {data.imageUrls.map((url, idx) => (
              <div key={url + idx} className="relative h-24 w-24 overflow-hidden rounded-lg border border-slate-200">
                <img src={url} alt="Listing" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
