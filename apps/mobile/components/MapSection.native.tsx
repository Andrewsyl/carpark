import { memo, useEffect, useMemo, useRef, useState, type Ref } from "react";
import { Animated, Image, InteractionManager, Platform, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import Svg, { Path } from "react-native-svg";
import MapView, {
  type EdgePadding,
  Marker,
  type MarkerPressEvent,
  PROVIDER_DEFAULT,
  PROVIDER_GOOGLE,
  type Region,
} from "react-native-maps";
import ViewShot from "react-native-view-shot";
import { MapPricePin, getPinDimensions } from "./MapPricePin";
import { formatPriceValue } from "../utils/pricing";
import { motion } from "../styles/motion";
import { useMarkerTracksUntilPainted } from "./useMarkerTracksUntilPainted";

type ListingResult = {
  id: string;
  title: string;
  address: string;
  price_per_day: number;
  price_per_hour?: number | null;
  rate_type?: "hourly" | "daily" | null;
  is_available?: boolean | null;
  latitude?: number | null;
  longitude?: number | null;
};

type ViewShotRef = InstanceType<typeof ViewShot>;

type MapRegion = Region;
// Bumped with every visual change to MapPricePin: pins ship as captured
// bitmaps keyed by this string, so a pin drawn under the old style would be
// served from cache forever without it.
const PIN_STYLE_VERSION = "v31";
const formatPinPrice = (value: number) => {
  return formatPriceValue(value);
};

function SearchOriginPin() {
  return (
    <Svg width={40} height={40} viewBox="0 0 24 24">
      <Path
        fillRule="evenodd"
        d="M11.5397 22.351C11.57 22.3685 11.5937 22.3821 11.6105 22.3915L11.6384 22.4071C11.8613 22.5294 12.1378 22.5285 12.3608 22.4075L12.3895 22.3915C12.4063 22.3821 12.43 22.3685 12.4603 22.351C12.5207 22.316 12.607 22.265 12.7155 22.1982C12.9325 22.0646 13.2388 21.8676 13.6046 21.6091C14.3351 21.0931 15.3097 20.3274 16.2865 19.3273C18.2307 17.3368 20.25 14.3462 20.25 10.5C20.25 5.94365 16.5563 2.25 12 2.25C7.44365 2.25 3.75 5.94365 3.75 10.5C3.75 14.3462 5.76932 17.3368 7.71346 19.3273C8.69025 20.3274 9.66491 21.0931 10.3954 21.6091C10.7612 21.8676 11.0675 22.0646 11.2845 22.1982C11.393 22.265 11.4793 22.316 11.5397 22.351ZM12 13.5C13.6569 13.5 15 12.1569 15 10.5C15 8.84315 13.6569 7.5 12 7.5C10.3431 7.5 9 8.84315 9 10.5C9 12.1569 10.3431 13.5 12 13.5Z"
        fill="#0a8050"
      />
    </Svg>
  );
}

// Wraps the origin pin so it tracks until its SVG has painted, then freezes —
// avoids the default red pin flashing when the pin first mounts. resumeNonce
// remounts it on screen focus for the same reason the listing pins remount:
// a frozen marker blanked by a native-stack push never repaints on its own.
function SearchOriginMarker({
  coordinate,
  resumeNonce,
}: {
  coordinate: { latitude: number; longitude: number };
  resumeNonce?: number;
}) {
  const tracks = useMarkerTracksUntilPainted(
    `${coordinate.latitude},${coordinate.longitude}|${resumeNonce ?? 0}`
  );
  return (
    <Marker
      key={`search-pin-${coordinate.latitude.toFixed(6)}-${coordinate.longitude.toFixed(6)}-${resumeNonce ?? 0}`}
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.94 }}
      tracksViewChanges={tracks}
      zIndex={5}
    >
      <SearchOriginPin />
    </Marker>
  );
}

const PIN_REVEAL_MS = motion.duration.fast;

