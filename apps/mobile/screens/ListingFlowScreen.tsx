import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { ListingAvailabilityScreen } from "./listingFlow/ListingAvailabilityScreen";
import { ListingDetailsScreen } from "./listingFlow/ListingDetailsScreen";
import { ListingLocationScreen } from "./listingFlow/ListingLocationScreen";
import { ListingPhotosScreen } from "./listingFlow/ListingPhotosScreen";
import { ListingPriceScreen } from "./listingFlow/ListingPriceScreen";
import { ListingReviewScreen } from "./listingFlow/ListingReviewScreen";
import { ListingStreetViewScreen } from "./listingFlow/ListingStreetViewScreen";
import { ListingFlowContext, type ListingDraft } from "./listingFlow/context";
import { getListing } from "../api";
import type { RootStackParamList } from "../types";

type FlowStackParamList = {
  ListingLocation: undefined;
  ListingStreetView: undefined;
  ListingDetails: undefined;
  ListingAvailability: undefined;
  ListingPrice: undefined;
  ListingPhotos: undefined;
  ListingReview: undefined;
};

const Stack = createNativeStackNavigator<FlowStackParamList>();

const defaultDraft: ListingDraft = {
  location: {
    address: "",
    latitude: 53.3498,
    longitude: -6.2603,
  },
  coverHeading: null,
  coverPitch: null,
  spaceType: "",
  accessOptions: [],
  availability: {
    mode: "daily",
    detail: "Available every day",
  },
  pricePerDay: "",
  photos: [],
};

type Props = NativeStackScreenProps<RootStackParamList, "CreateListingFlow">;

export function ListingFlowScreen({ route }: Props) {
  const listingId = route.params?.listingId ?? null;
  const [draft, setDraft] = useState<ListingDraft>(defaultDraft);
  const [loading, setLoading] = useState(!!listingId);
  const [error, setError] = useState<string | null>(null);

  const value = useMemo(
    () => ({
      draft,
      setDraft,
      listingId,
    }),
    [draft, listingId]
  );

  useEffect(() => {
    if (!listingId) {
      setLoading(false);
      setError(null);
      return;
    }
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const listing = await getListing(listingId);
        if (!active) return;
        setDraft((prev) => ({
          ...prev,
          location: {
            address: listing.address ?? "",
            latitude: listing.latitude ?? prev.location.latitude,
            longitude: listing.longitude ?? prev.location.longitude,
          },
          spaceType:
            (listing as { space_type?: string; spaceType?: string }).space_type ??
            (listing as { space_type?: string; spaceType?: string }).spaceType ??
            listing.title ??
            "",
          accessOptions: listing.amenities ?? [],
          availability: {
            ...prev.availability,
            detail: listing.availability_text ?? prev.availability.detail,
          },
          pricePerDay:
            listing.price_per_day != null ? String(listing.price_per_day) : prev.pricePerDay,
          photos: listing.image_urls ?? prev.photos,
        }));
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Could not load listing");
      } finally {
        if (!active) return;
        setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [listingId]);

  return (
    <ListingFlowContext.Provider value={value}>
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#0f172a" />
          <Text style={styles.loadingText}>Loading listing…</Text>
        </View>
      ) : error ? (
        <View style={styles.loading}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <Stack.Navigator
          screenOptions={{ headerShown: false }}
          initialRouteName={listingId ? "ListingReview" : "ListingLocation"}
        >
          <Stack.Screen name="ListingLocation" component={ListingLocationScreen} />
          <Stack.Screen name="ListingStreetView" component={ListingStreetViewScreen} />
          <Stack.Screen name="ListingDetails" component={ListingDetailsScreen} />
          <Stack.Screen name="ListingAvailability" component={ListingAvailabilityScreen} />
          <Stack.Screen name="ListingPrice" component={ListingPriceScreen} />
          <Stack.Screen name="ListingPhotos" component={ListingPhotosScreen} />
          <Stack.Screen name="ListingReview" component={ListingReviewScreen} />
        </Stack.Navigator>
      )}
    </ListingFlowContext.Provider>
  );
}

const styles = StyleSheet.create({
  loading: {
    alignItems: "center",
    backgroundColor: "#f5f7fb",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    color: "#475467",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 12,
  },
  errorText: {
    color: "#b42318",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
});
