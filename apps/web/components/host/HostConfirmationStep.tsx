"use client";

import type { HostStepProps } from "./types";
import { buildTitleFromDraft, prettySpaceType } from "./utils";

export function HostConfirmationStep({ data }: HostStepProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-sm font-semibold text-slate-800">Summary</div>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <dt className="w-28 text-slate-600">Address</dt>
            <dd className="text-slate-900">{data.address || "Missing"}</dd>
          </div>
          <div className="flex items-start gap-2">
            <dt className="w-28 text-slate-600">Space type</dt>
            <dd className="text-slate-900">{data.spaceType ? prettySpaceType(data.spaceType) : "Missing"}</dd>
          </div>
          <div className="flex items-start gap-2">
            <dt className="w-28 text-slate-600">Title</dt>
            <dd className="text-slate-900">{buildTitleFromDraft(data)}</dd>
          </div>
          <div className="flex items-start gap-2">
            <dt className="w-28 text-slate-600">Availability</dt>
            <dd className="text-slate-900 whitespace-pre-line">{data.availabilityText || "Missing"}</dd>
          </div>
          <div className="flex items-start gap-2">
            <dt className="w-28 text-slate-600">Price</dt>
            <dd className="text-slate-900">
              {data.pricePerDay ? `€${data.pricePerDay} per day` : "Missing"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="text-sm font-semibold text-slate-800">Visuals & amenities</div>
        {data.imageUrls.length > 0 ? (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {data.imageUrls.map((url, idx) => (
              <div key={url + idx} className="h-20 overflow-hidden rounded-lg border border-slate-200">
                <img src={url} alt="Listing" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No photos uploaded yet.</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {data.amenities.length > 0 ? (
            data.amenities.map((item) => (
              <span key={item} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {item}
              </span>
            ))
          ) : (
            <p className="text-sm text-slate-500">No amenities selected.</p>
          )}
        </div>
      </div>
    </div>
  );
}
