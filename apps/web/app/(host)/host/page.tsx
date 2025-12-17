"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { BookingCard, type Booking } from "../../../components/BookingCard";
import { createListing } from "../../../lib/api";
import { useAuth } from "../../../components/AuthProvider";
import { AddressAutocomplete } from "../../../components/AddressAutocomplete";
import { ImageUploader } from "../../../components/ImageUploader";
import { useAppStatus } from "../../../components/AppStatusProvider";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { DateRangePicker } from "react-dates";
import "react-dates/initialize";
import moment from "moment";

const sampleBookings: Booking[] = [
  {
    id: "b1",
    address: "Driveway on South Circular Road",
    date: "22 Dec 2024",
    timeRange: "08:00 - 18:00",
    payout: 21.5,
    driver: "Aoife M.",
    status: "upcoming",
  },
  {
    id: "b2",
    address: "Apartment bay, Grand Canal Dock",
    date: "19 Dec 2024",
    timeRange: "09:00 - 17:00",
    payout: 19,
    driver: "Conor B.",
    status: "completed",
  },
];

export default function HostPage() {
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({ lat: 53.3498, lng: -6.2603 });
  const [dateRange, setDateRange] = useState<{ startDate: moment.Moment | null; endDate: moment.Moment | null }>({
    startDate: moment(),
    endDate: moment().add(30, "days"),
  });
  const [focusedInput, setFocusedInput] = useState<"startDate" | "endDate" | null>("startDate");
  const [availability, setAvailability] = useState<{ startTime: string; endTime: string }>({
    startTime: "07:00",
    endTime: "19:00",
  });
  const timeOptions = [
    "06:00",
    "06:30",
    "07:00",
    "07:30",
    "08:00",
    "08:30",
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:00",
    "11:30",
    "12:00",
    "12:30",
    "13:00",
    "13:30",
    "14:00",
    "14:30",
    "15:00",
    "15:30",
    "16:00",
    "16:30",
    "17:00",
    "17:30",
    "18:00",
    "18:30",
    "19:00",
    "19:30",
    "20:00",
    "20:30",
    "21:00",
    "21:30",
    "22:00",
  ];
  const { user, token } = useAuth();
  const { setLoading, setError, isLoading } = useAppStatus();
  const MapView = dynamic(() => import("../../../components/MapView").then((mod) => mod.MapView), { ssr: false });
  const router = useRouter();
  const openPicker = () => {};

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      setError("Please sign in to publish listings.");
      return;
    }
    const formEl = event.currentTarget;
    const formData = new FormData(formEl);
    const payload = {
      title: (formData.get("title") as string) ?? "",
      address: (formData.get("address") as string) ?? "",
      pricePerDay: Number(formData.get("pricePerDay")),
      availabilityText: `Available ${dateRange.startDate?.format("YYYY-MM-DD") ?? ""} to ${dateRange.endDate?.format("YYYY-MM-DD") ?? ""}, ${
        availability.startTime
      }-${availability.endTime}`,
      latitude: coords.lat,
      longitude: coords.lng,
      amenities: (formData.get("amenities") as string)
        ?.split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      imageUrls,
    };

    setLoading(true);
    setError(null);

    try {
      const result = await createListing(payload, token);
      formEl.reset();
      setImageUrls([]);
      router.push(`/host/dashboard?created=1`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not create listing");
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-700">Sign in to list a space and manage bookings.</p>
        <div className="flex gap-2 text-sm">
          <Link href="/login" className="btn-primary">
            Sign in
          </Link>
          <Link href="/signup" className="rounded-lg px-3 py-2 font-semibold text-slate-700 hover:bg-slate-100">
            Create account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Host</p>
          <h1 className="text-3xl font-bold text-slate-900">List a parking space</h1>
          <p className="text-slate-600">Add your driveway or private spot. We verify bookings, handle payments, and pay you out automatically.</p>
        </div>
        <Link href="/dashboard" className="btn-primary">Go to dashboard</Link>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <form className="card space-y-4 lg:col-span-2" onSubmit={handleSubmit}>
          {!user && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Sign in to attach listings to your account. Using demo host id until auth is configured with the API.
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Title
              <input
                required
                name="title"
                placeholder="Secure driveway in Ranelagh"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Price per day (€)
              <input
                required
                name="pricePerDay"
                type="number"
                min={5}
                defaultValue={18}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Address
              <AddressAutocomplete
                name="address"
                placeholder="123 Dame St, Dublin"
                onPlace={(place) => {
                  const form = document.querySelector("form");
                  if (!form) return;
                  const latInput = form.querySelector<HTMLInputElement>("input[name='latitude']");
                  const lngInput = form.querySelector<HTMLInputElement>("input[name='longitude']");
                  if (latInput) latInput.value = String(place.lat);
                  if (lngInput) lngInput.value = String(place.lng);
                  setCoords({ lat: place.lat, lng: place.lng });
                }}
              />
              <span className="text-xs text-slate-500">Autocomplete with Google Maps Places.</span>
            </label>

          <div className="card space-y-3">
            <p className="text-sm font-semibold text-slate-800">Availability</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Date range</p>
                <DateRangePicker
                  startDate={dateRange.startDate}
                  startDateId="start_date_id"
                  endDate={dateRange.endDate}
                  endDateId="end_date_id"
                  onDatesChange={({ startDate, endDate }: { startDate: moment.Moment | null; endDate: moment.Moment | null }) =>
                    setDateRange({ startDate, endDate })
                  }
                  focusedInput={focusedInput as any}
                  onFocusChange={(fi: any) => setFocusedInput(fi as any)}
                  displayFormat="YYYY-MM-DD"
                  numberOfMonths={1}
                  isOutsideRange={() => false}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  From
                  <select
                    value={availability.startTime}
                    onChange={(e) => setAvailability((prev) => ({ ...prev, startTime: e.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
                  >
                    {timeOptions.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  To
                  <select
                    value={availability.endTime}
                    onChange={(e) => setAvailability((prev) => ({ ...prev, endTime: e.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
                  >
                    {timeOptions.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Summary: Available {dateRange.startDate?.format("YYYY-MM-DD") ?? ""} to {dateRange.endDate?.format("YYYY-MM-DD") ?? ""}, {availability.startTime}-
              {availability.endTime}
            </div>
            <input
              type="hidden"
              name="availabilityText"
              value={`Available ${dateRange.startDate?.format("YYYY-MM-DD") ?? ""} to ${dateRange.endDate?.format("YYYY-MM-DD") ?? ""}, ${availability.startTime}-${availability.endTime}`}
            />
          </div>

          <ImageUploader onUpload={(url) => setImageUrls((prev) => [...prev, url])} />

          <input type="hidden" name="latitude" defaultValue={53.3498} />
          <input type="hidden" name="longitude" defaultValue={-6.2603} />

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Amenities
              <input
                name="amenities"
                placeholder="EV charger, CCTV, covered"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
              />
              <span className="text-xs text-slate-500">Comma separated.</span>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Space type
              <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none">
                <option>Driveway</option>
                <option>Underground bay</option>
                <option>Private lot</option>
              </select>
            </label>
          </div>

          <button type="submit" className="btn-primary w-full sm:w-auto" disabled={isLoading}>
            {isLoading ? "Publishing..." : "Publish listing"}
          </button>
        </form>

        <div className="space-y-4">
          <div className="card space-y-2">
            <p className="text-sm font-semibold text-slate-800">Map preview</p>
            <div className="h-48 rounded-xl bg-slate-100">
              <MapView
                listings={[
                  {
                    id: "preview",
                    title: "Your space",
                    address: "Selected location",
                    pricePerDay: 0,
                    rating: 5,
                    distanceKm: 0,
                    availability: "",
                    latitude: coords.lat,
                    longitude: coords.lng,
                  } as any,
                ]}
                center={{ lat: coords.lat, lng: coords.lng }}
                radiusKm={0.2}
              />
            </div>
            <p className="text-xs text-slate-600">
              Adjust address to update the pin. Server will geocode if lat/lng are missing.
            </p>
          </div>
          <div className="card space-y-3">
            {sampleBookings.map((booking) => (
              <BookingCard key={booking.id} booking={booking} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
