import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from "react-native-maps";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { MapPin } from "../../components/MapPin";
import { LIGHT_MAP_STYLE } from "../../components/mapStyles";
import { useListingFlow } from "./context";
import { StepProgress } from "./StepProgress";
import { colors, radius, spacing, textStyles } from "../../styles/theme";

type FlowStackParamList = {
  ListingLocation: undefined;
  ListingStreetView: undefined;
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

export function ListingLocationScreen({ navigation }: Props) {
  const { draft, setDraft } = useListingFlow();
  const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const [query, setQuery] = useState(draft.location.address);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);
  const [movePinMode, setMovePinMode] = useState(true);
  const [mapVisible, setMapVisible] = useState(false);
  const [pendingAddress, setPendingAddress] = useState<string | null>(null);
  const [showAddressPrompt, setShowAddressPrompt] = useState(false);
  const pendingCenterRef = useRef<Region | null>(null);
  const mapRef = useRef<MapView>(null);
  const skipAutocompleteRef = useRef(0);
  const ADDRESS_PROMPT_DISTANCE_M = 10;
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

  const region = useMemo<Region>(
    () => ({
      latitude: draft.location.latitude,
      longitude: draft.location.longitude,
      latitudeDelta: 0.0005,
      longitudeDelta: 0.0005,
    }),
    [draft.location.latitude, draft.location.longitude]
  );

  useEffect(() => {
    if (mapVisible) return;
    if (Platform.OS === "ios") {
      setMapVisible(true);
      return;
    }
    if (draft.location.address.trim().length > 0) {
      setMapVisible(true);
    }
  }, [draft.location.address, mapVisible]);

  useEffect(() => {
    if (!mapsKey) return;
    if (skipAutocompleteRef.current > 0) {
      skipAutocompleteRef.current -= 1;
      return;
    }
    if (query.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const handle = setTimeout(() => {
      void fetchAutocomplete(query);
    }, 300);
    return () => clearTimeout(handle);
  }, [query, mapsKey]);

  const fetchAutocomplete = async (value: string) => {
    if (!mapsKey) return;
    setAddressLoading(true);
    try {
      const params = new URLSearchParams({
        input: value,
        key: mapsKey,
        components: "country:ie",
      });
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`
      );
      const payload = (await response.json()) as { predictions?: PlaceSuggestion[] };
      setSuggestions(payload.predictions ?? []);
    } catch {
      setSuggestions([]);
    } finally {
      setAddressLoading(false);
    }
  };

  const handleSelectSuggestion = async (suggestion: PlaceSuggestion) => {
    if (!mapsKey) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        place_id: suggestion.place_id,
        key: mapsKey,
        fields: "geometry,formatted_address",
      });
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`
      );
      const payload = (await response.json()) as PlaceDetailsResponse;
      const location = payload.result?.geometry?.location;
      if (location) {
        setMapVisible(true);
        skipAutocompleteRef.current = 2;
        setDraft((prev) => ({
          ...prev,
          location: {
            address: payload.result?.formatted_address ?? suggestion.description,
            latitude: location.lat,
            longitude: location.lng,
          },
        }));
        setQuery(payload.result?.formatted_address ?? suggestion.description);
        Keyboard.dismiss();
        mapRef.current?.animateToRegion(
          {
            latitude: location.lat,
            longitude: location.lng,
            latitudeDelta: 0.0005,
            longitudeDelta: 0.0005,
          },
          400
        );
      }
    } finally {
      setLoading(false);
      setSuggestions([]);
    }
  };

  const formatReverseGeocode = (entry: Location.LocationGeocodedAddress) => {
    const parts = [
      entry.name,
      entry.street,
      entry.city,
      entry.region,
      entry.postalCode,
    ].filter(Boolean);
    return parts.join(", ");
  };

  const finalizePinFromRegion = async (next: Region) => {
    const prevCoords = {
      lat: draft.location.latitude,
      lng: draft.location.longitude,
    };
    setMapVisible(true);
    setDraft((prev) => ({
      ...prev,
      location: {
        ...prev.location,
        latitude: next.latitude,
        longitude: next.longitude,
      },
    }));
    setSuggestions([]);
    Keyboard.dismiss();
    try {
      const [first] = await Location.reverseGeocodeAsync({
        latitude: next.latitude,
        longitude: next.longitude,
      });
      if (first) {
        const label = formatReverseGeocode(first);
        const currentAddress = draft.location.address?.trim() ?? "";
        if (label && (!currentAddress || currentAddress === label)) {
          setDraft((prev) => ({
            ...prev,
            location: {
              ...prev.location,
              address: label,
            },
          }));
          setQuery(label);
          return;
        }
        if (label) {
          const movedMeters = distanceMeters(prevCoords, {
            lat: next.latitude,
            lng: next.longitude,
          });
          if (movedMeters < ADDRESS_PROMPT_DISTANCE_M) {
            return;
          }
          setPendingAddress(label);
          setShowAddressPrompt(true);
        }
      }
    } catch {
      // Ignore reverse geocode errors.
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Find your space</Text>
        <StepProgress current={1} total={7} />
        <Text style={styles.title}>Confirm location</Text>
        <Text style={styles.subtitle}>
          Drag the pin to your exact spot. You can change this later.
        </Text>
      </View>
      <View style={styles.searchShell}>
        <View style={styles.searchField}>
          <Ionicons name="search" size={20} color={colors.accent} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search address"
            placeholderTextColor="#94a3b8"
          />
          {query ? (
            <Pressable
              style={styles.clearButton}
              onPress={() => {
                setQuery("");
                setSuggestions([]);
              }}
            >
              <Text style={styles.clearButtonText}>×</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {mapsKey && (addressLoading || suggestions.length > 0) ? (
        <View style={styles.suggestions}>
          {addressLoading ? (
            <Text style={styles.suggestionMuted}>Searching...</Text>
          ) : (
            suggestions.slice(0, 4).map((suggestion) => (
              <Pressable
                key={suggestion.place_id}
                style={styles.suggestionItem}
                onPress={() => void handleSelectSuggestion(suggestion)}
              >
                <Text style={styles.suggestionText}>{suggestion.description}</Text>
              </Pressable>
            ))
          )}
        </View>
      ) : null}
      <View style={styles.mapShell}>
        {mapVisible ? (
          <>
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={region}
              provider={PROVIDER_GOOGLE}
              mapType="satellite"
              customMapStyle={LIGHT_MAP_STYLE}
              onRegionChange={(nextRegion) => {
                if (movePinMode) pendingCenterRef.current = nextRegion;
              }}
              onRegionChangeComplete={(nextRegion) => {
                if (movePinMode) pendingCenterRef.current = nextRegion;
              }}
            >
              {!movePinMode ? (
                <Marker
                  draggable={movePinMode}
                  coordinate={{
                    latitude: draft.location.latitude,
                    longitude: draft.location.longitude,
                  }}
                  anchor={{ x: 0.5, y: 1 }}
                  centerOffset={{ x: 0, y: -6 }}
                  onDragEnd={(event) => {
                    const { latitude, longitude } = event.nativeEvent.coordinate;
                    void finalizePinFromRegion({
                      latitude,
                      longitude,
                      latitudeDelta: region.latitudeDelta,
                      longitudeDelta: region.longitudeDelta,
                    });
                  }}
                >
                  <MapPin />
                </Marker>
              ) : null}
            </MapView>
            {movePinMode ? (
              <View style={styles.centerPin} pointerEvents="none">
                <MapPin />
              </View>
            ) : null}
            {showAddressPrompt && pendingAddress ? (
              <View style={styles.addressPrompt}>
                <Text style={styles.addressPromptTitle}>Update address?</Text>
                <Text style={styles.addressPromptBody}>We found a nearby address:</Text>
                <Text style={styles.addressPromptValue}>{pendingAddress}</Text>
                <View style={styles.addressPromptActions}>
                  <Pressable
                    style={styles.addressPromptGhost}
                    onPress={() => {
                      setShowAddressPrompt(false);
                      setPendingAddress(null);
                      setQuery(draft.location.address);
                    }}
                  >
                    <Text style={styles.addressPromptGhostText}>Keep original</Text>
                  </Pressable>
                  <Pressable
                    style={styles.addressPromptPrimary}
                    onPress={() => {
                      if (pendingAddress) {
                        setDraft((prev) => ({
                          ...prev,
                          location: {
                            ...prev.location,
                            address: pendingAddress,
                          },
                        }));
                        setQuery(pendingAddress);
                      }
                      setShowAddressPrompt(false);
                      setPendingAddress(null);
                    }}
                  >
                    <Text style={styles.addressPromptPrimaryText}>Use new address</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
            <View style={styles.mapControls}>
              <Pressable
                style={[styles.movePinToggle, movePinMode && styles.movePinToggleActive]}
                onPress={() => {
                  if (movePinMode) {
                    const next = pendingCenterRef.current;
                    if (next) void finalizePinFromRegion(next);
                    pendingCenterRef.current = null;
                  }
                  setMovePinMode((prev) => !prev);
                }}
              >
                <Text style={styles.movePinToggleText}>
                  {movePinMode ? "Drop pin" : "Move pin"}
                </Text>
              </Pressable>
              {movePinMode ? (
                <View style={styles.movePinHint}>
                  <Text style={styles.movePinHintText}>Drag the map to position</Text>
                </View>
              ) : null}
            </View>
          </>
        ) : (
          <View style={styles.mapPlaceholder}>
            <View style={styles.mapPlaceholderIconCircle}>
              <Ionicons name="map-outline" size={48} color={colors.accent} />
            </View>
            <View style={styles.mapPlaceholderContent}>
              <Text style={styles.mapPlaceholderTitle}>No location selected</Text>
              <Text style={styles.mapPlaceholderText}>
                Search for an address above to preview your parking spot on the map
              </Text>
            </View>
          </View>
        )}
      </View>
      <View style={styles.footer}>
        <Pressable
          style={[styles.primaryButton, !mapVisible && styles.primaryButtonDisabled]}
          onPress={() => navigation.navigate("ListingStreetView")}
          disabled={loading || !mapVisible}
        >
          <Text style={styles.primaryButtonText}>
            {loading ? "Loading..." : "Confirm location"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.appBg,
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.screenX,
    paddingTop: 0,
  },
  kicker: textStyles.kicker,
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
    marginTop: 6,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 6,
    lineHeight: 20,
  },
  searchShell: {
    paddingHorizontal: spacing.screenX,
    marginTop: 16,
  },
  searchField: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 14,
    borderWidth: 2,
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
  },
  clearButton: {
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: radius.pill,
    height: 26,
    justifyContent: "center",
    width: 26,
  },
  clearButtonText: {
    color: colors.textMuted,
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 20,
  },
  suggestions: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: spacing.screenX,
    marginTop: 8,
    overflow: "hidden",
  },
  suggestionItem: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  suggestionText: {
    color: colors.text,
    fontSize: 13,
  },
  suggestionMuted: {
    color: colors.textSoft,
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  mapShell: {
    flex: 1,
    marginTop: 12,
    position: "relative",
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    alignItems: "center",
    backgroundColor: "#fafbfc",
    borderColor: colors.border,
    borderRadius: radius.card,
    borderStyle: "dashed",
    borderWidth: 2,
    flex: 1,
    gap: 20,
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  mapPlaceholderIconCircle: {
    alignItems: "center",
    backgroundColor: "#e9fbf6",
    borderColor: "#b8efe3",
    borderRadius: 999,
    borderWidth: 2,
    height: 96,
    justifyContent: "center",
    width: 96,
  },
  mapPlaceholderContent: {
    alignItems: "center",
    gap: 8,
  },
  mapPlaceholderTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  mapPlaceholderText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  centerPin: {
    left: "50%",
    position: "absolute",
    top: "50%",
    transform: [{ translateX: -18 }, { translateY: -36 }],
  },
  mapControls: {
    alignItems: "flex-end",
    left: 16,
    position: "absolute",
    right: 16,
    top: 12,
  },
  movePinToggle: {
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  movePinToggleActive: {
    backgroundColor: colors.accent,
  },
  movePinToggleText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  movePinHint: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 10,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  movePinHintText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  addressPrompt: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    bottom: 14,
    left: 16,
    padding: 14,
    position: "absolute",
    right: 16,
  },
  addressPromptTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  addressPromptBody: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 6,
  },
  addressPromptValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },
  addressPromptActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  addressPromptGhost: {
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 10,
  },
  addressPromptGhostText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  addressPromptPrimary: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    flex: 1,
    paddingVertical: 10,
  },
  addressPromptPrimaryText: {
    color: colors.cardBg,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  footer: {
    backgroundColor: colors.cardBg,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    padding: 16,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
  },
  primaryButtonDisabled: {
    backgroundColor: "#d1d5db",
  },
  primaryButtonText: {
    color: colors.cardBg,
    fontSize: 15,
    fontWeight: "700",
  },
});
