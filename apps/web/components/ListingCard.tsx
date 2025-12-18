import { MapPinIcon, StarIcon } from "@heroicons/react/24/solid";
import Link from "next/link";
import Image from "next/image";
import clsx from "clsx";

export type Listing = {
  id: string;
  title: string;
  address: string;
  pricePerDay: number;
  rating: number;
  ratingCount?: number;
  distanceKm: number;
  availability: string;
  tags?: string[];
  image?: string;
  latitude?: number;
  longitude?: number;
};

export function ListingCard({
  listing,
  onSelect,
  suppressNavigation = false,
  selected = false,
}: {
  listing: Listing;
  onSelect?: (listing: Listing) => void;
  suppressNavigation?: boolean;
  selected?: boolean;
}) {
  const handleSelect = (e: React.MouseEvent) => {
    if (!onSelect) return;
    e.preventDefault();
    onSelect(listing);
  };

  const streetViewKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY;
  const streetViewImage =
    listing.latitude != null &&
    listing.longitude != null &&
    streetViewKey
      ? `https://maps.googleapis.com/maps/api/streetview?size=800x600&location=${listing.latitude},${listing.longitude}&key=${streetViewKey}`
      : undefined;

  const imageSrc =
    listing.image ??
    streetViewImage ??
    "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=800&q=80";

  return (
    <article
      className={clsx(
        "flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm transition duration-150",
        selected && "ring-2 ring-brand-500 ring-offset-1 ring-offset-white"
      )}
      style={{ animation: "slideUp 160ms ease-out" }}
    >
      <div className="relative h-20 w-28 overflow-hidden rounded-lg">
        <Image
          src={imageSrc}
          alt={listing.title}
          fill
          className="object-cover"
          sizes="112px"
        />
        <div className="absolute inset-x-1 bottom-1 flex items-center justify-between text-[10px] font-semibold text-white drop-shadow">
          <span className="rounded-full bg-black/60 px-2 py-0.5">€{listing.pricePerDay}/d</span>
          <span className="rounded-full bg-black/60 px-2 py-0.5">{listing.distanceKm} km</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <Link
              href={`/listing/${listing.id}`}
              onClick={suppressNavigation ? (e) => e.preventDefault() : undefined}
              className="line-clamp-1 text-sm font-semibold text-slate-900 hover:text-brand-700"
            >
              {listing.title}
            </Link>
            <p className="flex items-center gap-1.5 text-[11px] text-slate-600">
              <MapPinIcon className="h-3.5 w-3.5 text-brand-500" />
              <span className="line-clamp-1">{listing.address}</span>
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{listing.availability}</p>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
            <StarIcon className="h-3.5 w-3.5" /> {listing.rating.toFixed(1)}
            {typeof listing.ratingCount === "number" && <span className="text-[10px] text-amber-800">({listing.ratingCount})</span>}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-base font-semibold text-slate-900">
            €{listing.pricePerDay} <span className="text-xs text-slate-500">/ day</span>
          </div>
          <div className="flex gap-1.5">
            <Link
              href={`/listing/${listing.id}`}
              onClick={suppressNavigation ? handleSelect : undefined}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              View
            </Link>
            <Link href={`/checkout/${listing.id}`} className="btn-primary px-3 py-1.5 text-xs">
              Book
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
