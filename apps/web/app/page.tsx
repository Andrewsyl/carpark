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
    <div className="space-y-12">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-8 sm:p-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.08),transparent_25%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.05),transparent_25%),radial-gradient(circle_at_40%_80%,rgba(255,255,255,0.06),transparent_30%)]" />
                          <div className="relative grid gap-8 lg:grid-cols-[1.1fr,0.9fr] lg:items-center">
                            <div className="space-y-6 text-white">
                              <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-sm font-semibold">
                                Peer-to-peer parking, daily or monthly
                              </span>
                              <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
                                Park like a local. Driveway spots across the city, on demand or monthly.
                              </h1>
                              <p className="text-lg text-slate-200/90">
                                Book secure private parking near work, concerts, or home. Instant confirmation, no circling the block.
                              </p>
                              <div className="flex flex-wrap gap-3 text-sm">
                                <span className="rounded-full bg-white/10 px-3 py-1 font-semibold">Instant confirmation</span>
                                <span className="rounded-full bg-white/10 px-3 py-1 font-semibold">Monthly passes</span>
                                <span className="rounded-full bg-white/10 px-3 py-1 font-semibold">Stripe payouts</span>
                              </div>
                            </div>
                            <div className="relative">
                              <div className="rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-slate-200">
                                <SearchForm redirectToSearch compact />
                              </div>
                              <div className="mt-3 text-xs text-slate-200/80 lg:absolute lg:-left-6 lg:mt-0 lg:translate-y-full">
                                Daily and monthly parking • EV and covered spots • No double bookings
                              </div>
                            </div>
                          </div>      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Featured spaces</p>
            <h2 className="text-2xl font-bold text-slate-900">Top picks near you</h2>
          </div>
          <a href="/search" className="text-sm font-semibold text-brand-700">
            View all
          </a>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sampleListings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      </section>

      <section className="grid gap-6 rounded-3xl bg-white/80 p-6 shadow-inner ring-1 ring-slate-200 lg:grid-cols-3">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Why hosts list</p>
          <h3 className="text-xl font-bold text-slate-900">Hands-off payouts</h3>
          <p className="text-sm text-slate-600">Stripe Connect handles funds, with instant booking and overlap protection.</p>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Drivers</p>
          <h3 className="text-xl font-bold text-slate-900">Find spots in minutes</h3>
          <p className="text-sm text-slate-600">Real availability, daily or monthly passes, EV and covered options.</p>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Trust & coverage</p>
          <h3 className="text-xl font-bold text-slate-900">No double bookings</h3>
          <p className="text-sm text-slate-600">We block overlapping times, notify hosts, and keep a clean record of every stay.</p>
        </div>
      </section>
    </div>
  );
}
