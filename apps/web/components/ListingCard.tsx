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

export function ListingCard({ listing }: { listing: Listing }) {
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
    <article className="card flex flex-col gap-3">
      <Link href={`/listing/${listing.id}`} className="group relative block overflow-hidden rounded-xl">
        <div className="relative h-48">
          <Image
            src={imageSrc}
            alt={listing.title}
            fill
            className="object-cover transition duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
          <div className="absolute inset-x-3 top-3 flex items-center justify-between text-xs font-semibold text-white drop-shadow">
            <span className="rounded-full bg-black/50 px-2 py-1">€{listing.pricePerDay}/day</span>
            <span className="rounded-full bg-black/50 px-2 py-1">{listing.distanceKm} km</span>
          </div>
        </div>
      </Link>

      <header className="flex items-start justify-between gap-3">
        <div>
          <Link href={`/listing/${listing.id}`} className="text-lg font-semibold text-slate-900 hover:text-brand-700">
            {listing.title}
          </Link>
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <MapPinIcon className="h-4 w-4 text-brand-500" />
            {listing.address}
          </p>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{listing.availability}</p>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
          <StarIcon className="h-4 w-4" /> {listing.rating.toFixed(1)}
          {typeof listing.ratingCount === "number" && (
            <span className="text-[10px] text-amber-800">({listing.ratingCount})</span>
          )}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
        {listing.tags?.slice(0, 3).map((tag) => (
          <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 font-medium">
            {tag}
          </span>
        ))}
        {listing.tags && listing.tags.length > 3 && (
          <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">+{listing.tags.length - 3}</span>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xl font-semibold text-slate-900">
          €{listing.pricePerDay} <span className="text-sm text-slate-500">/ day</span>
        </div>
        <div className="flex gap-2">
          <Link href={`/listing/${listing.id}`} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            View
          </Link>
          <Link href={`/checkout/${listing.id}`} className="btn-primary">
            Book
          </Link>
        </div>
      </div>
    </article>
  );
}
