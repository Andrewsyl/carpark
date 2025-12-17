"use client";

import { useEffect, useRef, useState } from "react";
import type { Listing } from "./ListingCard";

declare const google: any;

type MapViewProps = {
  listings: Listing[];
  center?: { lat: number; lng: number };
  radiusKm?: number;
  initialZoom?: number;
  maxZoom?: number;
};

export function MapView({ listings, center, radiusKm = 5, initialZoom = 12, maxZoom = 12 }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>();
  const markersRef = useRef<any[]>([]);
  const circleRef = useRef<any>();
  const [mapsReady, setMapsReady] = useState(false);

  useEffect(() => {
    if (!(window as any).google?.maps) return;
    setMapsReady(true);
  }, []);

  useEffect(() => {
    if (!mapsReady || !mapRef.current || !(window as any).google?.maps) return;

    const defaultCenter = center ?? { lat: 53.3498, lng: -6.2603 };
    mapInstance.current =
      mapInstance.current ??
      new google.maps.Map(mapRef.current, {
        center: defaultCenter,
        zoom: initialZoom,
        mapTypeControl: false,
        streetViewControl: false,
      });
  }, [center, mapsReady, initialZoom]);

  useEffect(() => {
    if (!mapsReady || !mapInstance.current || !(window as any).google?.maps) return;

    // Clear old markers
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    const infoWindow = new google.maps.InfoWindow();

    listings.forEach((listing) => {
      if (typeof listing.latitude !== "number" || typeof listing.longitude !== "number") return;
      const streetViewKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY;
      const streetViewImage =
        listing.latitude &&
        listing.longitude &&
        streetViewKey &&
        `https://maps.googleapis.com/maps/api/streetview?size=400x240&location=${listing.latitude},${listing.longitude}&key=${streetViewKey}`;
      const image =
        (listing as any).imageUrls?.[0] ??
        (listing as any).image ??
        streetViewImage ??
        "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=800&q=80";

      const marker = new google.maps.Marker({
        position: { lat: listing.latitude, lng: listing.longitude },
        map: mapInstance.current!,
        title: listing.title,
        icon: {
          url:
            "data:image/svg+xml;charset=UTF-8," +
            encodeURIComponent(
              `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="36" viewBox="0 0 80 36" fill="none">
                <rect x="0.5" y="0.5" width="79" height="35" rx="18" fill="#0F172A" stroke="#FFFFFF" stroke-width="1"/>
                <text x="40" y="22" text-anchor="middle" fill="#FFFFFF" font-size="14" font-family="Arial" font-weight="700">€${listing.pricePerDay}</text>
              </svg>`
            ),
          anchor: new google.maps.Point(40, 18),
          labelOrigin: new google.maps.Point(40, 18),
        } as any,
      });
      marker.addListener("click", () => {
        infoWindow.setContent(`
          <div style="width:240px;font-family:Inter,system-ui,sans-serif;color:#0f172a;cursor:pointer;" onclick="window.location.href='/listing/${listing.id}'">
            <div style="position:relative;width:100%;height:140px;overflow:hidden;border-radius:12px;margin-bottom:8px;">
              <img src="${image}" alt="${listing.title}" style="width:100%;height:100%;object-fit:cover;" />
              <div style="position:absolute;top:8px;left:8px;background:rgba(15,23,42,0.8);color:#fff;padding:4px 8px;border-radius:9999px;font-weight:700;font-size:12px;">€${listing.pricePerDay}/day</div>
            </div>
            <div style="font-weight:700;margin-bottom:4px;">${listing.title}</div>
            <div style="font-size:12px;color:#475569;margin-bottom:4px;">${listing.address}</div>
            <div style="font-size:12px;color:#0f172a;">${listing.availability ?? ""}</div>
          </div>
        `);
        infoWindow.open({
          anchor: marker,
          map: mapInstance.current!,
          shouldFocus: false,
        });
      });
      markersRef.current.push(marker);
    });

    // Fit bounds to markers if any
    if (markersRef.current.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      markersRef.current.forEach((marker) => bounds.extend(marker.getPosition()!));
      if (markersRef.current.length === 1) {
        mapInstance.current.setCenter(markersRef.current[0].getPosition()!);
        mapInstance.current.setZoom(initialZoom);
      } else {
        mapInstance.current.fitBounds(bounds, 200);
        const currentZoom = mapInstance.current.getZoom();
        if (currentZoom && currentZoom > maxZoom) {
          mapInstance.current.setZoom(maxZoom);
        }
      }
    } else if (center) {
      mapInstance.current.setCenter(center);
      mapInstance.current.setZoom(initialZoom);
    }
  }, [listings, center, mapsReady, initialZoom, maxZoom]);

  useEffect(() => {
    if (!mapsReady || !mapInstance.current || !center || !(window as any).google?.maps) return;
    if (!circleRef.current) {
      circleRef.current = new google.maps.Circle({
        map: mapInstance.current,
        strokeColor: "#007ee6",
        strokeOpacity: 0.35,
        strokeWeight: 2,
        fillColor: "#38a7ff",
        fillOpacity: 0.08,
      });
    }
    circleRef.current.setCenter(center);
    circleRef.current.setRadius(radiusKm * 1000);

    const bounds = circleRef.current.getBounds?.();
    if (bounds) {
      mapInstance.current.fitBounds(bounds, 60);
      const currentZoom = mapInstance.current.getZoom();
      if (currentZoom && currentZoom > maxZoom) {
        mapInstance.current.setZoom(maxZoom);
      }
    }
  }, [center, radiusKm, mapsReady, maxZoom]);

  return (
    <div className="h-full w-full rounded-xl bg-slate-100">
      {!mapsReady && (
        <div className="flex h-full w-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-600">
          Map unavailable. Add a Google Maps API key to display nearby spaces.
        </div>
      )}
      <div ref={mapRef} className="h-full w-full rounded-xl" />
    </div>
  );
}
