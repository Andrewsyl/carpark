"use client";

import dynamic from "next/dynamic";
import type { Listing } from "../../../components/ListingCard";

const MapView = dynamic(() => import("../../../components/MapView").then((mod) => mod.MapView), {
  ssr: false,
});

export function ListingMap({
  listing,
  center,
  zoom = 11,
}: {
  listing: Listing;
  center: { lat: number; lng: number };
  zoom?: number;
}) {
  return <MapView listings={[listing]} center={center} initialZoom={zoom} maxZoom={12} />;
}
