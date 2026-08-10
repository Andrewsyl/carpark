import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useRef, useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, View } from "react-native";
import type { TextInput as RNTextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { PROVIDER_GOOGLE, type Region } from "react-native-maps";
import { MapPinned, Search } from "lucide-react-native";
import { MapPin } from "../../components/MapPin";
import { useListingFlow } from "./context";
import { FlowHeader } from "./FlowHeader";
import { StepQuestion } from "./StepQuestion";
import { hostFlowColors } from "./hostFlowTheme";
import { colors } from "../../styles/theme";
import { TextInput as AppTextInput } from "../../components/ui";
import { FlowFooter } from "./FlowFooter";

type FlowStackParamList = {
  ListingLocation: { fromReview?: boolean } | undefined;
  ListingStreetView: undefined;
  ListingReview: undefined;
};

type Props = NativeStackScreenProps<FlowStackParamList, "ListingLocation">;

type PlaceSuggestion = {
  description: string;
  place_id: string;
};

type PlaceDetailsResponse = {
  result?: {
    formatted_address?: string;
    geometry?: { location?: { lat: number; lng: number } };
  };
};

const ACCENT = hostFlowColors.accent;
const FG = hostFlowColors.text;
const MUTED = hostFlowColors.textMuted;
// No card shadow: the system separates with a rule and white space.

export function ListingLocationScreen({ navigation, route }: Props) {
  const { draft, setDraft, savedDraftUpdatedAt, discardSavedDraft } = useListingFlow();
  // When the host jumped here from the review screen to fix one thing, the
  // primary action returns them straight to review instead of re-walking the flow.
  const fromReview = route.params?.fromReview ?? false;
  const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const [query, setQuery] = useState(draft.location.address);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const mapRef = useRef<MapView>(null);
  const searchInputRef = useRef<RNTextInput>(null);
  const isTypingRef = useRef(false);
  const skipAutocompleteRef = useRef(0);

  const initialRegion: Region = {
    latitude: draft.location.latitude || 53.3498,
    longitude: draft.location.longitude || -6.2603,
    latitudeDelta: 0.0005,
    longitudeDelta: 0.0005,
  };

  const [mapVisible, setMapVisible] = useState(draft.location.address.trim().length > 0);
  const hasLocation = draft.location.address.trim().length > 0;

  // If the draft is reset (e.g. "Start fresh" from the resume banner), clear the
  // local search state so the field and map don't keep showing the old address.
  useEffect(() => {
    if (!draft.location.address) {
      setQuery("");
      setMapVisible(false);
    }
  }, [draft.location.address]);

  useEffect(() => {
    if (!mapsKey) return;
    if (skipAutocompleteRef.current > 0) {
      skipAutocompleteRef.current -= 1;
      return;
    }
    if (!isTypingRef.current || query.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const handle = setTimeout(() => void fetchAutocomplete(query), 300);
    return () => clearTimeout(handle);
  }, [query, mapsKey]);

  const fetchAutocomplete = async (value: string) => {
    if (!mapsKey) return;
    try {
      const params = new URLSearchParams({ input: value, key: mapsKey, components: "country:ie" });
      const res = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`);
      const payload = (await res.json()) as { predictions?: PlaceSuggestion[] };
      setSuggestions(payload.predictions ?? []);
    } catch {
      setSuggestions([]);
    }
  };

  const handleSelectSuggestion = async (suggestion: PlaceSuggestion) => {
    if (!mapsKey) return;
    setLoading(true);
    Keyboard.dismiss();
    isTypingRef.current = false;
    setSuggestions([]);
    try {
      const params = new URLSearchParams({ place_id: suggestion.place_id, key: mapsKey, fields: "geometry,formatted_address" });
      const res = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params}`);
      const payload = (await res.json()) as PlaceDetailsResponse;
      const loc = payload.result?.geometry?.location;
      if (loc) {
        const address = payload.result?.formatted_address ?? suggestion.description;
        skipAutocompleteRef.current = 2;
        setMapVisible(true);
        setDraft((prev) => ({ ...prev, location: { address, latitude: loc.lat, longitude: loc.lng } }));
        setQuery(address);
        mapRef.current?.animateToRegion(
          { latitude: loc.lat, longitude: loc.lng, latitudeDelta: 0.0005, longitudeDelta: 0.0005 },
          400
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegionChangeComplete = (next: Region) => {
    setDraft((prev) => ({ ...prev, location: { ...prev.location, latitude: next.latitude, longitude: next.longitude } }));
  };

  const exitFlow = () => {
    const parent = navigation.getParent();
    if (parent?.canGoBack()) parent.goBack();
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <FlowHeader current={1} onClose={exitFlow} />

      {savedDraftUpdatedAt ? (
        <View style={styles.resumeBanner}>
          <Text style={styles.resumeText} numberOfLines={1}>
            Resuming your saved draft — pick up where you left off.
          </Text>
          <Pressable onPress={discardSavedDraft} hitSlop={8}>
            <Text style={styles.resumeAction}>Start fresh</Text>
          </Pressable>
        </View>
      ) : null}

      {/* 16a: the question is the header — no kicker, no card around it. The
          24px gutter lives here because this screen has no scroll container. */}
      <View style={styles.questionBlock}>
        <StepQuestion
          title="Where is your space?"
          hint="Search your address, then confirm it on the map."
        />
      </View>

      <View style={styles.searchSection}>
        <View style={styles.searchCard}>

          <View style={styles.searchInputRow}>
            <Search size={18} color={FG} strokeWidth={2} />
            <AppTextInput
              ref={searchInputRef}
              containerStyle={styles.searchInputContainer}
              variant="embedded"
              style={styles.searchInput}
              value={query}
              onChangeText={(text) => {
                isTypingRef.current = true;
                setQuery(text);
                if (!text) setSuggestions([]);
              }}
              onBlur={() => { isTypingRef.current = false; }}
              placeholder="Search address…"
            />
          </View>
        </View>

        {/* Suggestions dropdown — floats below the search card, over the map */}
        {suggestions.length > 0 && (
          <View style={styles.suggestions}>
            {suggestions.slice(0, 4).map((suggestion, index) => {
              const commaIdx = suggestion.description.indexOf(",");
              const mainText = commaIdx > -1 ? suggestion.description.slice(0, commaIdx) : suggestion.description;
              const secondaryText = commaIdx > -1 ? suggestion.description.slice(commaIdx + 1).trim() : "";
              return (
                <Pressable
                  key={suggestion.place_id}
                  style={[
                    styles.suggestionItem,
                    index === suggestions.slice(0, 4).length - 1 && styles.suggestionItemLast,
                  ]}
                  onPress={() => void handleSelectSuggestion(suggestion)}
                >
                  <View style={styles.suggestionIconCircle}>
                    <MapPinned size={15} color={ACCENT} strokeWidth={2.2} />
                  </View>
                  <View style={styles.suggestionCopy}>
                    <Text style={styles.suggestionText}>{mainText}</Text>
                    {secondaryText ? <Text style={styles.suggestionSubText}>{secondaryText}</Text> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {/* Map card — contained, same section treatment as the Street View viewer */}
      <View style={styles.mapCard}>
        {mapVisible ? (
          <>
            <MapView
              ref={mapRef}
              style={StyleSheet.absoluteFill}
              initialRegion={initialRegion}
              provider={PROVIDER_GOOGLE}
              // Satellite, so a host can recognise their own driveway from the
              // roof line. Google ignores customMapStyle on satellite, so no
              // style is passed — it would be dead config, not a silent default.
              mapType="satellite"
              onRegionChangeComplete={(region) => void handleRegionChangeComplete(region)}
            />
            <View style={styles.centerPin} pointerEvents="none">
              <MapPin />
            </View>
            <View style={styles.dragHintWrap} pointerEvents="none">
              <View style={styles.dragHint}>
                <Text style={styles.dragHintText}>Drag the map to place the pin on your space</Text>
              </View>
            </View>
          </>
        ) : (
          <Pressable style={styles.mapPlaceholder} onPress={() => searchInputRef.current?.focus()}>
            <View style={styles.mapPlaceholderIconCircle}>
              <MapPinned size={38} color={ACCENT} strokeWidth={2} />
            </View>
            <Text style={styles.mapPlaceholderTitle}>Search for your address</Text>
            <Text style={styles.mapPlaceholderText}>
              Tap here to search, then pick your address from the results
            </Text>
          </Pressable>
        )}
      </View>

      <FlowFooter
        current={1}
        total={9}
        onBack={() => (fromReview ? navigation.navigate("ListingReview") : navigation.goBack())}
        primaryLabel={loading ? "Loading…" : fromReview ? "Save changes" : "Confirm location"}
        onPrimary={() => navigation.navigate(fromReview ? "ListingReview" : "ListingStreetView")}
        primaryDisabled={loading || !hasLocation}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: hostFlowColors.bg,
    flex: 1,
  },

  /** 16a's step inset, carried here because this screen has no scroll view. */
  questionBlock: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 14,
  },

  resumeBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: hostFlowColors.accentSoft,
    borderBottomWidth: 1,
    borderBottomColor: hostFlowColors.accentSoftBorder,
  },
  resumeText: {
    flex: 1,
    color: FG,
    fontFamily: "PlusJakartaSans-Medium",
    fontSize: 13,
  },
  resumeAction: {
    color: ACCENT,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    flexShrink: 0,
  },
  // Its own section above the map; the suggestions dropdown hangs off its bottom.
  // zIndex so the absolutely-positioned suggestions sit above the map card
  // below them — without it the map paints over the list and eats the taps.
  searchSection: { zIndex: 10, elevation: 10 },
  mapCard: {
    // Contained rounded card matching the Street View viewer, rather than a
    // full-bleed edge-to-edge map. Insets at the step's 24 gutter so it shares
    // a left edge with the question and the search card above it.
    flex: 1,
    position: "relative",
    marginHorizontal: 24,
    marginTop: 8,
    marginBottom: 16,
    borderRadius: 12,
    overflow: "hidden",
  },

  centerPin: {
    left: "50%",
    position: "absolute",
    top: "50%",
    transform: [{ translateX: -18 }, { translateY: -36 }],
  },

  mapPlaceholder: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    gap: 14,
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  mapPlaceholderIconCircle: {
    alignItems: "center",
    borderColor: hostFlowColors.accentSoftBorder,
    borderRadius: 999,
    borderWidth: 2,
    height: 80,
    justifyContent: "center",
    width: 80,
  },
  mapPlaceholderTitle: {
    color: FG,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    textAlign: "center",
  },
  mapPlaceholderText: {
    color: MUTED,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },

  dragHintWrap: {
    alignItems: "center",
    bottom: 20,
    left: 0,
    position: "absolute",
    right: 0,
  },
  dragHint: {
    backgroundColor: "rgba(15, 23, 42, 0.68)",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  dragHintText: {
    color: colors.textInverse,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 12,
    letterSpacing: 0.1,
  },

  // Search card: header (kicker+title) + input row — matches the Street View
  // header card (1px border + soft card shadow).
  // 16a's field: a 52px pill on a light outline. It previously carried a 2px ink
  // border and stacked its own padding on the inner row's, which made a ~78px
  // slab that read as the loudest thing on the step.
  searchCard: {
    marginHorizontal: 24,
    marginTop: 20,
    height: 52,
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: hostFlowColors.borderStrong,
    borderRadius: 999,
    paddingHorizontal: 16,
  },
  searchInputRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  searchInputContainer: {
    flex: 1,
    marginBottom: 0,
    justifyContent: "center",
  },
  searchInput: {
    color: FG,
    flex: 1,
    fontSize: 15,
    fontFamily: "PlusJakartaSans-Regular",
    fontWeight: "400",
    lineHeight: 22,
    minHeight: 22,
    includeFontPadding: false,
    paddingVertical: 0,
  },
  suggestions: {
    // Hang off the bottom of the search card so it overlays the map without
    // pushing it down.
    position: "absolute",
    top: "100%",
    left: 24,
    right: 24,
    zIndex: 11,
    elevation: 11,
    backgroundColor: hostFlowColors.cardBg,
    borderRadius: 14,
    marginTop: 8,
    overflow: "hidden",
    shadowColor: colors.viewerBackdrop,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
  },
  suggestionItem: {
    alignItems: "center",
    borderBottomColor: hostFlowColors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  suggestionItemLast: {
    borderBottomWidth: 0,
  },
  suggestionIconCircle: {
    alignItems: "center",
    borderRadius: 20,
    flexShrink: 0,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  suggestionCopy: {
    flex: 1,
  },
  suggestionText: {
    color: FG,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14,
  },
  suggestionSubText: {
    color: hostFlowColors.textSoft,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12,
    marginTop: 2,
  },
});
