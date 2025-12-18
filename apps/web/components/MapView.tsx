"use client";

import { useEffect, useRef, useState } from "react";
import type { Listing } from "./ListingCard";

declare const google: any;

type MapViewProps = {
  listings: Listing[];
  center?: { lat: number; lng: number };
  initialZoom?: number;
  maxZoom?: number;
  minFitZoom?: number;
  selectedListingId?: string;
  onSelectListing?: (listingId: string) => void;
  onMarkerClick?: (listing: Listing) => void;
  onBoundsChanged?: (bounds: google.maps.LatLngBoundsLiteral, center: { lat: number; lng: number }, zoom: number, userInteracted: boolean) => void;
  disableAutoFit?: boolean;
  showCenterPin?: boolean;
};

const markerIcon = (price: number, active: boolean) => {
  const key = `${price}-${active ? "a" : "i"}`;
  return {
    url:
      "data:image/svg+xml;charset=UTF-8," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="40" viewBox="0 0 60 40" fill="none">
          <defs>
            <linearGradient id="grad-${key}" x1="0" y1="0" x2="60" y2="40">
              <stop offset="0%" stop-color="${active ? "#4f8df8" : "#0F172A"}"/>
              <stop offset="100%" stop-color="${active ? "#2563eb" : "#0b1225"}"/>
            </linearGradient>
          </defs>
          <path d="M11 1.5H49C55.5 1.5 59.5 5.5 59.5 12V20C59.5 26.5 55.5 30.5 49 30.5H35L30 38.5L25 30.5H11C4.5 30.5 0.5 26.5 0.5 20V12C0.5 5.5 4.5 1.5 11 1.5Z" fill="url(#grad-${key})" stroke="white" stroke-width="2"/>
          <text x="30" y="18" text-anchor="middle" fill="#FFFFFF" font-size="11" font-family="Arial" font-weight="700">€${price}</text>
        </svg>`
      ),
    anchor: new google.maps.Point(30, 38),
    labelOrigin: new google.maps.Point(30, 17),
  } as any;
};

const clampZoom = (value: number, min?: number, max?: number) => {
  let z = value;
  if (typeof min === "number") z = Math.max(z, min);
  if (typeof max === "number") z = Math.min(z, max);
  return z;
};

export function MapView({
  listings,
  center,
  initialZoom = 12,
  maxZoom = 12,
  minFitZoom,
  selectedListingId,
  onSelectListing,
  onMarkerClick,
  onBoundsChanged,
  disableAutoFit = false,
  showCenterPin = false,
}: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>();
  const markersRef = useRef<Map<string, { marker: any; listing: Listing }>>(new Map());
  const centerMarkerRef = useRef<any>();
  const [mapsReady, setMapsReady] = useState(false);
  const hasUserDraggedRef = useRef(false);
  const prevSelectedRef = useRef<string | null>(null);

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

    const map = mapInstance.current;
    const dragStartListener = map.addListener("dragstart", () => {
      hasUserDraggedRef.current = true;
    });

    return () => {
      dragStartListener?.remove();
    };
  }, [center, mapsReady, initialZoom]);

  useEffect(() => {
    if (!mapsReady || !mapInstance.current || !(window as any).google?.maps) return;

    markersRef.current.forEach(({ marker }) => marker.setMap(null));
    markersRef.current.clear();

    const infoWindow = new google.maps.InfoWindow();

    listings.forEach((listing) => {
      if (typeof listing.latitude !== "number" || typeof listing.longitude !== "number") return;

      const marker = new google.maps.Marker({
        position: { lat: listing.latitude, lng: listing.longitude },
        map: mapInstance.current!,
        title: listing.title,
        icon: markerIcon(listing.pricePerDay, selectedListingId === listing.id),
      });

      marker.addListener("click", () => {
        onSelectListing?.(listing.id);
        if (onMarkerClick) {
          onMarkerClick(listing);
        } else {
          infoWindow.setContent(`<div style="font-family:Inter,system-ui,sans-serif;font-weight:700;color:#0f172a;">€${listing.pricePerDay} • ${listing.title}</div>`);
          infoWindow.open({ anchor: marker, map: mapInstance.current!, shouldFocus: false });
        }
      });

      markersRef.current.set(listing.id, { marker, listing });
    });

    if (showCenterPin && center) {
      if (!disableAutoFit) {
        mapInstance.current.setCenter(center);
        mapInstance.current.setZoom(clampZoom(initialZoom, minFitZoom, maxZoom));
      }
      if (centerMarkerRef.current) {
        centerMarkerRef.current.setPosition(center);
        centerMarkerRef.current.setMap(mapInstance.current);
      }
      // Keep the searched location centered; skip auto-fit to markers.
      return;
    }

    if (disableAutoFit) return;

    const entries = Array.from(markersRef.current.values());
    if (entries.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      entries.forEach(({ marker }) => bounds.extend(marker.getPosition()!));
      if (entries.length === 1) {
        mapInstance.current.setCenter(entries[0].marker.getPosition()!);
        const target = clampZoom(initialZoom, minFitZoom, maxZoom);
        mapInstance.current.setZoom(target);
      } else {
        mapInstance.current.fitBounds(bounds, 200);
        const currentZoom = mapInstance.current.getZoom();
        const target = clampZoom(currentZoom ?? initialZoom, minFitZoom, maxZoom);
        mapInstance.current.setZoom(target);
      }
    } else if (center) {
      mapInstance.current.setCenter(center);
      mapInstance.current.setZoom(clampZoom(initialZoom, minFitZoom, maxZoom));
    }
  }, [listings, center?.lat, center?.lng, mapsReady, initialZoom, maxZoom, minFitZoom, onMarkerClick, onSelectListing, disableAutoFit]);

  useEffect(() => {
    if (!mapsReady || !mapInstance.current || !(window as any).google?.maps || !onBoundsChanged) return;
    const idleListener = mapInstance.current.addListener("idle", () => {
      const bounds = mapInstance.current.getBounds();
      const c = mapInstance.current.getCenter();
      const zoom = mapInstance.current.getZoom();
      if (bounds && c && typeof zoom === "number") {
        const interacted = hasUserDraggedRef.current;
        onBoundsChanged(bounds.toJSON(), { lat: c.lat(), lng: c.lng() }, zoom, interacted);
        hasUserDraggedRef.current = false;
      }
    });
    return () => idleListener?.remove();
  }, [mapsReady, onBoundsChanged]);

  useEffect(() => {
    if (!mapsReady || !mapInstance.current || !(window as any).google?.maps) return;
    if (!center || !showCenterPin) {
      centerMarkerRef.current?.setMap(null);
      centerMarkerRef.current = null;
      return;
    }
    if (!centerMarkerRef.current) {
      centerMarkerRef.current = new google.maps.Marker({
        map: mapInstance.current,
        clickable: false,
        icon: {
          url:
            "data:image/svg+xml;charset=UTF-8," +
            encodeURIComponent(
              `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="32" viewBox="0 0 24 32" fill="none">
                <path d="M12 0C5.373 0 0 5.13 0 11.455 0 20.545 12 32 12 32s12-11.455 12-20.545C24 5.13 18.627 0 12 0Z" fill="#2563EB"/>
                <circle cx="12" cy="11" r="4.5" fill="white"/>
              </svg>`
            ),
          anchor: new google.maps.Point(12, 30),
        },
      });
    }
    centerMarkerRef.current.setPosition(center);
    centerMarkerRef.current.setMap(mapInstance.current);
  }, [center?.lat, center?.lng, showCenterPin, mapsReady]);

  useEffect(() => {
    if (!mapsReady || !mapInstance.current || !(window as any).google?.maps) return;
    if (!selectedListingId) {
      if (prevSelectedRef.current && markersRef.current.has(prevSelectedRef.current)) {
        const { marker, listing } = markersRef.current.get(prevSelectedRef.current)!;
        marker.setIcon(markerIcon(listing.pricePerDay, false));
        marker.setZIndex(undefined as any);
      }
      prevSelectedRef.current = null;
      return;
    }
    const prevId = prevSelectedRef.current;
    if (prevId && markersRef.current.has(prevId)) {
      const { marker, listing } = markersRef.current.get(prevId)!;
      marker.setIcon(markerIcon(listing.pricePerDay, false));
      marker.setZIndex(undefined as any);
    }
    if (markersRef.current.has(selectedListingId)) {
      const { marker, listing } = markersRef.current.get(selectedListingId)!;
      marker.setIcon(markerIcon(listing.pricePerDay, true));
      marker.setZIndex(google.maps.Marker.MAX_ZINDEX + 1);
    }
    prevSelectedRef.current = selectedListingId;
  }, [selectedListingId, mapsReady]);

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
