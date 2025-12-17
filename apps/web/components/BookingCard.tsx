import { CalendarDaysIcon, MapPinIcon } from "@heroicons/react/24/outline";

export type Booking = {
  id: string;
  address: string;
  title?: string;
  date: string;
  timeRange: string;
  payout?: number;
  driver?: string;
  status: "pending" | "confirmed" | "canceled" | "upcoming" | "completed";
};

export function BookingCard({ booking }: { booking: Booking }) {
  const statusColors: Record<Booking["status"], string> = {
    pending: "bg-amber-100 text-amber-800",
    confirmed: "bg-emerald-100 text-emerald-800",
    canceled: "bg-rose-100 text-rose-700",
    upcoming: "bg-blue-100 text-blue-800",
    completed: "bg-slate-200 text-slate-800",
  };

  const badge = statusColors[booking.status] ?? "bg-slate-100 text-slate-800";

  return (
    <article className="card flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
        <span className={`rounded-full px-2 py-1 ${badge}`}>{booking.status}</span>
        {typeof booking.payout === "number" && (
          <span className="text-slate-900">€{booking.payout.toFixed(2)} payout</span>
        )}
      </div>
      <h3 className="text-base font-semibold text-slate-900">{booking.title ?? booking.address}</h3>
      <div className="flex flex-col gap-2 text-sm text-slate-600">
        <span className="inline-flex items-center gap-2">
          <CalendarDaysIcon className="h-4 w-4" /> {booking.date} • {booking.timeRange}
        </span>
        {booking.driver && (
          <span className="inline-flex items-center gap-2">
            <MapPinIcon className="h-4 w-4" /> Driver: {booking.driver}
          </span>
        )}
      </div>
    </article>
  );
}
