"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const haversineKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
};

const radiusFromBounds = (bounds: google.maps.LatLngBoundsLiteral, center: { lat: number; lng: number }) => {
  const corners = [
    { lat: bounds.north, lng: bounds.east },
    { lat: bounds.north, lng: bounds.west },
    { lat: bounds.south, lng: bounds.east },
    { lat: bounds.south, lng: bounds.west },
  ];
  const distances = corners.map((c) => haversineKm(center, c));
  const maxKm = Math.max(...distances);
  return Math.max(0.05, Number(maxKm.toFixed(2))); // minimum 50m, rounded
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
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [showListingOverlay, setShowListingOverlay] = useState(false);
  const [pendingCenter, setPendingCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [mapDirty, setMapDirty] = useState(false);
  const [pendingBounds, setPendingBounds] = useState<any | null>(null);
  const [searchAsMove, setSearchAsMove] = useState(false);
  const [preserveViewport, setPreserveViewport] = useState(false);
  const [areaSearching, setAreaSearching] = useState(false);
  const lastAppliedCenter = useRef<{ lat: number; lng: number } | null>(null);
  const ignoreInitialBounds = useRef(true);

  const hasMovedMeaningfully = (c: { lat: number; lng: number }) => {
    const last = lastAppliedCenter.current;
    const curr = { lat: filters.latitude ?? 0, lng: filters.longitude ?? 0 };
    const delta = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
      Math.sqrt((a.lat - b.lat) ** 2 + (a.lng - b.lng) ** 2);
    const prevDelta = last ? delta(last, c) : Infinity;
    const currDelta = delta(curr, c);
    // Only mark dirty if moved more than ~0.003 degrees (~300m) from either last or current.
    return prevDelta > 0.003 && currDelta > 0.003;
  };

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

    const currentQuery = searchParams.toString();

    if (!initialized.current) {
      initialized.current = true;
      lastQueryRef.current = currentQuery;
      setFilters(merged);
      if (merged.latitude !== undefined && merged.longitude !== undefined) {
        lastAppliedCenter.current = { lat: merged.latitude, lng: merged.longitude };
      }
      setMapDirty(false);
      setPendingCenter(null);
      setPendingBounds(null);
      handleSearch(merged, true);
      return;
    }

    setFilters(merged);
    lastQueryRef.current = currentQuery;
  }, [initialFromUrl, searchParams]);

  const handleSearch = async (nextFilters: SearchFilters, force = false, options?: { preserveViewport?: boolean }) => {
    const preserve = !!options?.preserveViewport;
    setPreserveViewport(preserve);
    if (preserve) setAreaSearching(true);
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
      if (!force) return;
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
      if (nextFilters.latitude !== undefined && nextFilters.longitude !== undefined) {
        lastAppliedCenter.current = { lat: nextFilters.latitude, lng: nextFilters.longitude };
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setStatus("error");
    } finally {
      if (preserve) setAreaSearching(false);
    }
  };

  const center = useMemo(
    () => ({ lat: filters.latitude ?? 53.3498, lng: filters.longitude ?? -6.2603 }),
    [filters.latitude, filters.longitude]
  );

  const handleListingSelect = useCallback(
    (listing: Listing) => {
      // Only the explicit View button should navigate; selecting a card just highlights.
      setSelectedListingId(listing.id);
      setShowListingOverlay(false);
    },
    []
  );

  const handleMarkerSelect = useCallback((id: string) => {
    setSelectedListingId(id);
  }, []);

  const handleMarkerClick = useCallback((listing: Listing) => {
    setSelectedListingId(listing.id);
    setShowListingOverlay(true);
  }, []);

  const selectedListing = selectedListingId ? results.find((l) => l.id === selectedListingId) : null;
  const lockViewport = preserveViewport || searchAsMove || mapDirty;

  return (
    <div className="lg:grid lg:grid-cols-[540px,1fr] lg:gap-3 lg:px-2 lg:items-start">
      <div className="card shadow-lg lg:col-span-2 lg:sticky lg:top-4 lg:z-10">
        <SearchForm
          initialValues={filters}
          onSearch={(f) => handleSearch(f, true)}
          onOpenFilters={() => setShowFilters(true)}
          autoSearch={false}
          onAddressChange={(addr) => {
            const updated = { ...filters, location: addr.address, latitude: addr.lat, longitude: addr.lng };
            setFilters(updated);
            handleSearch(updated, true);
          }}
        />
      </div>

      <div className="space-y-3 lg:flex lg:h-[calc(100vh-180px)] lg:flex-col lg:overflow-y-auto lg:pr-2">
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
        ) : showListingOverlay && selectedListing ? (
          <ListingOverlay
            key={selectedListing.id}
            listing={selectedListing}
            onClose={() => setShowListingOverlay(false)}
            onOpen={() => router.push(`/listing/${selectedListing.id}`)}
          />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Stays in Dublin</p>
                <h1 className="text-2xl font-bold text-slate-900">{results.length} spaces</h1>
                <p className="text-sm text-slate-600">
                  {filters.mode === "monthly"
                    ? `${filters.date} → ${filters.endDate ?? "30 days out"}`
                    : `${filters.date} ${filters.startTime}-${filters.endTime}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                  <input
                    type="checkbox"
                    checked={searchAsMove}
                    onChange={(e) => setSearchAsMove(e.target.checked)}
                    className="h-4 w-4 accent-brand-600"
                  />
                  Search as I move
                </label>
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

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 lg:flex-1 lg:overflow-y-auto lg:pb-1 lg:px-2">
              {results.map((listing) => (
                <div
                  key={listing.id}
                  onClick={() => handleListingSelect(listing)}
                  className="cursor-pointer rounded-xl border border-slate-100 bg-white shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg"
                  style={{ animation: "slideUp 180ms ease-out" }}
                >
                  <ListingCard listing={listing} suppressNavigation selected={selectedListingId === listing.id} />
                </div>
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

      <div className="hidden lg:col-start-2 lg:block">
        <div className="relative h-[calc(100vh-170px)] rounded-2xl border border-slate-200 bg-white shadow-lg sticky top-4">
          <MapView
            listings={results}
            center={center}
            initialZoom={16}
            maxZoom={17}
            minFitZoom={16}
            showCenterPin
            selectedListingId={selectedListingId ?? undefined}
            onSelectListing={handleMarkerSelect}
            onMarkerClick={handleMarkerClick}
            disableAutoFit={lockViewport}
            onBoundsChanged={(b, c, z, userInteracted) => {
              if (ignoreInitialBounds.current) {
                ignoreInitialBounds.current = false;
                lastAppliedCenter.current = { lat: c.lat, lng: c.lng };
                return;
              }
              if (!userInteracted) return;
              if (hasMovedMeaningfully(c)) {
                if (searchAsMove) {
                  const radiusKm = radiusFromBounds(b, c);
                  const updated = { ...filters, latitude: c.lat, longitude: c.lng, radiusKm };
                  setFilters(updated);
                  handleSearch(updated, true, { preserveViewport: true });
                  lastAppliedCenter.current = { lat: updated.latitude!, lng: updated.longitude! };
                  setPendingCenter(null);
                  setPendingBounds(null);
                  setMapDirty(false);
                } else {
                  setPendingCenter({ lat: c.lat, lng: c.lng });
                  setPendingBounds(b);
                  setMapDirty(true);
                }
              }
            }}
          />
          {pendingCenter && mapDirty && !searchAsMove && (
            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
              <button
                type="button"
                disabled={areaSearching}
                onClick={() => {
                  const radiusKm = pendingBounds ? radiusFromBounds(pendingBounds, pendingCenter) : filters.radiusKm;
                  const updated = { ...filters, latitude: pendingCenter.lat, longitude: pendingCenter.lng, radiusKm };
                  setFilters(updated);
                  handleSearch(updated, true, { preserveViewport: true });
                  setPendingCenter(null);
                  setPendingBounds(null);
                  setMapDirty(false);
                  lastAppliedCenter.current = { lat: updated.latitude!, lng: updated.longitude! };
                }}
                className="pointer-events-auto rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-700 shadow-lg ring-1 ring-brand-200 transition hover:bg-brand-50 disabled:opacity-60"
              >
                {areaSearching ? "Searching…" : "Search this area"}
              </button>
            </div>
          )}
        </div>
      </div>

      {showFullMap && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm">
          <div className="absolute inset-4 rounded-2xl bg-white shadow-2xl ring-1 ring-black/10">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Map view</p>
                <p className="text-sm text-slate-600">{results.length} spaces</p>
              </div>
              <button
                onClick={() => setShowFullMap(false)}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
            <div className="h-[80vh] rounded-b-2xl">
              <div className="relative h-full">
                <MapView
                  listings={results}
                  center={center}
                  initialZoom={16}
                  maxZoom={17}
                  minFitZoom={16}
                  showCenterPin
                  selectedListingId={selectedListingId ?? undefined}
                  onSelectListing={handleMarkerSelect}
                  onMarkerClick={handleMarkerClick}
                  disableAutoFit={lockViewport}
                  onBoundsChanged={(b, c, z, userInteracted) => {
                    if (ignoreInitialBounds.current) {
                      ignoreInitialBounds.current = false;
                      lastAppliedCenter.current = { lat: c.lat, lng: c.lng };
                      return;
                    }
                    if (!userInteracted) return;
                    if (hasMovedMeaningfully(c)) {
                      if (searchAsMove) {
                        const radiusKm = radiusFromBounds(b, c);
                        const updated = { ...filters, latitude: c.lat, longitude: c.lng, radiusKm };
                        setFilters(updated);
                        handleSearch(updated, true, { preserveViewport: true });
                        lastAppliedCenter.current = { lat: updated.latitude!, lng: updated.longitude! };
                        setPendingCenter(null);
                        setPendingBounds(null);
                        setMapDirty(false);
                      } else {
                        setPendingCenter({ lat: c.lat, lng: c.lng });
                        setPendingBounds(b);
                        setMapDirty(true);
                      }
                    }
                  }}
                />
                {pendingCenter && mapDirty && !searchAsMove && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
                    <button
                      type="button"
                      disabled={areaSearching}
                      onClick={() => {
                        const radiusKm = pendingBounds ? radiusFromBounds(pendingBounds, pendingCenter) : filters.radiusKm;
                        const updated = { ...filters, latitude: pendingCenter.lat, longitude: pendingCenter.lng, radiusKm };
                        setFilters(updated);
                        handleSearch(updated, true, { preserveViewport: true });
                        setPendingCenter(null);
                        setPendingBounds(null);
                        setMapDirty(false);
                        lastAppliedCenter.current = { lat: updated.latitude!, lng: updated.longitude! };
                      }}
                      className="pointer-events-auto rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-700 shadow-lg ring-1 ring-brand-200 transition hover:bg-brand-50 disabled:opacity-60"
                    >
                      {areaSearching ? "Searching…" : "Search this area"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ListingOverlay({ listing, onClose, onOpen }: { listing: Listing; onClose: () => void; onOpen: () => void }) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    setEntered(false);
    const t = setTimeout(() => setEntered(true), 10);
    return () => clearTimeout(t);
  }, [listing.id]);

  const image = listingImage(listing, true);
  const isImageUrl = image?.startsWith("http");
  return (
    <div
      className={`flex h-full flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg transition-all ease-out lg:overflow-y-auto ${
        entered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      }`}
      style={{ transitionDuration: "1000ms", willChange: "opacity, transform" }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Listing</p>
          <h2 className="text-lg font-bold text-slate-900">{listing.title}</h2>
          <p className="text-sm text-slate-600">{listing.address}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          Close
        </button>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200">
        {isImageUrl ? (
          <img src={image} alt={listing.title} className="h-48 w-full object-cover" />
        ) : (
          <div
            className="flex h-48 w-full items-center justify-center text-lg font-semibold text-white"
            style={{ background: image }}
          >
            {listing.title}
          </div>
        )}
      </div>
      <div className="grid gap-2 text-sm text-slate-700">
        <span className="font-semibold text-slate-900">€{listing.pricePerDay} / day</span>
        <span>{listing.availability ?? "Available"}</span>
      </div>
      <div className="flex gap-2">
        <button onClick={onOpen} className="btn-primary flex-1 justify-center">
          View details
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          Back to list
        </button>
      </div>
    </div>
  );
}

function listingImage(listing: Listing, allowStaticMap = false): string | undefined {
  const url = (listing as any).imageUrls?.[0] ?? (listing as any).image;
  if (url) return url;

  if (allowStaticMap && typeof listing.latitude === "number" && typeof listing.longitude === "number") {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY;
    if (key) {
      return `https://maps.googleapis.com/maps/api/streetview?size=800x400&location=${listing.latitude},${listing.longitude}&key=${key}`;
    }
  }

  // Deterministic gradient fallback so listings vary visually.
  const seed = listing.id
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hue = seed % 360;
  const hue2 = (seed * 3) % 360;
  return `linear-gradient(135deg, hsl(${hue},70%,55%), hsl(${hue2},70%,45%))`;
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
          <p className="text-sm text-slate-600">Refine by price, amenities, and booking type.</p>
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
