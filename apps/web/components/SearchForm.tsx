"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AddressAutocomplete } from "./AddressAutocomplete";

export type SearchFilters = {
  location: string;
  date: string;
  endDate?: string;
  startTime: string;
  endTime: string;
  radiusKm: number;
  latitude?: number;
  longitude?: number;
  mode?: "daily" | "monthly";
  priceMin?: number;
  priceMax?: number;
  coveredParking?: boolean;
  evCharging?: boolean;
  securityLevel?: "basic" | "gated" | "cctv";
  vehicleSize?: "motorcycle" | "car" | "van";
  instantBook?: boolean;
};

export function SearchForm({
  initialValues,
  onSearch,
  redirectToSearch = false,
  compact = false,
  onOpenFilters,
}: {
  initialValues?: Partial<SearchFilters>;
  onSearch?: (filters: SearchFilters) => void;
  redirectToSearch?: boolean;
  compact?: boolean;
  onOpenFilters?: () => void;
}) {
  const router = useRouter();
  const skipAutoSearch = useRef(true);
  const syncingFromProps = useRef(false);
  const [filters, setFilters] = useState<SearchFilters>({
    location: initialValues?.location ?? "Dublin City Centre",
    date: initialValues?.date ?? new Date().toISOString().split("T")[0],
    endDate: initialValues?.endDate,
    startTime: initialValues?.startTime ?? "09:00",
    endTime: initialValues?.endTime ?? "18:00",
    radiusKm: initialValues?.radiusKm ?? 5,
    latitude: initialValues?.latitude ?? 53.3498,
    longitude: initialValues?.longitude ?? -6.2603,
    mode: initialValues?.mode ?? "daily",
    priceMin: initialValues?.priceMin,
    priceMax: initialValues?.priceMax,
    coveredParking: initialValues?.coveredParking,
    evCharging: initialValues?.evCharging,
    securityLevel: initialValues?.securityLevel,
    vehicleSize: initialValues?.vehicleSize,
    instantBook: initialValues?.instantBook,
  });

  useEffect(() => {
    if (!initialValues) return;
    syncingFromProps.current = true;
    setFilters((prev) => ({
      ...prev,
      ...initialValues,
    }));
  }, [initialValues]);

  const update = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const buildSubmission = (state: SearchFilters): SearchFilters => {
    const submission = { ...state };
    if (state.mode === "monthly") {
      const end = new Date(state.date);
      end.setMonth(end.getMonth() + 1);
      submission.startTime = "00:00";
      submission.endTime = "23:59";
      submission.endDate = end.toISOString().split("T")[0];
    }
    return submission;
  };

  useEffect(() => {
    if (!onSearch || redirectToSearch) return;
    if (skipAutoSearch.current) {
      skipAutoSearch.current = false;
      return;
    }
    if (syncingFromProps.current) {
      syncingFromProps.current = false;
      return;
    }
    const timer = setTimeout(() => {
      onSearch(buildSubmission(filters));
    }, 300);
    return () => clearTimeout(timer);
  }, [filters, onSearch, redirectToSearch]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submission = buildSubmission(filters);
    if (onSearch) {
      onSearch(submission);
      return;
    }
    if (redirectToSearch) {
      const params = new URLSearchParams({
        location: submission.location,
        date: submission.date,
        startTime: submission.startTime,
        endTime: submission.endTime,
        radiusKm: String(submission.radiusKm),
        mode: submission.mode ?? "daily",
      });
      if (submission.endDate) params.set("endDate", submission.endDate);
      if (submission.latitude !== undefined) params.set("lat", String(submission.latitude));
      if (submission.longitude !== undefined) params.set("lng", String(submission.longitude));
      if (submission.priceMin !== undefined) params.set("priceMin", String(submission.priceMin));
      if (submission.priceMax !== undefined) params.set("priceMax", String(submission.priceMax));
      if (submission.coveredParking) params.set("coveredParking", "true");
      if (submission.evCharging) params.set("evCharging", "true");
      if (submission.securityLevel) params.set("securityLevel", submission.securityLevel);
      if (submission.vehicleSize) params.set("vehicleSize", submission.vehicleSize);
      if (submission.instantBook) params.set("instantBook", "true");
      router.push(`/search?${params.toString()}`);
      return;
    }
  };

  return compact ? (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-center gap-2 rounded-full border border-slate-200 bg-white p-2 shadow-xl"
    >
      <div className="flex items-center gap-2 rounded-full bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
        {(["daily", "monthly"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => update("mode", mode)}
            className={`rounded-full px-3 py-1 ${filters.mode === mode ? "bg-white text-brand-700 shadow-sm" : "hover:bg-white/80"}`}
          >
            {mode === "daily" ? "Daily" : "Monthly"}
          </button>
        ))}
      </div>
      <div className="h-10 w-px bg-slate-200 hidden sm:block" />
      <div className="flex min-w-[180px] flex-1 flex-col gap-1 text-sm font-medium text-slate-700">
        <AddressAutocomplete
          defaultValue={filters.location}
          placeholder="Where to?"
          onPlace={(place) => {
            update("location", place.address);
            update("latitude", place.lat);
            update("longitude", place.lng);
          }}
        />
      </div>
      <div className="h-10 w-px bg-slate-200 hidden sm:block" />
      <div className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        <input
          type="date"
          value={filters.date}
          onChange={(e) => update("date", e.target.value)}
          className="rounded-full border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
        />
      </div>
      <div className="h-10 w-px bg-slate-200 hidden sm:block" />
      {filters.mode === "daily" ? (
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="time"
            value={filters.startTime}
            onChange={(e) => update("startTime", e.target.value)}
            className="rounded-full border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
          />
          <span className="text-slate-500">-</span>
          <input
            type="time"
            value={filters.endTime}
            onChange={(e) => update("endTime", e.target.value)}
            className="rounded-full border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <span className="rounded-full bg-slate-100 px-3 py-1">All day</span>
          <span className="rounded-full bg-slate-100 px-3 py-1">30 days</span>
        </div>
      )}
      <button
        type="submit"
        className="rounded-full bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-md hover:bg-brand-700 sm:ml-auto"
      >
        Search
      </button>
    </form>
  ) : (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 lg:flex-row lg:items-end lg:gap-4">
        <div className="flex flex-1 flex-col gap-1 text-sm font-medium text-slate-700">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Where</span>
          <AddressAutocomplete
            defaultValue={filters.location}
            placeholder="Search by area or landmark"
            onPlace={(place) => {
              update("location", place.address);
              update("latitude", place.lat);
              update("longitude", place.lng);
            }}
          />
        </div>
        <div className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date</span>
          <input
            type="date"
            value={filters.date}
            onChange={(e) => update("date", e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">From</span>
          <input
            type="time"
            value={filters.startTime}
            onChange={(e) => update("startTime", e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">To</span>
          <input
            type="time"
            value={filters.endTime}
            onChange={(e) => update("endTime", e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenFilters}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-brand-200 hover:text-brand-700"
          >
            Filters
          </button>
          <button type="submit" className="btn-primary">
            Search
          </button>
        </div>
      </form>
    </>
  );
}
