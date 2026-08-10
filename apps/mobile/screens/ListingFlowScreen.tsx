import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { ListingAvailabilityScreen } from "./listingFlow/ListingAvailabilityScreen";
import { ListingDetailsScreen } from "./listingFlow/ListingDetailsScreen";
import { ListingFeaturesScreen } from "./listingFlow/ListingFeaturesScreen";
import { ListingAccessScreen } from "./listingFlow/ListingAccessScreen";
import { ListingIntroScreen } from "./listingFlow/ListingIntroScreen";
import { ListingLocationScreen } from "./listingFlow/ListingLocationScreen";
import { ListingPhotosScreen } from "./listingFlow/ListingPhotosScreen";
import { ListingPriceScreen } from "./listingFlow/ListingPriceScreen";
import { ListingReviewScreen } from "./listingFlow/ListingReviewScreen";
import { ListingStreetViewScreen } from "./listingFlow/ListingStreetViewScreen";
import { ListingFlowContext, type ListingDraft } from "./listingFlow/context";
import { hostFlowColors } from "./listingFlow/hostFlowTheme";
import { clearHostListingDraft, loadHostListingDraft } from "./listingFlow/draftStorage";
import { getListing, listAvailability } from "../api";
import { useAuth } from "../auth";
import { getMobileE2EState, isMobileE2EActive } from "../e2e/testMode";
import type { RootStackParamList } from "../types";
import { colors } from "../styles/theme";

type FlowStackParamList = {
  ListingIntro: undefined;
  ListingLocation: undefined;
  ListingStreetView: undefined;
  ListingDetails: undefined;
  ListingFeatures: undefined;
  ListingAccess: undefined;
  ListingAvailability: undefined;
  ListingPhotos: undefined;
  ListingPrice: undefined;
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
  coverPanoId: null,
  spaceType: "",
  spaceCount: "",
  // No default — the host actively picks the largest vehicle that fits rather
  // than starting on a pre-selected guess.
  vehicleSize: "",
  accessOptions: [],
  requiresAccessCode: null,
  accessCode: "",
  requiresArrivalInstructions: null,
  arrivalInstructions: "",
  permissionDeclared: false,
  availability: {
    mode: "daily",
    detail: "Available every day",
    timeStart: new Date(new Date().setHours(0, 0, 0, 0)).toISOString(),
    timeEnd: new Date(new Date().setHours(23, 59, 0, 0)).toISOString(),
    dateStart: new Date().toISOString(),
    dateEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    dayTimeRanges: {},
  },
  // Deliberately unset: the pricing screen asks the host to choose hourly/daily,
  // monthly, or both before revealing any rate fields.
  pricingMode: undefined,
  rateType: "daily",
  // Empty so the pricing screen prefills location-aware suggestions
  // (utils/priceSuggestions.ts) instead of one-size-fits-all numbers; the
  // screen writes its values back into the draft on mount.
  pricePerDay: "",
  pricePerHour: "",
  pricePerMonth: "",
  photos: [],
  capacity: 1,
  description: "",
  listingTitle: "",
};

type Props = NativeStackScreenProps<RootStackParamList, "CreateListingFlow">;

