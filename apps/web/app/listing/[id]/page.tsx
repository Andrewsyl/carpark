import { notFound } from "next/navigation";
import Link from "next/link";
import { getListing } from "../../../lib/api";
import type { Listing } from "../../../components/ListingCard";
import { ListingMap } from "./MapSection";
import { WalkTime } from "./WalkTime";
import { BookingSelector } from "./BookingSelector";

function fallbackImage(title: string) {
  const encoded = encodeURIComponent(title);
  return `https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=1600&q=80&sat=-15&title=${encoded}`;
}

export default async function ListingDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { created?: string };
}) {
  const { id } = params;
  const listing = await getListing(id).catch(() => null);
  if (!listing) notFound();

  const listingForMap: Listing = {
    ...listing,
    distanceKm: 0,
    availability: listing.availability,
    pricePerDay: listing.pricePerDay,
    rating: listing.rating ?? 5,
  };

  const image =
    listing.imageUrls?.[0] ??
    (listing.latitude != null &&
    listing.longitude != null &&
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      ? `https://maps.googleapis.com/maps/api/streetview?size=1200x800&location=${listing.latitude},${listing.longitude}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
      : undefined);

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-[2fr,1fr] lg:items-start">
        <div className="space-y-4">
          <div className="relative aspect-[16/9] w-full max-h-64 overflow-hidden rounded-2xl bg-slate-200 shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image ?? fallbackImage(listing.title)}
              alt={listing.title}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="card space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Parking space</p>
            <h1 className="text-3xl font-bold text-slate-900">{listing.title}</h1>
            {searchParams.created && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                Listing published successfully.
              </div>
            )}
            <p className="text-sm text-slate-600">{listing.address}</p>
            <div className="flex flex-wrap gap-2 text-sm text-slate-700">
              <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">
                €{listing.pricePerDay} / day
              </span>
              <span className="rounded-full bg-brand-50 px-3 py-1 font-semibold text-brand-700">
                {listing.rating ?? 5}★ rated
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">{listing.availability}</span>
            </div>
            {listing.amenities && listing.amenities.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-800">Amenities</p>
                <div className="flex flex-wrap gap-2">
                  {listing.amenities.map((amenity) => (
                    <span key={amenity} className="rounded-lg bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                      {amenity}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="card space-y-3">
            <p className="text-sm font-semibold text-slate-800">Booking info</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
              <li>Instant confirmation and no double bookings.</li>
              <li>Secure payout to the host via Stripe Connect.</li>
              <li>Provide arrival window when booking; hosts get notified.</li>
            </ul>
          </div>
          <WalkTime origin={{ lat: listing.latitude ?? 53.3498, lng: listing.longitude ?? -6.2603 }} />
        </div>

          <div className="space-y-4">
            <BookingSelector listingId={listing.id} pricePerDay={listing.pricePerDay} />
            {!listing.hostStripeAccountId && (
              <div className="card text-xs text-amber-800 border border-amber-200 bg-amber-50">
                Host payouts are not set up yet. You can still proceed for demo, but live payments require host onboarding.
              </div>
            )}
            <div className="card h-64 rounded-xl bg-slate-100">
              <ListingMap
                listing={listingForMap}
                center={{ lat: listing.latitude ?? 53.3498, lng: listing.longitude ?? -6.2603 }}
                zoom={12}
              />
            </div>
          </div>
        </div>
      </div>
  );
}
