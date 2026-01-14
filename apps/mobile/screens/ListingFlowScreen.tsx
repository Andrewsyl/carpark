import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { ListingAvailabilityScreen } from "./listingFlow/ListingAvailabilityScreen";
import { ListingDetailsScreen } from "./listingFlow/ListingDetailsScreen";
import { ListingLocationScreen } from "./listingFlow/ListingLocationScreen";
import { ListingPhotosScreen } from "./listingFlow/ListingPhotosScreen";
import { ListingPriceScreen } from "./listingFlow/ListingPriceScreen";
import { ListingReviewScreen } from "./listingFlow/ListingReviewScreen";
import { ListingStreetViewScreen } from "./listingFlow/ListingStreetViewScreen";
import { ListingFlowContext, type ListingDraft } from "./listingFlow/context";
import { getListing, listAvailability } from "../api";
import { useAuth } from "../auth";
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
  accessCode: "",
  permissionDeclared: false,
  availability: {
    mode: "daily",
    detail: "Available every day",
    timeStart: new Date(new Date().setHours(0, 0, 0, 0)).toISOString(),
    timeEnd: new Date(new Date().setHours(23, 59, 0, 0)).toISOString(),
    dateStart: new Date().toISOString(),
    dateEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  },
  pricePerDay: "",
  photos: [],
};

type Props = NativeStackScreenProps<RootStackParamList, "CreateListingFlow">;

export function ListingFlowScreen({ route }: Props) {
  const listingId = route.params?.listingId ?? null;
  const { token } = useAuth();
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
    const weekdayMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
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
          accessCode:
            (listing as { access_code?: string; accessCode?: string }).access_code ??
            (listing as { access_code?: string; accessCode?: string }).accessCode ??
            "",
          permissionDeclared:
            (listing as { permission_declared?: boolean; permissionDeclared?: boolean })
              .permission_declared ??
            (listing as { permission_declared?: boolean; permissionDeclared?: boolean })
              .permissionDeclared ??
            true,
          availability: {
            ...prev.availability,
            detail: listing.availability_text ?? prev.availability.detail,
          },
          pricePerDay:
            listing.price_per_day != null ? String(listing.price_per_day) : prev.pricePerDay,
          photos: listing.image_urls ?? prev.photos,
        }));
        if (token) {
          try {
            const availability = await listAvailability({ token, listingId });
            if (!availability.length) return;
            const openEntry =
              availability.find((entry) => entry.kind === "open") ?? availability[0];
            const hasRepeat =
              Array.isArray(openEntry.repeatWeekdays) && openEntry.repeatWeekdays.length > 0;
            const isDaily = hasRepeat && openEntry.repeatWeekdays.length === 7;
            const mode = isDaily ? "daily" : hasRepeat ? "recurring" : "dates";
            setDraft((prev) => ({
              ...prev,
              availability: {
                ...prev.availability,
                mode,
                timeStart: openEntry.startsAt,
                timeEnd: openEntry.endsAt,
                dateStart: openEntry.startsAt,
                dateEnd: openEntry.endsAt,
                weekdays: hasRepeat
                  ? openEntry.repeatWeekdays.map((idx) => weekdayMap[idx] ?? "Mon")
                  : prev.availability.weekdays,
              },
            }));
          } catch {
            // Availability loading shouldn't block edit flow.
          }
        }
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
  }, [listingId, token]);

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
          screenOptions={({ navigation }) => ({
            headerShown: true,
            headerBackTitleVisible: false,
            headerTitleAlign: "center",
            headerTintColor: "#0f172a",
            headerStyle: { backgroundColor: "#f5f7fb" },
            headerShadowVisible: false,
            headerTitleStyle: {
              color: "#0f172a",
              fontSize: 17,
              fontWeight: "600",
            },
            headerLeft: () => (
              <Pressable
                onPress={() => {
                  const parentNav = navigation.getParent();
                  if (parentNav?.canGoBack()) {
                    parentNav.goBack();
                    return;
                  }
                  if (navigation.canGoBack()) {
                    navigation.goBack();
                  }
                }}
                style={styles.headerBack}
              >
                <Text style={styles.headerBackText}>Back</Text>
              </Pressable>
            ),
          })}
          initialRouteName={listingId ? "ListingReview" : "ListingLocation"}
        >
          <Stack.Screen
            name="ListingLocation"
            component={ListingLocationScreen}
            options={{ title: "Location" }}
          />
          <Stack.Screen
            name="ListingStreetView"
            component={ListingStreetViewScreen}
            options={{ title: "Street view" }}
          />
          <Stack.Screen
            name="ListingDetails"
            component={ListingDetailsScreen}
            options={{ title: "Details" }}
          />
          <Stack.Screen
            name="ListingAvailability"
            component={ListingAvailabilityScreen}
            options={{ title: "Availability" }}
          />
          <Stack.Screen
            name="ListingPrice"
            component={ListingPriceScreen}
            options={{ title: "Pricing" }}
          />
          <Stack.Screen
            name="ListingPhotos"
            component={ListingPhotosScreen}
            options={{ title: "Photos" }}
          />
          <Stack.Screen
            name="ListingReview"
            component={ListingReviewScreen}
            options={{ title: listingId ? "Review listing" : "Review & publish" }}
          />
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
  headerBack: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  headerBackText: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "600",
  },
});
