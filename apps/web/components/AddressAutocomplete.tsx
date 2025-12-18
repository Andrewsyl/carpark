"use client";

import { useEffect, useRef } from "react";

export type PlaceResult = {
  address: string;
  lat: number;
  lng: number;
};

export function AddressAutocomplete({
  defaultValue,
  placeholder,
  onPlace,
  name,
}: {
  defaultValue?: string;
  placeholder?: string;
  onPlace: (place: PlaceResult) => void;
  name?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input || !(window as any).google?.maps?.places) return;

    const autocomplete = new (window as any).google.maps.places.Autocomplete(input, {
      fields: ["formatted_address", "geometry"],
      componentRestrictions: { country: "ie" },
    });

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place.geometry?.location || !place.formatted_address) return;
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      onPlace({ address: place.formatted_address, lat, lng });
    });

    return () => {
      (window as any).google?.maps?.event?.clearInstanceListeners(autocomplete);
    };
  }, [onPlace]);

  return (
    <div className="relative w-full">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">📍</span>
      <input
        ref={inputRef}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder ?? "Search address"}
        className="w-full rounded-2xl border border-slate-200 bg-white px-9 py-3 text-sm font-semibold text-slate-800 shadow-sm transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none hover:border-brand-200"
        style={{ fontFamily: '"Poppins","Inter",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', fontWeight: 600 }}
        onBlur={(e) => {
          if ((window as any).google?.maps?.places) return;
          if (!e.target.value) return;
          // Fallback: emit typed address with default coords only if nothing was set yet.
          onPlace({ address: e.target.value, lat: 53.3498, lng: -6.2603 });
        }}
      />
    </div>
  );
}
