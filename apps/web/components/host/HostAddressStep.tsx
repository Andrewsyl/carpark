"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { AddressAutocomplete } from "../AddressAutocomplete";
import type { HostStepProps } from "./types";

const MapView = dynamic(() => import("../MapView").then((mod) => mod.MapView), { ssr: false });

export function HostAddressStep({ data, onUpdate }: HostStepProps) {
  const [address, setAddress] = useState(data.address ?? "");

  useEffect(() => {
    setAddress(data.address ?? "");
  }, [data.address]);

  const hasCoordinates = typeof data.latitude === "number" && typeof data.longitude === "number";

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-800">Where is your space?</label>
        <AddressAutocomplete
          defaultValue={data.address}
          placeholder="Search for an address"
          onPlace={(place) => {
            setAddress(place.address);
            onUpdate({ address: place.address, latitude: place.lat, longitude: place.lng, locationConfirmed: false });
          }}
          name="address"
        />
        <p className="text-xs text-slate-500">We&apos;ll use this to position your listing on the map.</p>
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-inner">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Confirm on map</p>
            <p className="text-sm text-slate-600">We place a pin at your address. Confirm it looks right.</p>
          </div>
          <button
            type="button"
            disabled={!hasCoordinates}
            onClick={() => onUpdate({ locationConfirmed: true })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand-200 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {data.locationConfirmed ? "Confirmed" : "Confirm location"}
          </button>
        </div>
        <div className="h-64 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          {hasCoordinates ? (
            <MapView
              listings={[]}
              center={{ lat: data.latitude!, lng: data.longitude! }}
              initialZoom={20}
              maxZoom={21}
              minFitZoom={20}
              showCenterPin
              disableAutoFit
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">Select an address to preview</div>
          )}
        </div>
        <p className="text-xs text-slate-500">
          {data.locationConfirmed ? "Location confirmed." : "Tap confirm once the pin matches your space entrance."}
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">Address preview</label>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
          {address || "No address selected yet"}
        </div>
      </div>
    </div>
  );
}
