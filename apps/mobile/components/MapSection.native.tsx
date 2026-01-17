import { useEffect, useMemo, useRef, useState, type Ref } from "react";
import { StyleSheet, View } from "react-native";
import MapView, {
  type EdgePadding,
  Marker,
  PROVIDER_DEFAULT,
  PROVIDER_GOOGLE,
  type Region,
} from "react-native-maps";
import ViewShot, { type ViewShotRef } from "react-native-view-shot";
import { PricePin } from "./PricePin";

type ListingResult = {
  id: string;
  title: string;
  address: string;
  price_per_day: number;
  is_available?: boolean | null;
  latitude?: number | null;
  longitude?: number | null;
};

type MapRegion = Region;
const PIN_STYLE_VERSION = "v15";
const METERS_PER_DEGREE_LAT = 111_000;
const toRad = (value: number) => (value * Math.PI) / 180;
const distanceMeters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
};
const formatPinPrice = (value: number) => {
  const rounded = Math.round(value * 100) / 100;
  const formatted = rounded.toFixed(2);
  if (formatted.endsWith(".00")) return formatted.slice(0, -3);
  return formatted.replace(/0+$/, "").replace(/\.$/, "");
};

export default function MapSection({
  region,
  style,
  initialRegion,
  results,
  onSelect,
  onRegionChangeComplete,
  selectedId,
  provider,
  mapPadding,
  mapRef,
  freezeMarkers,
  onMapLoaded,
  onMapReady,
  googleMapId,
  customMapStyle,
}: {
  region?: MapRegion;
  initialRegion: MapRegion;
  results: ListingResult[];
  style?: object;
  onSelect?: (id: string) => void;
  onRegionChangeComplete?: (nextRegion: MapRegion) => void;
  selectedId?: string | null;
  provider?: "google" | "default";
  mapPadding?: EdgePadding;
  mapRef?: Ref<MapView>;
  freezeMarkers?: boolean;
  onMapLoaded?: () => void;
  onMapReady?: () => void;
  googleMapId?: string;
  customMapStyle?: Array<Record<string, unknown>>;
}) {
  const nextResults = useMemo(
    () =>
      results.filter(
        (listing) =>
          typeof listing.latitude === "number" && typeof listing.longitude === "number"
      ),
    [results]
  );
  const renderedResultsRef = useRef(nextResults);
  const captureRefs = useRef(new Map<string, ViewShotRef>());
  const pendingCaptures = useRef(new Set<string>());
  const [pinImages, setPinImages] = useState<Record<string, string>>({});
  const pinLabelById = useMemo(
    () =>
      nextResults.reduce<Record<string, string>>((acc, listing) => {
        acc[listing.id] =
          listing.is_available === false
            ? "Sold out"
            : `€${formatPinPrice(listing.price_per_day)}`;
        return acc;
      }, {}),
    [nextResults]
  );
  const labelKeys = useMemo(() => {
    const labels = Array.from(new Set(Object.values(pinLabelById)));
    const keys: string[] = [];
    labels.forEach((label) => {
      keys.push(`${label}|default|${PIN_STYLE_VERSION}`);
      keys.push(`${label}|selected|${PIN_STYLE_VERSION}`);
    });
    return keys;
  }, [pinLabelById]);
  const pinsReady = useMemo(
    () => labelKeys.every((key) => Boolean(pinImages[key])),
    [labelKeys, pinImages]
  );
  const providerValue =
    provider === "google"
      ? PROVIDER_GOOGLE
      : provider === "default"
        ? PROVIDER_DEFAULT
        : undefined;
  useEffect(() => {
    if (freezeMarkers && renderedResultsRef.current.length) return;
    renderedResultsRef.current = nextResults;
  }, [nextResults, freezeMarkers]);
  useEffect(() => {
    setPinImages((prev) => {
      const next: Record<string, string> = {};
      let changed = false;
      Object.entries(prev).forEach(([key, value]) => {
        if (labelKeys.includes(key)) {
          next[key] = value;
        } else {
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [labelKeys]);

  useEffect(() => {
    labelKeys.forEach((key) => {
      if (pinImages[key] || pendingCaptures.current.has(key)) return;
      const ref = captureRefs.current.get(key);
      if (!ref) return;
      pendingCaptures.current.add(key);
      void ref
        .capture?.()
        .then((uri) => {
          if (!uri) return;
          setPinImages((prev) => ({ ...prev, [key]: uri }));
        })
        .finally(() => {
          pendingCaptures.current.delete(key);
        });
    });
  }, [labelKeys, pinImages]);
  const getPinKey = (label: string, selected: boolean) =>
    `${label}|${selected ? "selected" : "default"}|${PIN_STYLE_VERSION}`;
  return (
    <View style={styles.container}>
      <MapView
        style={[styles.map, style]}
        ref={mapRef}
        provider={providerValue}
        initialRegion={initialRegion}
        region={region}
        onRegionChangeComplete={onRegionChangeComplete}
        onMapLoaded={onMapLoaded}
        onMapReady={onMapReady}
        googleMapId={googleMapId}
        customMapStyle={customMapStyle}
        onPress={(event) => {
          if (!onSelect) return;
          const { latitude, longitude } = event.nativeEvent.coordinate;
          const target = { lat: latitude, lng: longitude };
          const regionRef = region ?? initialRegion;
          const thresholdM = Math.max(
            60,
            regionRef.latitudeDelta * METERS_PER_DEGREE_LAT * 0.03
          );
          let closest: { id: string; distance: number } | null = null;
          const list = freezeMarkers ? renderedResultsRef.current : nextResults;
          list.forEach((listing) => {
            if (typeof listing.latitude !== "number" || typeof listing.longitude !== "number")
              return;
            const dist = distanceMeters(target, {
              lat: listing.latitude,
              lng: listing.longitude,
            });
            if (dist > thresholdM) return;
            if (!closest || dist < closest.distance) {
              closest = { id: listing.id, distance: dist };
            }
          });
          if (closest) onSelect(closest.id);
        }}
        mapPadding={mapPadding}
        moveOnMarkerPress={false}
        mapType="standard"
      >
        {pinsReady
          ? (freezeMarkers ? renderedResultsRef.current : nextResults).map((listing) => {
          const isSelected = selectedId === listing.id;
          const label =
            pinLabelById[listing.id] ?? `€${formatPinPrice(listing.price_per_day)}`;
          const pinKey = getPinKey(label, isSelected);
          const pinImage = pinImages[pinKey];
          if (!pinImage) return null;
          return (
            <Marker
              key={`marker-${listing.id}-${isSelected ? "sel" : "def"}-${PIN_STYLE_VERSION}`}
              coordinate={{
                latitude: listing.latitude as number,
                longitude: listing.longitude as number,
              }}
              tracksViewChanges={false}
              anchor={{ x: 0.5, y: 1 }}
              centerOffset={{ x: 0, y: 0 }}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              onPress={(e) => {
                e?.stopPropagation?.();
                onSelect?.(listing.id);
              }}
              zIndex={isSelected ? 1000 : listing.id.charCodeAt(0)}
              image={{ uri: pinImage }}
            />
          );
        })
          : null}
      </MapView>
      <View style={styles.captureShell} pointerEvents="none">
        {labelKeys.map((key) => {
          const [label, state] = key.split("|");
          const selected = state === "selected";
          return (
            <ViewShot
              key={key}
              ref={(ref) => {
                if (ref) {
                  captureRefs.current.set(key, ref);
                } else {
                  captureRefs.current.delete(key);
                }
              }}
              options={{ format: "png", result: "tmpfile", quality: 1 }}
              style={styles.capture}
            >
              <PricePin label={label} selected={selected} />
            </ViewShot>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  captureShell: {
    alignItems: "center",
    justifyContent: "center",
    opacity: 0,
    position: "absolute",
    left: -1000,
    top: -1000,
  },
  capture: {
    alignItems: "center",
    justifyContent: "center",
  },
});
