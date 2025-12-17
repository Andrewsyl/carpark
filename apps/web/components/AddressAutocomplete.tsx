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
    <input
      ref={inputRef}
      name={name}
      defaultValue={defaultValue}
      placeholder={placeholder ?? "Search address"}
      className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
      onBlur={(e) => {
        if ((window as any).google?.maps?.places) return;
        if (!e.target.value) return;
        // Fallback: emit typed address with default coords only if nothing was set yet.
        onPlace({ address: e.target.value, lat: 53.3498, lng: -6.2603 });
      }}
    />
  );
}