type ListingPinMarkerProps = {
  listingId: string;
  coordinate: { latitude: number; longitude: number };
  selected: boolean;
  label: string;
  price: number;
  pinImage: string;
  entering: boolean;
  onPress: (event: MarkerPressEvent) => void;
};

// Android: hand the captured PNG straight to Google Maps as the marker's native
// icon (BitmapDescriptor) — no child views. The child-view path kept stranding
// the default red pin: Android rasterizes marker children once when
// tracksViewChanges flips false, Image.onLoad reports decode (not marker paint),
// and native-stack transitions don't register with InteractionManager, so every
// freeze heuristic could snapshot a blank frame — permanently red until remount.
// With a native icon there is no rasterization, no freeze, and nothing for
// react-native-screens to blank on a stack push. Costs accepted: no per-pin
// entrance fade here (pins land as one batch), and the first-ever load of each
// distinct label file may flash briefly — react-native-maps' shared-icon cache
// makes every later use synchronous. ViewShot captures at device pixelRatio and
// BitmapDescriptors draw 1:1 in physical pixels, so the dp size matches iOS.
function ListingPinMarkerAndroid({
  coordinate,
  selected,
  pinImage,
  onPress,
}: ListingPinMarkerProps) {
  return (
    <Marker
      coordinate={coordinate}
      image={{ uri: pinImage }}
      tracksViewChanges={false}
      anchor={{ x: 0.5, y: 0.5 }}
      centerOffset={{ x: 0, y: 0 }}
      onPress={onPress}
      zIndex={selected ? 1000000 : Math.round((90 - coordinate.latitude) * 10000)}
      tappable={true}
      stopPropagation={true}
    />
  );
}

