"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AddressAutocomplete } from "./AddressAutocomplete";
import { format } from "date-fns";

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

type DateTimePickerProps = {
  label: "From" | "Until";
  value: Date;
  onChange: (next: Date) => void;
  minGapMinutes?: number;
};

export function SearchForm({
  initialValues,
  onSearch,
  redirectToSearch = false,
  onOpenFilters,
  autoSearch = true,
  onAddressChange,
}: {
  initialValues?: Partial<SearchFilters>;
  onSearch?: (filters: SearchFilters) => void;
  redirectToSearch?: boolean;
  onOpenFilters?: () => void;
  autoSearch?: boolean;
  onAddressChange?: (place: { address: string; lat: number; lng: number }) => void;
}) {
  const router = useRouter();
  const skipAutoSearch = useRef(true);
  const syncingFromProps = useRef(false);

  const initialStart = useMemo(() => {
    const now = new Date();
    now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
    return now;
  }, []);

  const [state, setState] = useState(() => {
    const startFromProps = initialValues?.date
      ? buildDateTime(initialValues.date, initialValues.startTime ?? "09:00")
      : initialStart;
    const endFromProps =
      initialValues?.endDate && initialValues?.endTime
        ? buildDateTime(initialValues.endDate, initialValues.endTime)
        : addMinutes(startFromProps, 180);
    return {
      location: initialValues?.location ?? "Dublin City Centre",
      latitude: initialValues?.latitude ?? 53.3498,
      longitude: initialValues?.longitude ?? -6.2603,
      mode: initialValues?.mode ?? "daily",
      startAt: startFromProps,
      endAt: endFromProps,
      radiusKm: initialValues?.radiusKm ?? 5,
      priceMin: initialValues?.priceMin,
      priceMax: initialValues?.priceMax,
      coveredParking: initialValues?.coveredParking,
      evCharging: initialValues?.evCharging,
      securityLevel: initialValues?.securityLevel,
      vehicleSize: initialValues?.vehicleSize,
      instantBook: initialValues?.instantBook,
    };
  });

  useEffect(() => {
    if (!initialValues) return;
    syncingFromProps.current = true;
    const startFromProps = initialValues.date
      ? buildDateTime(initialValues.date, initialValues.startTime ?? "09:00")
      : state.startAt;
    const endFromProps =
      initialValues.endDate && initialValues.endTime
        ? buildDateTime(initialValues.endDate, initialValues.endTime)
        : addMinutes(startFromProps, 120);
    setState((prev) => ({
      ...prev,
      ...initialValues,
      startAt: startFromProps,
      endAt: endFromProps,
    }));
  }, [initialValues]);

  const buildFilters = (current = state): SearchFilters => {
    const startDate = toDateString(current.startAt);
    const endDate = toDateString(current.endAt);
    const startTime = toTimeString(current.startAt);
    const endTime = toTimeString(current.endAt);
    const submission: SearchFilters = {
      location: current.location,
      date: startDate,
      endDate,
      startTime,
      endTime,
      radiusKm: current.radiusKm,
      latitude: current.latitude,
      longitude: current.longitude,
      mode: current.mode,
      priceMin: current.priceMin,
      priceMax: current.priceMax,
      coveredParking: current.coveredParking,
      evCharging: current.evCharging,
      securityLevel: current.securityLevel,
      vehicleSize: current.vehicleSize,
      instantBook: current.instantBook,
    };
    if (current.mode === "monthly") {
      const end = new Date(current.startAt);
      end.setMonth(end.getMonth() + 1);
      submission.startTime = "00:00";
      submission.endTime = "23:59";
      submission.endDate = toDateString(end);
    }
    return submission;
  };

  useEffect(() => {
    if (!onSearch || redirectToSearch || !autoSearch) return;
    if (skipAutoSearch.current) {
      skipAutoSearch.current = false;
      return;
    }
    if (syncingFromProps.current) {
      syncingFromProps.current = false;
      return;
    }
    const timer = setTimeout(() => {
      onSearch(buildFilters());
    }, 250);
    return () => clearTimeout(timer);
  }, [state, onSearch, redirectToSearch, autoSearch]);

  const geocodeAddress = async (address: string) => {
    if (!(window as any).google?.maps?.Geocoder) return null;
    return new Promise<{ lat: number; lng: number } | null>((resolve) => {
      const geocoder = new (window as any).google.maps.Geocoder();
      geocoder.geocode({ address }, (results: any[], status: string) => {
        if (status === "OK" && results?.[0]?.geometry?.location) {
          const loc = results[0].geometry.location;
          resolve({ lat: loc.lat(), lng: loc.lng() });
        } else {
          resolve(null);
        }
      });
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submission = buildFilters();

    if (redirectToSearch && (!submission.latitude || !submission.longitude)) {
      const geo = await geocodeAddress(submission.location);
      if (geo) {
        submission.latitude = geo.lat;
        submission.longitude = geo.lng;
      }
    }

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

  const setStart = (next: Date) => {
    const adjustedEnd = state.endAt <= next ? addMinutes(next, 180) : state.endAt;
    setState((prev) => ({ ...prev, startAt: next, endAt: adjustedEnd }));
  };

  const setEnd = (next: Date) => {
    if (next <= state.startAt) {
      setState((prev) => ({ ...prev, endAt: addMinutes(prev.startAt, 180) }));
      return;
    }
    setState((prev) => ({ ...prev, endAt: next }));
  };

  return (
    <div className="w-full">
      <form
        onSubmit={handleSubmit}
        className="flex w-full flex-col gap-3 rounded-3xl border border-slate-200 bg-white/95 p-3 shadow-xl ring-1 ring-slate-100 sm:flex-row sm:items-stretch sm:gap-2"
      >
        <div className="flex min-w-[220px] flex-1 flex-col gap-1 text-sm font-semibold text-slate-800">
          <span className="text-[11px] uppercase tracking-wide text-slate-500">Location</span>
          <AddressAutocomplete
            defaultValue={state.location}
            placeholder="Enter area or landmark"
            onPlace={(place) => {
              setState((prev) => ({
                ...prev,
                location: place.address,
                latitude: place.lat,
                longitude: place.lng,
              }));
              onAddressChange?.({ address: place.address, lat: place.lat, lng: place.lng });
            }}
          />
        </div>

        <DateTimePicker label="From" value={state.startAt} onChange={setStart} />
        <DateTimePicker label="Until" value={state.endAt} onChange={setEnd} />

        <div className="flex items-center gap-2">
          {onOpenFilters && (
            <button
              type="button"
              onClick={onOpenFilters}
              className="hidden rounded-full border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand-200 hover:text-brand-700 lg:inline-flex"
            >
              Filters
            </button>
          )}
          <button
            type="submit"
            className="rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-brand-700"
          >
            Search
          </button>
        </div>
      </form>
    </div>
  );
}

function DateTimePicker({ label, value, onChange, minGapMinutes = 120 }: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(startOfMonth(value));
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setViewMonth(startOfMonth(value));
  }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const times = useMemo(() => {
    const slots: string[] = [];
    for (let i = 0; i < 24 * 60; i += 15) {
      const hh = String(Math.floor(i / 60)).padStart(2, "0");
      const mm = String(i % 60).padStart(2, "0");
      slots.push(`${hh}:${mm}`);
    }
    return slots;
  }, []);

  const days = buildMonthGrid(viewMonth);

  const handleDateSelect = (day: Date) => {
    const next = new Date(day);
    next.setHours(value.getHours(), value.getMinutes(), 0, 0);
    onChange(next);
    if (label === "From") {
      const endCandidate = addMinutes(next, minGapMinutes);
      onChange(next);
      // Parent handles end adjustment separately
    }
  };

  const handleTimeSelect = (time: string) => {
    const next = buildDateTime(toDateString(value), time);
    onChange(next);
  };

  const title = formatMonthTitle(viewMonth);
  const timeLabel = label === "From" ? "Enter after" : "Leave by";

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-brand-200 hover:shadow-md"
      >
        <div className="flex min-w-[210px] flex-col text-sm font-semibold text-slate-800">
          <span className="text-[11px] uppercase tracking-wide text-slate-500">{label}</span>
          <span className="tabular-nums">{formatTrigger(value)}</span>
        </div>
        <span className="text-slate-400">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 z-50 mt-2 w-[440px] max-w-[95vw] rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_60px_rgba(15,23,42,0.15)] ring-1 ring-slate-100">
          <div className="flex items-center justify-between pb-3">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label} time</p>
              <p className="text-sm font-semibold text-slate-900">{formatTrigger(value)}</p>
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <button
                type="button"
                onClick={() => setViewMonth(addMonths(viewMonth, -1))}
                className="h-8 w-8 rounded-full border border-slate-200 text-slate-700 transition hover:bg-slate-100"
              >
                ‹
              </button>
              <div className="text-sm font-semibold text-slate-900">{title}</div>
              <button
                type="button"
                onClick={() => setViewMonth(addMonths(viewMonth, 1))}
                className="h-8 w-8 rounded-full border border-slate-200 text-slate-700 transition hover:bg-slate-100"
              >
                ›
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 pb-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, idx) => {
              if (!day) {
                return <div key={idx} className="h-10 rounded-xl" />;
              }
              const isSelected = isSameDay(day, value);
              const isToday = isSameDay(day, new Date());
              const inMonth = day.getMonth() === viewMonth.getMonth();
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => handleDateSelect(day)}
                  className={`h-10 rounded-xl text-sm font-semibold transition ${
                    isSelected
                      ? "bg-[#4CAF50] text-white shadow ring-1 ring-emerald-300"
                      : inMonth
                        ? "text-slate-800 hover:bg-slate-100"
                        : "text-slate-400 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>{day.getDate()}</span>
                    {isToday && !isSelected && <span className="text-[10px] text-emerald-600">•</span>}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{timeLabel}</div>
            <div className="flex-1">
              <div className="relative">
                <select
                  value={toTimeString(value)}
                  onChange={(e) => handleTimeSelect(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm focus:border-emerald-500 focus:outline-none"
                >
                  {times.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">▾</span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function buildDateTime(date: string, time: string) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d;
}

function addMinutes(date: Date, minutes: number) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

function formatTrigger(date: Date) {
  return format(date, "EEE d MMM, HH:mm");
}

function toDateString(date: Date) {
  return date.toISOString().split("T")[0];
}

function toTimeString(date: Date) {
  return date.toTimeString().slice(0, 5);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, count: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + count);
  return startOfMonth(d);
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function buildMonthGrid(month: Date) {
  const start = startOfMonth(month);
  const startDay = start.getDay(); // 0-6
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const grid: (Date | null)[] = [];
  for (let i = 0; i < startDay; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    grid.push(new Date(month.getFullYear(), month.getMonth(), d));
  }
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

function formatMonthTitle(date: Date) {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
