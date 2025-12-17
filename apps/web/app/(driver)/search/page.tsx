"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ListingCard, type Listing } from "../../../components/ListingCard";
import { SearchForm, type SearchFilters } from "../../../components/SearchForm";
import { MapView } from "../../../components/MapView";
import { searchSpaces } from "../../../lib/api";

const defaultFilters: SearchFilters = {
  location: "Dublin City Centre",
  date: new Date().toISOString().split("T")[0],
  endDate: undefined,
  startTime: "09:00",
  endTime: "18:00",
  radiusKm: 5,
  latitude: 53.3498,
  longitude: -6.2603,
  mode: "daily",
  priceMin: undefined,
  priceMax: undefined,
  coveredParking: undefined,
  evCharging: undefined,
  securityLevel: undefined,
  vehicleSize: undefined,
  instantBook: undefined,
};

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-slate-600">Loading search…</div>}>
      <SearchPageContent />
    </Suspense>
  );
}

function SearchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialized = useRef(false);
  const lastQueryRef = useRef<string>("");
  const lastSearchRef = useRef<string>("");
  const initialFromUrl = useMemo(() => {
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    const radiusKm = searchParams.get("radiusKm");
    const date = searchParams.get("date");
    const startTime = searchParams.get("startTime");
    const endTime = searchParams.get("endTime");
    const location = searchParams.get("location");
    const endDate = searchParams.get("endDate");
    const mode = searchParams.get("mode") as SearchFilters["mode"] | null;
    const priceMin = searchParams.get("priceMin");
    const priceMax = searchParams.get("priceMax");
    const coveredParking = searchParams.get("coveredParking");
    const evCharging = searchParams.get("evCharging");
    const securityLevel = searchParams.get("securityLevel") as SearchFilters["securityLevel"] | null;
    const vehicleSize = searchParams.get("vehicleSize") as SearchFilters["vehicleSize"] | null;
    const instantBook = searchParams.get("instantBook");
    return {
      location: location ?? undefined,
      date: date ?? undefined,
      endDate: endDate ?? undefined,
      startTime: startTime ?? undefined,
      endTime: endTime ?? undefined,
      radiusKm: radiusKm ? Number(radiusKm) : undefined,
      latitude: lat ? Number(lat) : undefined,
      longitude: lng ? Number(lng) : undefined,
      mode: mode ?? undefined,
      priceMin: priceMin ? Number(priceMin) : undefined,
      priceMax: priceMax ? Number(priceMax) : undefined,
      coveredParking: coveredParking === "true" ? true : undefined,
      evCharging: evCharging === "true" ? true : undefined,
      securityLevel: securityLevel ?? undefined,
      vehicleSize: vehicleSize ?? undefined,
      instantBook: instantBook === "true" ? true : undefined,
    } as Partial<SearchFilters>;
  }, [searchParams]);

  const [filters, setFilters] = useState<SearchFilters>(defaultFilters);
  const [results, setResults] = useState<Listing[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [showFullMap, setShowFullMap] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const merged: SearchFilters = {
      ...defaultFilters,
      ...initialFromUrl,
      latitude: initialFromUrl.latitude ?? defaultFilters.latitude,
      longitude: initialFromUrl.longitude ?? defaultFilters.longitude,
      radiusKm: initialFromUrl.radiusKm ?? defaultFilters.radiusKm,
      date: initialFromUrl.date ?? defaultFilters.date,
      startTime: initialFromUrl.startTime ?? defaultFilters.startTime,
      endTime: initialFromUrl.endTime ?? defaultFilters.endTime,
    };

    const isSame = (a: SearchFilters, b: SearchFilters) =>
      a.location === b.location &&
      a.date === b.date &&
      a.endDate === b.endDate &&
      a.startTime === b.startTime &&
      a.endTime === b.endTime &&
      a.radiusKm === b.radiusKm &&
      a.latitude === b.latitude &&
      a.longitude === b.longitude &&
      a.mode === b.mode &&
      a.priceMin === b.priceMin &&
      a.priceMax === b.priceMax &&
      a.coveredParking === b.coveredParking &&
      a.evCharging === b.evCharging &&
      a.securityLevel === b.securityLevel &&
      a.vehicleSize === b.vehicleSize &&
      a.instantBook === b.instantBook;

    const currentQuery = searchParams.toString();

    if (!initialized.current) {
      initialized.current = true;
      lastQueryRef.current = currentQuery;
      setFilters(merged);
      handleSearch(merged);
      return;
    }

    if (currentQuery === lastQueryRef.current) {
      if (!isSame(merged, filters)) {
        setFilters(merged);
      }
      return;
    }

    setFilters(merged);
    handleSearch(merged);
    lastQueryRef.current = currentQuery;
  }, [initialFromUrl, searchParams]);

  const handleSearch = async (nextFilters: SearchFilters) => {
    const signature = JSON.stringify({
      location: nextFilters.location,
      date: nextFilters.date,
      endDate: nextFilters.endDate,
      startTime: nextFilters.startTime,
      endTime: nextFilters.endTime,
      radiusKm: nextFilters.radiusKm,
      latitude: nextFilters.latitude,
      longitude: nextFilters.longitude,
      mode: nextFilters.mode,
      priceMin: nextFilters.priceMin,
      priceMax: nextFilters.priceMax,
      coveredParking: nextFilters.coveredParking,
      evCharging: nextFilters.evCharging,
      securityLevel: nextFilters.securityLevel,
      vehicleSize: nextFilters.vehicleSize,
      instantBook: nextFilters.instantBook,
    });

    if (signature === lastSearchRef.current) {
      return;
    }
    lastSearchRef.current = signature;

    setStatus("loading");
    setError(null);
    setFilters(nextFilters);
    const params = new URLSearchParams();
    params.set("location", nextFilters.location);
    params.set("date", nextFilters.date);
    params.set("startTime", nextFilters.startTime);
    params.set("endTime", nextFilters.endTime);
    params.set("radiusKm", String(nextFilters.radiusKm));
    if (nextFilters.mode) params.set("mode", nextFilters.mode);
    if (nextFilters.endDate) params.set("endDate", nextFilters.endDate);
    if (nextFilters.latitude !== undefined) params.set("lat", String(nextFilters.latitude));
    if (nextFilters.longitude !== undefined) params.set("lng", String(nextFilters.longitude));
    if (nextFilters.priceMin !== undefined) params.set("priceMin", String(nextFilters.priceMin));
    if (nextFilters.priceMax !== undefined) params.set("priceMax", String(nextFilters.priceMax));
    if (nextFilters.coveredParking) params.set("coveredParking", "true");
    if (nextFilters.evCharging) params.set("evCharging", "true");
    if (nextFilters.securityLevel) params.set("securityLevel", nextFilters.securityLevel);
    if (nextFilters.vehicleSize) params.set("vehicleSize", nextFilters.vehicleSize);
    if (nextFilters.instantBook) params.set("instantBook", "true");
    const nextQuery = params.toString();
    lastQueryRef.current = nextQuery;
    if (nextQuery !== searchParams.toString()) {
      router.replace(`/search?${nextQuery}`);
    }
    try {
      const data = await searchSpaces(nextFilters);
      setResults(data);
      setStatus("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setStatus("error");
    }
  };

  const center = { lat: filters.latitude ?? 53.3498, lng: filters.longitude ?? -6.2603 };

  return (
    <div className="lg:grid lg:grid-cols-[560px,1fr] lg:grid-rows-[auto,1fr] lg:gap-8 lg:h-[calc(100vh-160px)] lg:overflow-hidden">
      <div className="card shadow-lg lg:col-span-2 lg:sticky lg:top-4 lg:z-10">
        <SearchForm initialValues={filters} onSearch={handleSearch} onOpenFilters={() => setShowFilters(true)} />
      </div>

      <div className="space-y-3 lg:row-start-2 lg:flex lg:h-full lg:flex-col lg:overflow-hidden lg:pr-4">
        {showFilters ? (
          <FiltersPanel
            initialFilters={filters}
            onApply={(next) => {
              handleSearch(next);
              setShowFilters(false);
            }}
            onCancel={() => setShowFilters(false)}
            onLiveChange={handleSearch}
          />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Stays in Dublin</p>
                <h1 className="text-2xl font-bold text-slate-900">{results.length} spaces</h1>
                <p className="text-sm text-slate-600">
                  Within {filters.radiusKm} km •{" "}
                  {filters.mode === "monthly"
                    ? `${filters.date} → ${filters.endDate ?? "30 days out"}`
                    : `${filters.date} ${filters.startTime}-${filters.endTime}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowFilters(true)}
                  className="hidden rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-brand-200 hover:text-brand-700 lg:inline-flex"
                >
                  Filters
                </button>
                <button
                  type="button"
                  onClick={() => setShowFullMap(true)}
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 lg:hidden"
                >
                  View map
                </button>
              </div>
            </div>

            {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
            {status === "loading" && <div className="text-sm text-slate-600">Searching…</div>}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 lg:flex-1 lg:overflow-y-auto lg:pb-4 lg:pr-1">
              {results.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
            {status === "idle" && results.length === 0 && !error && (
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                No spaces returned yet. Add listings or adjust radius. Coordinates default to Dublin city centre until Maps autocomplete is connected.
              </div>
            )}
          </>
        )}
      </div>

      <div className="hidden h-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg lg:row-start-2 lg:mt-2 lg:block">
        <MapView listings={results} center={center} radiusKm={filters.radiusKm} initialZoom={14} maxZoom={14} />
      </div>

      {showFullMap && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm">
          <div className="absolute inset-4 rounded-2xl bg-white shadow-2xl ring-1 ring-black/10">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Map view</p>
                <p className="text-sm text-slate-600">
                  {results.length} spaces within {filters.radiusKm} km
                </p>
              </div>
              <button
                onClick={() => setShowFullMap(false)}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
            <div className="h-[80vh] rounded-b-2xl">
              <MapView listings={results} center={center} radiusKm={filters.radiusKm} initialZoom={13} maxZoom={13} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FiltersPanel({
  initialFilters,
  onApply,
  onCancel,
  onLiveChange,
}: {
  initialFilters: SearchFilters;
  onApply: (filters: SearchFilters) => void;
  onCancel: () => void;
  onLiveChange?: (filters: SearchFilters) => void;
}) {
  const [pending, setPending] = useState<SearchFilters>(initialFilters);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const firstRenderRef = useRef(true);

  useEffect(() => {
    setPending(initialFilters);
  }, [initialFilters]);

  const update = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
    setPending((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    if (!onLiveChange) return;
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onLiveChange(pending);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [pending, onLiveChange]);

  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg lg:overflow-y-auto">
      <div className="flex items-center justify-between pb-1">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Filters</p>
          <p className="text-sm text-slate-600">Refine by radius, price, amenities, and booking type.</p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          Close
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onApply(pending);
        }}
        className="flex flex-1 flex-col gap-3"
      >
        <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
          Mode
          <div className="flex gap-2">
            {(["daily", "monthly"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => update("mode", mode)}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  pending.mode === mode
                    ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200"
                    : "bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                {mode === "daily" ? "Daily" : "Monthly"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
          Radius (km)
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={15}
              step={1}
              value={pending.radiusKm}
              onChange={(e) => update("radiusKm", Number(e.target.value))}
              className="flex-1 accent-brand-600"
            />
            <span className="w-12 text-right text-sm font-semibold text-slate-700">{pending.radiusKm}</span>
          </div>
          <span className="text-xs font-normal text-slate-500">Map will fit to this radius.</span>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
          Price per day
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min={0}
              placeholder="Min"
              value={pending.priceMin ?? ""}
              onChange={(e) => update("priceMin", e.target.value ? Number(e.target.value) : undefined)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
            />
            <input
              type="number"
              min={0}
              placeholder="Max"
              value={pending.priceMax ?? ""}
              onChange={(e) => update("priceMax", e.target.value ? Number(e.target.value) : undefined)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
            />
          </div>
          <span className="text-xs font-normal text-slate-500">Set both for a tighter price band.</span>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
          Vehicle size
          <select
            value={pending.vehicleSize ?? ""}
            onChange={(e) => update("vehicleSize", e.target.value ? (e.target.value as SearchFilters["vehicleSize"]) : undefined)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
          >
            <option value="">Any size</option>
            <option value="motorcycle">Motorcycle</option>
            <option value="car">Car</option>
            <option value="van">Van / large</option>
          </select>
          <span className="text-xs font-normal text-slate-500">Helps surface spots that fit your vehicle.</span>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
          Security
          <select
            value={pending.securityLevel ?? ""}
            onChange={(e) => update("securityLevel", e.target.value ? (e.target.value as SearchFilters["securityLevel"]) : undefined)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
          >
            <option value="">Any</option>
            <option value="basic">Basic</option>
            <option value="gated">Gated</option>
            <option value="cctv">CCTV / monitored</option>
          </select>
          <span className="text-xs font-normal text-slate-500">Choose the level of oversight you want.</span>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
          Booking preference
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!pending.instantBook}
              onChange={(e) => update("instantBook", e.target.checked)}
              className="h-4 w-4 accent-brand-600"
            />
            Instant book only
          </label>
          <span className="text-xs font-normal text-slate-500">Skip approval and book immediately.</span>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
          <span className="text-xs uppercase tracking-wide text-slate-500">Amenities</span>
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-200">
            <input
              type="checkbox"
              checked={!!pending.coveredParking}
              onChange={(e) => update("coveredParking", e.target.checked)}
              className="h-4 w-4 accent-brand-600"
            />
            Covered parking
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-200">
            <input
              type="checkbox"
              checked={!!pending.evCharging}
              onChange={(e) => update("evCharging", e.target.checked)}
              className="h-4 w-4 accent-brand-600"
            />
            EV charging
          </label>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 pt-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button type="submit" className="btn-primary px-5">
            Apply filters
          </button>
        </div>
      </form>
    </div>
  );
}