// iOS: renders the pre-captured pin as a CHILD <Image> rather than via the Marker
// `image` prop. With a child view present, react-native-maps never draws the
// default red annotation, so there's no red-pin flash while the file URI decodes.
// tracksViewChanges stays true only until the image reports loaded, then flips
// off to keep the map performant. (iOS never suffered the Android stranded-red
// rasterization race, so it keeps the child path and the entrance animation.)
function ListingPinMarkerCaptured({
  listingId,
  coordinate,
  selected,
  label,
  price,
  pinImage,
  entering,
  onPress,
}: ListingPinMarkerProps) {
  const soldOut = label === "Full";
  const { viewBoxWidth, viewBoxHeight } = getPinDimensions(label, selected, soldOut);
  const [tracks, setTracks] = useState(true);
  const [imageReady, setImageReady] = useState(false);
  const cancelledRef = useRef(false);
  const freezeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Capture the entrance flag at mount. Markers that mount as part of a reveal batch
  // start hidden and animate up together; a marker remounted by a selection change
  // starts fully shown so it never blinks when tapped.
  const enteringAtMount = useRef(entering).current;
  const revealAnim = useRef(new Animated.Value(enteringAtMount ? 0 : 1)).current;
  // Selection remounts the marker (its state is folded into the marker key
  // upstream). We previously updated in place to dodge a default-red-pin flash on
  // Android, but in-place re-tracking of a frozen marker doesn't reliably repaint
  // there — a deselected pin stayed green while the tapped one turned green too,
  // so pins accumulated as "selected". A clean remount is the dependable fix.
  // Tapping a pin only recolors it — no pop/scale on selection (user-approved).
  // popAnim is pinned to 1 so the entrance-reveal transform below is unaffected.
  const popAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    cancelledRef.current = false;
    setTracks(true);
    setImageReady(false);
    return () => {
      cancelledRef.current = true;
      if (freezeTimerRef.current) clearTimeout(freezeTimerRef.current);
    };
  }, [pinImage]);

  // Coordinated entrance: all markers of a fresh result set mount in the same commit,
  // so animating on mount lands the whole set as one premium "pins placed" beat.
  useEffect(() => {
    if (!enteringAtMount) return;
    Animated.timing(revealAnim, {
      toValue: 1,
      duration: PIN_REVEAL_MS,
      easing: motion.easing.out,
      useNativeDriver: true,
    }).start();
  }, [enteringAtMount, revealAnim]);

  // Freeze the marker (stop regenerating its bitmap) only after the pin is painted AND
  // the entrance animation has finished — freezing mid-animation would snapshot a
  // half-faded frame, and freezing before paint could strand the default red pin.
  const freezeAfterReveal = () => {
    if (freezeTimerRef.current) clearTimeout(freezeTimerRef.current);
    freezeTimerRef.current = setTimeout(
      () => {
        InteractionManager.runAfterInteractions(() => {
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              if (!cancelledRef.current) setTracks(false);
            })
          );
        });
      },
      // Freezing rasterizes the marker, so it must outlast the batch entrance
      // reveal; a selection remount has no animation, so it can freeze at once.
      enteringAtMount ? PIN_REVEAL_MS + 40 : 0
    );
  };

  // Both a selection change AND a screen resume (resumeNonce) are folded into the
  // marker key upstream, so each pin remounts fresh and repaints from scratch
  // (tracks=true → paint → freeze). In-place re-tracking of a frozen marker
  // doesn't reliably repaint on Android after the OS blanks its native view, so a
  // clean remount is the dependable fix. Resume remount matters because a listing
  // is a native-stack push over the whole tab navigator: react-native-screens
  // detaches the Tabs screen (and its map) on push, blanking the frozen marker
  // views — without the resume remount they come back gone or as the default red
  // pin. The cost is a possible one-frame default pin on remount; the synchronous
  // vector fallback below keeps that minimal.

  const handleLoad = () => {
    setImageReady(true);
    freezeAfterReveal();
  };

  const handleError = () => {
    // Captured PNG failed to decode — keep the synchronous vector fallback visible
    // and only freeze once it has painted, so we never strand the red default pin.
    setImageReady(false);
    freezeAfterReveal();
  };

  return (
    <Marker
      key={`marker-${listingId}-${PIN_STYLE_VERSION}`}
      coordinate={coordinate}
      tracksViewChanges={tracks}
      anchor={{ x: 0.5, y: 0.5 }}
      centerOffset={{ x: 0, y: 0 }}
      onPress={onPress}
      zIndex={selected ? 1000000 : Math.round((90 - coordinate.latitude) * 10000)}
      tappable={true}
      stopPropagation={true}
    >
      <Animated.View
        collapsable={false}
        style={[
          styles.pinMarkerShell,
          { width: viewBoxWidth, height: viewBoxHeight },
          {
            opacity: revealAnim,
            transform: [
              {
                scale: Animated.multiply(
                  revealAnim.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }),
                  popAnim
                ),
              },
            ],
          },
        ]}
      >
        <View
          collapsable={false}
          pointerEvents="none"
          style={[styles.pinMarkerFallback, { opacity: imageReady ? 0 : 1 }]}
        >
          <MapPricePin price={soldOut ? 0 : price} selected={selected} soldOut={soldOut} />
        </View>
        <Image
          source={{ uri: pinImage }}
          style={[styles.pinMarkerImage, { width: viewBoxWidth, height: viewBoxHeight, opacity: imageReady ? 1 : 0 }]}
          resizeMode="contain"
          fadeDuration={0}
          onLoad={handleLoad}
          onError={handleError}
        />
      </Animated.View>
    </Marker>
  );
}

// Platform dispatch kept outside the two implementations so neither branch
// violates the rules of hooks (the captured path holds all the hook state).
function ListingPinMarker(props: ListingPinMarkerProps) {
  if (Platform.OS === "android") return <ListingPinMarkerAndroid {...props} />;
  return <ListingPinMarkerCaptured {...props} />;
}

