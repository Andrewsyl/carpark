"use client";

import { useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Listing } from "./ListingCard";
import { MapPopupCard } from "./MapPopupCard";

declare const google: any;

type MapViewProps = {
  listings: Listing[];
  center?: { lat: number; lng: number };
  initialZoom?: number;
  maxZoom?: number;
  minFitZoom?: number;
  selectedListingId?: string;
  popupListing?: Listing | null;
  onPopupBook?: (listing: Listing) => void;
  onSelectListing?: (listingId: string) => void;
  onMarkerClick?: (listing: Listing) => void;
  onBoundsChanged?: (bounds: google.maps.LatLngBoundsLiteral, center: { lat: number; lng: number }, zoom: number, userInteracted: boolean) => void;
  disableAutoFit?: boolean;
  showCenterPin?: boolean;
};

const markerIcon = (price: number, active: boolean) => {
  const key = `${price}-${active ? "a" : "i"}`;
  const fillTop = active ? "#12b886" : "#f8fafc";
  const fillBottom = active ? "#0f9d75" : "#ffffff";
  const stroke = active ? "#0b7d55" : "#cbd5e1";
  const text = active ? "#ffffff" : "#0f172a";
  return {
    url:
      "data:image/svg+xml;charset=UTF-8," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="78" height="56" viewBox="0 0 78 56" fill="none">
          <defs>
            <linearGradient id="grad-${key}" x1="0" y1="0" x2="0" y2="42">
              <stop offset="0%" stop-color="${fillTop}"/>
              <stop offset="100%" stop-color="${fillBottom}"/>
            </linearGradient>
            <filter id="shadow-${key}" x="-10" y="-10" width="98" height="86" color-interpolation-filters="sRGB">
              <feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="rgba(15,23,42,0.18)"/>
            </filter>
          </defs>
          <g filter="url(#shadow-${key})">
            <path d="M11 9.5C11 6.462 13.462 4 16.5 4H61.5C64.538 4 67 6.462 67 9.5V34.5C67 38.09 64.09 41 60.5 41H44L39 50L34 41H17.5C13.91 41 11 38.09 11 34.5V17Z" fill="url(#grad-${key})" stroke="${stroke}" stroke-width="2"/>
            <path d="M39 50L44 41H34L39 50Z" fill="url(#grad-${key})" stroke="${stroke}" stroke-width="2"/>
            <text x="39" y="28" text-anchor="middle" fill="${text}" font-size="14" font-family="Inter,Arial,sans-serif" font-weight="700">€${price}</text>
          </g>
        </svg>`
      ),
    anchor: new google.maps.Point(39, 50),
    labelOrigin: new google.maps.Point(39, 26),
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
  popupListing,
  onPopupBook,
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
  const markerSignatureRef = useRef<string>("");
  const [mapsReady, setMapsReady] = useState(false);
  const hasUserDraggedRef = useRef(false);
  const prevSelectedRef = useRef<string | null>(null);
  const popupOverlayRef = useRef<any | null>(null);
  const popupRootRef = useRef<Root | null>(null);
  const popupContainerRef = useRef<HTMLDivElement | null>(null);

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
        styles: [],
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

    const signature = listings
      .filter((l) => typeof l.latitude === "number" && typeof l.longitude === "number")
      .map((l) => `${l.id}-${l.latitude}-${l.longitude}-${l.pricePerDay}`)
      .join("|");

    if (signature === markerSignatureRef.current) {
      // No marker data change; skip rebuild to avoid flicker.
      return;
    }

    markersRef.current.forEach(({ marker }) => marker.setMap(null));
    markersRef.current.clear();
    markerSignatureRef.current = signature;

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

    if (
      !popupListing ||
      typeof popupListing.latitude !== "number" ||
      typeof popupListing.longitude !== "number"
    ) {
      popupOverlayRef.current?.setMap(null);
      popupOverlayRef.current = null;
      popupRootRef.current?.unmount();
      popupRootRef.current = null;
      popupContainerRef.current?.remove();
      popupContainerRef.current = null;
      return;
    }

    popupOverlayRef.current?.setMap(null);
    popupOverlayRef.current = null;
    popupRootRef.current?.unmount();
    popupRootRef.current = null;
    popupContainerRef.current?.remove();
    popupContainerRef.current = null;

    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.transform = "translate(-50%, calc(-100% - 12px))";
    container.style.pointerEvents = "auto";
    popupContainerRef.current = container;

    const root = createRoot(container);
    popupRootRef.current = root;
    root.render(
      <MapPopupCard
        title={popupListing.title}
        price={`€${popupListing.pricePerDay}`}
        secondaryText="5 min walk · Available now"
        onBook={() => onPopupBook?.(popupListing)}
      />
    );

    const overlay = new google.maps.OverlayView();
    overlay.onAdd = function onAdd() {
      const panes = this.getPanes();
      const target = panes?.overlayMouseTarget ?? panes?.overlayLayer;
      target?.appendChild(container);
    };
    overlay.draw = function draw() {
      const projection = this.getProjection();
      if (!projection) return;
      const position = projection.fromLatLngToDivPixel(
        new google.maps.LatLng(popupListing.latitude!, popupListing.longitude!)
      );
      if (!position) return;
      container.style.left = `${position.x}px`;
      container.style.top = `${position.y}px`;
    };
    overlay.onRemove = function onRemove() {
      container.remove();
    };

    overlay.setMap(mapInstance.current);
    popupOverlayRef.current = overlay;

    return () => {
      overlay.setMap(null);
      popupOverlayRef.current = null;
      popupRootRef.current?.unmount();
      popupRootRef.current = null;
      popupContainerRef.current?.remove();
      popupContainerRef.current = null;
    };
  }, [mapsReady, popupListing, onPopupBook]);

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