export function ListingFlowScreen({ route }: Props) {
  const listingId = route.params?.listingId ?? null;
  const e2eState = getMobileE2EState();
  const e2eDraft = !listingId && isMobileE2EActive() ? e2eState?.draft ?? null : null;
  const e2eInitialRoute = !listingId && isMobileE2EActive() ? e2eState?.flowInitialRoute ?? null : null;
  const { token } = useAuth();
  const [draft, setDraft] = useState<ListingDraft>(e2eDraft ?? defaultDraft);
  const [restoredSavedDraft, setRestoredSavedDraft] = useState(false);
  const [savedDraftUpdatedAt, setSavedDraftUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!listingId);
  const [error, setError] = useState<string | null>(null);

  const discardSavedDraft = useCallback(() => {
    setDraft(defaultDraft);
    setRestoredSavedDraft(false);
    setSavedDraftUpdatedAt(null);
    void clearHostListingDraft();
  }, []);

  const value = useMemo(
    () => ({
      draft,
      setDraft,
      listingId,
      savedDraftUpdatedAt,
      discardSavedDraft,
    }),
    [draft, listingId, savedDraftUpdatedAt, discardSavedDraft]
  );

  useEffect(() => {
    if (!listingId) {
      let active = true;
      const restore = async () => {
        if (e2eDraft) {
          if (!active) return;
          setDraft(e2eDraft);
          setRestoredSavedDraft(false);
          setLoading(false);
          setError(null);
          return;
        }
        const savedDraft = await loadHostListingDraft();
        if (!active) return;
        if (savedDraft?.draft) {
          setDraft(savedDraft.draft);
          setRestoredSavedDraft(true);
          setSavedDraftUpdatedAt(savedDraft.updatedAt ?? null);
        } else {
          setRestoredSavedDraft(false);
          setSavedDraftUpdatedAt(null);
        }
        setLoading(false);
        setError(null);
      };
      void restore();
      return () => {
        active = false;
      };
    }
    let active = true;
    const weekdayMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        // With the token: this is the host editing their own space, and the
        // access code comes back redacted for anyone who can't prove that.
        const listing = await getListing(listingId, token ? { token } : undefined);
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
          vehicleSize:
            listing.vehicle_size_suitability ??
            (listing as { vehicleSizeSuitability?: string | null }).vehicleSizeSuitability ??
            prev.vehicleSize,
          accessOptions: listing.amenities ?? [],
          accessCode:
            (listing as { access_code?: string; accessCode?: string }).access_code ??
            (listing as { access_code?: string; accessCode?: string }).accessCode ??
            "",
          arrivalInstructions:
            (listing as { arrival_instructions?: string; arrivalInstructions?: string })
              .arrival_instructions ??
            (listing as { arrival_instructions?: string; arrivalInstructions?: string })
              .arrivalInstructions ??
            "",
          requiresArrivalInstructions: Boolean(
            (
              (listing as { arrival_instructions?: string; arrivalInstructions?: string })
                .arrival_instructions ??
              (listing as { arrival_instructions?: string; arrivalInstructions?: string })
                .arrivalInstructions ??
              ""
            ).trim()
          ),
          requiresAccessCode: Boolean(
            (
              (listing as { access_code?: string; accessCode?: string }).access_code ??
              (listing as { access_code?: string; accessCode?: string }).accessCode ??
              ""
            ).trim()
          ),
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
          pricingMode:
            (listing as { price_per_month?: number | null }).price_per_month != null &&
            (listing.price_per_day != null || listing.price_per_hour != null)
              ? "both"
              : (listing as { price_per_month?: number | null }).price_per_month != null
                ? "monthly"
                : "hourly_daily",
          rateType:
            (listing.rate_type ?? "daily") === "hourly" ? "hourly" : "daily",
          pricePerDay:
            listing.price_per_day != null ? String(listing.price_per_day) : prev.pricePerDay,
          pricePerHour:
            listing.price_per_hour != null ? String(listing.price_per_hour) : prev.pricePerHour,
          pricePerMonth:
            (listing as { price_per_month?: number | null }).price_per_month != null
              ? String((listing as { price_per_month?: number | null }).price_per_month)
              : prev.pricePerMonth,
          photos: listing.image_urls ?? prev.photos,
          capacity: (listing as { capacity?: number | null }).capacity ?? 1,
          description: listing.description?.trim() ?? "",
          listingTitle: listing.title ?? "",
        }));
        if (token) {
          try {
            const availability = await listAvailability({ token, listingId });
            if (!availability.length) return;
            const openEntry =
              availability.find((entry) => entry.kind === "open") ?? availability[0];
            const hasRepeat =
              Array.isArray(openEntry.repeatWeekdays) && openEntry.repeatWeekdays.length > 0;
            const isDaily = hasRepeat && (openEntry.repeatWeekdays?.length ?? 0) === 7;
            const mode = isDaily ? "daily" : hasRepeat ? "recurring" : "dates";
            const weekdaysFromEntries = Array.from(
              new Set(
                availability
                  .filter((entry) => entry.kind === "open")
                  .flatMap((entry) => entry.repeatWeekdays ?? [])
                  .map((idx) => weekdayMap[idx] ?? "Mon")
              )
            );
            const dayTimeRanges: Record<string, { start: string; end: string }> = {};
            availability.forEach((entry) => {
              if (entry.kind !== "open") return;
              if (!Array.isArray(entry.repeatWeekdays) || !entry.repeatWeekdays.length) return;
              const start = new Date(entry.startsAt);
              const end = new Date(entry.endsAt);
              entry.repeatWeekdays.forEach((idx) => {
                const day = weekdayMap[idx] ?? "Mon";
                const dayBase = new Date();
                const startForDay = new Date(dayBase);
                startForDay.setHours(start.getHours(), start.getMinutes(), 0, 0);
                const endForDay = new Date(dayBase);
                endForDay.setHours(end.getHours(), end.getMinutes(), 0, 0);
                dayTimeRanges[day] = {
                  start: startForDay.toISOString(),
                  end: endForDay.toISOString(),
                };
              });
            });
            setDraft((prev) => ({
              ...prev,
              availability: {
                ...prev.availability,
                mode,
                timeStart: openEntry.startsAt,
                timeEnd: openEntry.endsAt,
                dateStart: openEntry.startsAt,
                dateEnd: openEntry.endsAt,
                weekdays: weekdaysFromEntries.length ? weekdaysFromEntries : prev.availability.weekdays,
                dayTimeRanges: Object.keys(dayTimeRanges).length
                  ? dayTimeRanges
                  : prev.availability.dayTimeRanges ?? {},
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
  }, [e2eDraft, listingId, token]);

  return (
    <ListingFlowContext.Provider value={value}>
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.text} />
          <Text style={styles.loadingText}>Loading listing…</Text>
        </View>
      ) : error ? (
        <View style={styles.loading}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <Stack.Navigator
          screenOptions={{ headerShown: false }}
          initialRouteName={
            listingId
              ? "ListingReview"
              : e2eInitialRoute ?? (restoredSavedDraft ? "ListingLocation" : "ListingIntro")
          }
        >
          <Stack.Screen name="ListingIntro" component={ListingIntroScreen} />
          <Stack.Screen name="ListingLocation" component={ListingLocationScreen} />
          <Stack.Screen name="ListingStreetView" component={ListingStreetViewScreen} />
          <Stack.Screen name="ListingDetails" component={ListingDetailsScreen} />
          <Stack.Screen name="ListingFeatures" component={ListingFeaturesScreen} />
          <Stack.Screen name="ListingAccess" component={ListingAccessScreen} />
          <Stack.Screen name="ListingAvailability" component={ListingAvailabilityScreen} />
          <Stack.Screen name="ListingPhotos" component={ListingPhotosScreen} />
          <Stack.Screen name="ListingPrice" component={ListingPriceScreen} />
          {/* Edit mode opens straight to Review, so a swipe/gesture back would exit
              the flow and silently discard edits — disable the gesture there; the
              header X (and Android hardware back) route through the exit confirm. */}
          <Stack.Screen
            name="ListingReview"
            component={ListingReviewScreen}
            options={{ gestureEnabled: !listingId }}
          />
        </Stack.Navigator>
      )}
    </ListingFlowContext.Provider>
  );
}

const styles = StyleSheet.create({
  loading: {
    alignItems: "center",
    backgroundColor: colors.appBg,
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 14,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "600",
    marginTop: 12,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "600",
    textAlign: "center",
  },
});
