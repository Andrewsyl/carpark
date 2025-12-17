"use client";

import { useState } from "react";
import { MapPinIcon, ClockIcon } from "@heroicons/react/24/outline";
import { AddressAutocomplete } from "../../../components/AddressAutocomplete";

async function getWalkingTime(origin: { lat: number; lng: number }, destination: { address: string; lat: number; lng: number }) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("Google Maps API key missing");
  // Directions
  const dirRes = await fetch(
    `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&mode=walking&key=${key}`
  );
  const dirData = (await dirRes.json()) as any;
  const leg = dirData.routes?.[0]?.legs?.[0];
  if (!leg) throw new Error("Could not compute walking route");

  return {
    destinationAddress: destination.address,
    durationText: leg.duration?.text,
    distanceText: leg.distance?.text,
  };
}

export function WalkTime({ origin }: { origin: { lat: number; lng: number } }) {
  const [destination, setDestination] = useState<{ address: string; lat: number; lng: number } | null>(null);
  const [result, setResult] = useState<{ destinationAddress: string; durationText: string; distanceText: string } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination) {
      setError("Choose a destination.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await getWalkingTime(origin, destination);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not calculate walking time");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card space-y-3">
      <p className="text-sm font-semibold text-slate-800">Walking time</p>
      <form onSubmit={handleCheck} className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex-1">
          <AddressAutocomplete
            placeholder="Enter destination (e.g. Aviva Stadium)"
            onPlace={(place) => setDestination(place)}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full sm:w-auto"
        >
          {loading ? "Calculating…" : "Get time"}
        </button>
      </form>
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
      {result && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <ClockIcon className="h-4 w-4" />
            {result.durationText} walk
          </div>
          <div className="flex items-center gap-2">
            <MapPinIcon className="h-4 w-4 text-brand-600" />
            <span>{result.destinationAddress}</span>
            <span className="text-xs text-slate-500">({result.distanceText})</span>
          </div>
        </div>
      )}
      {!result && !error && (
        <p className="text-xs text-slate-500">We’ll geocode your destination and show the walking time from this space.</p>
      )}
    </div>
  );
}