function MapSection({
  region,
  style,
  initialRegion,
  results,
  onSelect,
  onRegionChangeComplete,
  onRegionChange,
  onPanDrag,
  selectedId,
  provider,
  mapPadding,
  mapRef,
  freezeMarkers,
  onMapLoaded,
  onMapReady,
  googleMapId,
  customMapStyle,
  onOverlappingPins,
  priceForListing,
  priceKey,
  priceSuffix,
  resumeNonce,
  searchPinCoordinate,
  onAllPinsRevealed,
  searchGeneration,
}: {
  region?: MapRegion;
  initialRegion: MapRegion;
  results: ListingResult[];
  style?: object;
  onSelect?: (id: string) => void;
  onRegionChangeComplete?: (nextRegion: MapRegion) => void;
  onRegionChange?: (nextRegion: MapRegion) => void;
  onPanDrag?: () => void;
  selectedId?: string | null;
  provider?: "google" | "default";
  mapPadding?: EdgePadding;
  mapRef?: Ref<MapView>;
  freezeMarkers?: boolean;
  onMapLoaded?: () => void;
  onMapReady?: () => void;
  googleMapId?: string;
  customMapStyle?: Array<Record<string, unknown>>;
  onOverlappingPins?: (pins: ListingResult[]) => void;
  priceForListing?: (listing: ListingResult) => number;
  priceKey?: string;
  // Appended after the price on each pin (e.g. "/mo" in monthly search). Kept
  // out of the numeric price so the label→price reconstruction still parses.
  priceSuffix?: string;
  resumeNonce?: number;
  searchPinCoordinate?: { latitude: number; longitude: number } | null;
  onAllPinsRevealed?: () => void;
  searchGeneration?: number;
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
  const stableImagesRef = useRef<Record<string, string>>({});
  const localMapRef = useRef<MapView | null>(null);
  const lastRegionRef = useRef<MapRegion>(region ?? initialRegion);
  const lastMarkerPressRef = useRef<number>(0);
  const [pinImages, setPinImages] = useState<Record<string, string>>({});
  const [pinsReady, setPinsReady] = useState(false);
  const [pinsVisible, setPinsVisible] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [pinsEntering, setPinsEntering] = useState(false);
  const enteringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasEverShownPins = useRef(false);
  const nextResultsRef = useRef(nextResults);
  nextResultsRef.current = nextResults;
  const pinLabelById = useMemo(
    () =>
      nextResults.reduce<Record<string, string>>((acc, listing) => {
        const priceValue = priceForListing
          ? priceForListing(listing)
          : Number(listing.price_per_day);
        acc[listing.id] =
          listing.is_available === false
            ? "Full"
            : `€${formatPinPrice(priceValue)}${priceSuffix ?? ""}`;
        return acc;
      }, {}),
    [nextResults, priceForListing, priceSuffix]
  );
  const labelKeys = useMemo(() => {
    const labels = Array.from(new Set(Object.values(pinLabelById)));
    const keys: string[] = [];
    labels.forEach((label) => {
      keys.push(`${label}|default|${PIN_STYLE_VERSION}|${priceKey ?? "base"}`);
      keys.push(`${label}|selected|${PIN_STYLE_VERSION}|${priceKey ?? "base"}`);
    });
    return keys;
  }, [pinLabelById, priceKey]);
  const providerValue =
    provider === "google"
      ? PROVIDER_GOOGLE
      : provider === "default"
        ? PROVIDER_DEFAULT
        : undefined;

  if (region) {
    lastRegionRef.current = region;
  }

  const attachMapRef = (instance: MapView | null) => {
    localMapRef.current = instance;
    if (!mapRef) return;
    if (typeof mapRef === "function") {
      mapRef(instance);
      return;
    }
    (mapRef as React.MutableRefObject<MapView | null>).current = instance;
  };
  useEffect(() => {
    if (freezeMarkers && renderedResultsRef.current.length) return;
    renderedResultsRef.current = nextResults;
  }, [nextResults, freezeMarkers]);
  useEffect(() => {
    // Only evict stale images once every key in the new label set has been captured.
    // This keeps old pin images alive during the capture gap so pins never flash away.
    const newSetReady = labelKeys.every((key) => Boolean(pinImages[key]));
    if (!newSetReady) {
      setPinsReady(false);
      // Only hide on first load — once pins have been shown keep them visible
      // so existing markers stay up while new captures run
      if (!hasEverShownPins.current) setPinsVisible(false);
      return;
    }
    setPinsReady(true);
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
  }, [labelKeys, pinImages]);

  useEffect(() => {
    if (!pinsReady) return;
    // Commit stable fallback images (keyed without priceKey) so pins stay
    // visible during the next recapture cycle (e.g. when time changes).
    const stable: Record<string, string> = {};
    Object.entries(pinImages).forEach(([key, uri]) => {
      const stableKey = key.split("|").slice(0, 3).join("|");
      stable[stableKey] = uri;
    });
    stableImagesRef.current = stable;
    const timer = setTimeout(() => {
      hasEverShownPins.current = true;
      setPinsVisible(true);
    }, 32);
    return () => clearTimeout(timer);
  }, [pinsReady, pinImages]);

  useEffect(() => {
    labelKeys.forEach((key) => {
      if (pinImages[key] || pendingCaptures.current.has(key)) return;
      const ref = captureRefs.current.get(key);
      if (!ref) return;
      pendingCaptures.current.add(key);
      void ref
        .capture?.()
        .then((uri: string | undefined) => {
          if (!uri) return;
          setPinImages((prev) => ({ ...prev, [key]: uri }));
        })
        .finally(() => {
          pendingCaptures.current.delete(key);
        });
    });
  }, [labelKeys, pinImages]);

  // Reveal all markers together once pinsReady flips true after each search.
  // Also keyed on the result id set: results land after searchGeneration bumps,
  // and if their labels were already captured pinsReady never toggles — without
  // this key the new ids would never enter revealedIds and their pins never draw.
  const resultIdsKey = useMemo(
    () => nextResults.map((listing) => listing.id).join("|"),
    [nextResults]
  );
  useEffect(() => {
    if (!pinsReady) {
      if (!hasEverShownPins.current) setRevealedIds(new Set());
      return;
    }
    const listings = nextResultsRef.current;
    // Reveal the whole set together. Every pin image is already captured by the time
    // pinsReady flips true, so dropping them simultaneously reads as a single premium
    // "pins placed" moment — like Airbnb / JustPark — instead of a per-pin cascade
    // that looks like uneven loading.
    // Flag this as an entrance batch so freshly-mounted markers animate in together;
    // clears shortly after so later selection remounts don't replay the animation.
    setPinsEntering(true);
    if (enteringTimerRef.current) clearTimeout(enteringTimerRef.current);
    enteringTimerRef.current = setTimeout(() => setPinsEntering(false), PIN_REVEAL_MS + 140);
    setRevealedIds(new Set(listings.map((listing) => listing.id)));
    const doneTimer = setTimeout(() => { onAllPinsRevealed?.(); }, 60);
    return () => {
      clearTimeout(doneTimer);
      if (enteringTimerRef.current) clearTimeout(enteringTimerRef.current);
    };
  }, [pinsReady, searchGeneration, resultIdsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const getPinKey = (label: string, selected: boolean) =>
    `${label}|${selected ? "selected" : "default"}|${PIN_STYLE_VERSION}|${priceKey ?? "base"}`;
  return (
    <View style={styles.container}>
      <MapView
        style={[styles.map, style]}
        ref={attachMapRef}
        provider={providerValue}
        initialRegion={initialRegion}
        region={region}
        cacheEnabled={Platform.OS !== "android"}
        loadingEnabled
        loadingBackgroundColor="#F9FAFB"
        onRegionChange={(nextRegion) => {
          lastRegionRef.current = nextRegion;
          onRegionChange?.(nextRegion);
        }}
        onPanDrag={onPanDrag}
        onRegionChangeComplete={(nextRegion) => {
          lastRegionRef.current = nextRegion;
          onRegionChangeComplete?.(nextRegion);
        }}
        onMapLoaded={onMapLoaded}
        onMapReady={onMapReady}
        googleMapId={googleMapId}
        customMapStyle={customMapStyle as any}
        onPress={() => {
          if (!onSelect) return;
          // If a marker was just pressed, ignore this map press to avoid deselecting
          if (Date.now() - lastMarkerPressRef.current < 400) return;
          onOverlappingPins?.([]);
          onSelect(null as any);
        }}
        mapPadding={mapPadding}
        moveOnMarkerPress={false}
        mapType="standard"
      >
        {searchPinCoordinate ? (
          <SearchOriginMarker coordinate={searchPinCoordinate} resumeNonce={resumeNonce} />
        ) : null}
        {pinsVisible && (freezeMarkers ? renderedResultsRef.current : nextResults).map((listing) => {
          if (!revealedIds.has(listing.id)) return null;
          const isSelected = selectedId === listing.id;
          const price = priceForListing ? priceForListing(listing) : Number(listing.price_per_day);
          const label = pinLabelById[listing.id] ?? `€${formatPinPrice(price)}${priceSuffix ?? ""}`;
          const pinKey = getPinKey(label, isSelected);
          const stableKey = `${label}|${isSelected ? "selected" : "default"}|${PIN_STYLE_VERSION}`;
          const pinImage = pinImages[pinKey] ?? stableImagesRef.current[stableKey];
          if (!pinImage) return null;
          return (
            <ListingPinMarker
              key={`marker-${listing.id}-${PIN_STYLE_VERSION}-${isSelected ? "sel" : "def"}-${resumeNonce ?? 0}`}
              listingId={listing.id}
              coordinate={{
                latitude: listing.latitude as number,
                longitude: listing.longitude as number,
              }}
              selected={isSelected}
              label={label}
              price={price}
              pinImage={pinImage}
              entering={pinsEntering}
              onPress={(e) => {
                e?.stopPropagation?.();
                lastMarkerPressRef.current = Date.now();
                // A soft selection tick on both platforms — the raw 8ms
                // Vibration buzz read as an error, not an acknowledgement.
                void Haptics.selectionAsync();
                onSelect?.(listing.id);
              }}
            />
          );
        })}
      </MapView>
      <View style={styles.captureShell} pointerEvents="none">
        {labelKeys.map((key) => {
          const [label, state] = key.split("|");
          const selected = state === "selected";
          const isSoldOut = label === "Full";
          const price = isSoldOut ? 0 : parseFloat(label.replace(/[€,]/g, "")) || 0;
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
              <MapPricePin price={price} selected={selected} soldOut={isSoldOut} />
            </ViewShot>
          );
        })}
      </View>
    </View>
  );
}

// Memoized: SearchScreen holds dozens of pieces of state (card visibility,
// pills, filters…), and without this the entire map + marker + ViewShot
// capture tree re-rendered on every one of them, saturating the JS thread and
// making taps feel delayed. Now it only re-renders when a prop that actually
// affects the map changes (results, selection, region, price key…).
export default memo(MapSection);

const styles = StyleSheet.create({
  capture: {
    alignItems: "center",
    justifyContent: "center",
  },
  captureShell: {
    alignItems: "center",
    justifyContent: "center",
    left: -1000,
    opacity: 0,
    position: "absolute",
    top: -1000,
  },
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  pinMarkerFallback: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "flex-start",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  pinMarkerImage: {
    alignSelf: "center",
  },
  pinMarkerShell: {
    alignItems: "center",
    justifyContent: "flex-start",
  },
});
