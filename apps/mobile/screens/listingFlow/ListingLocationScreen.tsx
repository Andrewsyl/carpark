import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from "react-native-maps";
import * as Location from "expo-location";
import { MapPin } from "../../components/MapPin";
import { LIGHT_MAP_STYLE } from "../../components/mapStyles";
import { useListingFlow } from "./context";
import { StepProgress } from "./StepProgress";

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
            <Text style={styles.mapPlaceholderText}>Select an address to preview the map.</Text>
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
    backgroundColor: "#f5f7fb",
    flex: 1,
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 0,
  },
  kicker: {
    color: "#00d4aa",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  title: {
    color: "#0f172a",
    fontSize: 22,
    fontWeight: "700",
    marginTop: 6,
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  subtitle: {
    color: "#6b7280",
    fontSize: 13,
    marginTop: 6,
    lineHeight: 20,
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  searchShell: {
    paddingHorizontal: 18,
    marginTop: 12,
  },
  searchField: {
    alignItems: "center",
    borderColor: "#e5e7eb",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    color: "#0f172a",
    flex: 1,
    fontSize: 14,
  },
  clearButton: {
    alignItems: "center",
    backgroundColor: "#eef2f7",
    borderRadius: 999,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  clearButtonText: {
    color: "#475467",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 18,
  },
  suggestions: {
    backgroundColor: "#ffffff",
    borderColor: "#e5e7eb",
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 18,
    marginTop: 8,
    overflow: "hidden",
  },
  suggestionItem: {
    borderBottomColor: "#f1f5f9",
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  suggestionText: {
    color: "#0f172a",
    fontSize: 13,
  },
  suggestionMuted: {
    color: "#94a3b8",
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
    backgroundColor: "#f8fafc",
    borderColor: "#e5e7eb",
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  mapPlaceholderText: {
    color: "#6b7280",
    fontSize: 13,
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
    backgroundColor: "#00d4aa",
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
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "600",
  },
  addressPrompt: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderColor: "#e5e7eb",
    borderRadius: 16,
    borderWidth: 1,
    bottom: 14,
    left: 16,
    padding: 14,
    position: "absolute",
    right: 16,
  },
  addressPromptTitle: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "700",
  },
  addressPromptBody: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 6,
  },
  addressPromptValue: {
    color: "#0f172a",
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
    borderColor: "#e5e7eb",
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 10,
  },
  addressPromptGhostText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  addressPromptPrimary: {
    backgroundColor: "#00d4aa",
    borderRadius: 12,
    flex: 1,
    paddingVertical: 10,
  },
  addressPromptPrimaryText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  footer: {
    backgroundColor: "#ffffff",
    borderTopColor: "#e5e7eb",
    borderTopWidth: 1,
    padding: 16,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#00d4aa",
    borderRadius: 14,
    paddingVertical: 14,
  },
  primaryButtonDisabled: {
    backgroundColor: "#d1d5db",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
});
