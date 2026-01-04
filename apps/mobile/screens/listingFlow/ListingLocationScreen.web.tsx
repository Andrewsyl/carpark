import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
  const skipAutocompleteRef = useRef(0);
  const canConfirm = draft.location.address.trim().length > 0;

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
      }
    } finally {
      setLoading(false);
      setSuggestions([]);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Find your space</Text>
        <StepProgress current={1} total={7} />
        <Text style={styles.title}>Confirm location</Text>
        <Text style={styles.subtitle}>
          Map preview is available on device. You can still set the address here.
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
        <View style={styles.mapPlaceholder}>
          <Text style={styles.mapPlaceholderText}>Map preview is available on device.</Text>
        </View>
      </View>
      <View style={styles.footer}>
        <Pressable
          style={[styles.primaryButton, !canConfirm && styles.primaryButtonDisabled]}
          onPress={() => navigation.navigate("ListingStreetView")}
          disabled={loading || !canConfirm}
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
    backgroundColor: "#ffffff",
    flex: 1,
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  kicker: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    color: "#0f172a",
    fontSize: 22,
    fontWeight: "700",
    marginTop: 6,
  },
  subtitle: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 6,
  },
  searchShell: {
    paddingHorizontal: 18,
    marginTop: 12,
  },
  searchField: {
    alignItems: "center",
    borderColor: "#e2e8f0",
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
    backgroundColor: "#e2e8f0",
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
    borderColor: "#e2e8f0",
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
    paddingHorizontal: 18,
  },
  mapPlaceholder: {
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 16,
    flex: 1,
    justifyContent: "center",
  },
  mapPlaceholderText: {
    color: "#64748b",
    fontSize: 13,
  },
  footer: {
    backgroundColor: "#ffffff",
    borderTopColor: "#e2e8f0",
    borderTopWidth: 1,
    padding: 16,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#2fa84f",
    borderRadius: 14,
    paddingVertical: 14,
  },
  primaryButtonDisabled: {
    backgroundColor: "#cbd5f5",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
});
