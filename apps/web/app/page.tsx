import { ListingCard, type Listing } from "../components/ListingCard";
import { SearchForm } from "../components/SearchForm";

const sampleListings: Listing[] = [
  {
    id: "1",
    title: "Secure driveway in Ranelagh",
    address: "Ranelagh, Dublin 6",
    pricePerDay: 18,
    rating: 4.9,
    distanceKm: 2.1,
    availability: "Today • 7am - 10pm",
    tags: ["EV charging", "CCTV"],
  },
  {
    id: "2",
    title: "Covered car park near IFSC",
    address: "IFSC, Dublin 1",
    pricePerDay: 24,
    rating: 4.8,
    distanceKm: 0.8,
    availability: "Today • 24/7",
    tags: ["Gated", "Keypad access"],
  },
  {
    id: "3",
    title: "Driveway beside Dart station",
    address: "Clontarf, Dublin 3",
    pricePerDay: 16,
    rating: 4.7,
    distanceKm: 3.4,
    availability: "Today • 8am - 8pm",
    tags: ["Well lit"],
  },
];

export default function HomePage() {
  return (
    <div className="space-y-8 sm:space-y-10">
      <section className="relative overflow-visible rounded-3xl bg-white p-6 shadow-card ring-1 ring-slate-100 sm:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.10),transparent_26%),radial-gradient(circle_at_80%_10%,rgba(14,165,233,0.08),transparent_24%)]" />
        <div className="relative flex flex-col gap-6">
          <div className="space-y-3 sm:space-y-4 text-center">
            <h1 className="text-4xl font-bold leading-tight text-slate-900 sm:text-5xl">Find parking fast.</h1>
            <p className="mx-auto max-w-3xl text-base text-slate-600 sm:text-lg">
              Book a driveway or private car park in seconds. Daily or monthly, with instant confirmation.
            </p>
          </div>
          <div className="mx-auto w-full max-w-5xl">
            <div className="rounded-3xl bg-white/95 p-3 shadow-2xl ring-1 ring-slate-200">
              <SearchForm redirectToSearch />
            </div>
            <div className="mt-2 text-center text-xs text-slate-500">Pick a location, time, and radius. Real availability.</div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 rounded-3xl bg-white p-6 shadow-card ring-1 ring-slate-100 lg:grid-cols-3">
        <StatCard title="3 min to book" detail="Search, select, pay—no calls or approvals." />
        <StatCard title="Protected calendars" detail="No double bookings once you pay." />
        <StatCard title="Host payouts" detail="Stripe-powered payouts for hosts, automated." />
      </section>
    </div>
  );
}

function StatCard({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 shadow-inner">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">{detail}</p>
    </div>
  );
}
