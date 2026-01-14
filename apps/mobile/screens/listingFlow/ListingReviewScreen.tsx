import { CommonActions } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import LottieView from "lottie-react-native";
import {
  createAvailabilityEntry,
  createListing,
  deleteAvailabilityEntry,
  listAvailability,
  updateListing,
} from "../../api";
import { useAuth } from "../../auth";
import { MapPin } from "../../components/MapPin";
import { LIGHT_MAP_STYLE } from "../../components/mapStyles";
import type { RootStackParamList } from "../../types";
import { useListingFlow } from "./context";
import { StepProgress } from "./StepProgress";

type FlowStackParamList = {
  ListingReview: undefined;
  ListingLocation: undefined;
  ListingStreetView: undefined;
  ListingDetails: undefined;
  ListingAvailability: undefined;
  ListingPrice: undefined;
  ListingPhotos: undefined;
};

type Props = NativeStackScreenProps<FlowStackParamList, "ListingReview">;

export function ListingReviewScreen({ navigation }: Props) {
  const { draft, listingId } = useListingFlow();
  const { token } = useAuth();
  const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const [submitting, setSubmitting] = useState(false);
  const [published, setPublished] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootNavigation = navigation.getParent();
  const canPublish =
    draft.spaceType.trim().length > 0 &&
    draft.pricePerDay.trim().length > 0 &&
    draft.location.address.trim().length > 0 &&
    draft.permissionDeclared;

  const buildAvailabilityPayload = () => {
    const weekdayIndex: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    const mode = draft.availability.mode;
    const timeStart = new Date(draft.availability.timeStart);
    const timeEnd = new Date(draft.availability.timeEnd);
    const withTime = (date: Date, time: Date) => {
      const next = new Date(date);
      next.setHours(time.getHours(), time.getMinutes(), 0, 0);
      return next;
    };
    const baseDate = new Date();
    if (mode === "daily") {
      const startsAt = withTime(baseDate, timeStart);
      const endsAt = withTime(baseDate, timeEnd);
      if (endsAt <= startsAt) endsAt.setDate(endsAt.getDate() + 1);
      return {
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        repeatWeekdays: [0, 1, 2, 3, 4, 5, 6],
        repeatUntil: null,
      };
    }
    if (mode === "recurring") {
      const repeatWeekdays = draft.availability.weekdays
        .map((day) => weekdayIndex[day])
        .filter((value) => typeof value === "number");
      if (!repeatWeekdays.length) return null;
      const startsAt = withTime(baseDate, timeStart);
      const endsAt = withTime(baseDate, timeEnd);
      if (endsAt <= startsAt) endsAt.setDate(endsAt.getDate() + 1);
      return {
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        repeatWeekdays,
        repeatUntil: null,
      };
    }
    const dateStart = new Date(draft.availability.dateStart);
    const dateEnd = new Date(draft.availability.dateEnd);
    const startsAt = withTime(dateStart, timeStart);
    const endsAt = withTime(dateEnd, timeEnd);
    if (endsAt <= startsAt) endsAt.setDate(endsAt.getDate() + 1);
    return {
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      repeatWeekdays: null,
      repeatUntil: null,
    };
  };

  const syncAvailability = async (targetListingId: string) => {
    if (!token) return;
    const existing = await listAvailability({ token, listingId: targetListingId });
    await Promise.all(
      existing.map((entry) =>
        deleteAvailabilityEntry({ token, availabilityId: entry.id })
      )
    );
    const payload = buildAvailabilityPayload();
    if (!payload) return;
    await createAvailabilityEntry({
      token,
      listingId: targetListingId,
      kind: "open",
      startsAt: payload.startsAt,
      endsAt: payload.endsAt,
      repeatWeekdays: payload.repeatWeekdays,
      repeatUntil: payload.repeatUntil,
    });
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (!published) return;
      const actionType = event.data.action.type;
      if (actionType === "GO_BACK" || actionType === "POP") {
        event.preventDefault();
      }
    });
    return unsubscribe;
  }, [navigation, published]);

  const handlePublish = async () => {
    if (!token) {
      setError(listingId ? "Sign in to update your space." : "Sign in to publish your space.");
      return;
    }
    if (!draft.spaceType || !draft.pricePerDay || !draft.permissionDeclared) {
      setError("Complete the required steps first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const coverUrl =
        draft.coverHeading != null && mapsKey
          ? `https://maps.googleapis.com/maps/api/streetview?size=1280x720&location=${draft.location.latitude},${draft.location.longitude}&heading=${draft.coverHeading}&pitch=${draft.coverPitch ?? 0}&fov=80&key=${mapsKey}`
          : null;
      const imageUrls = [
        ...(coverUrl ? [coverUrl] : []),
        ...draft.photos.filter(Boolean),
      ];
      if (listingId) {
        await updateListing({
          token,
          listingId,
          title: draft.spaceType
            ? `${draft.spaceType} parking`
            : "Parking space",
          address: draft.location.address || "Dublin",
          pricePerDay: Number.parseFloat(draft.pricePerDay),
          availabilityText: draft.availability.detail,
          latitude: draft.location.latitude,
          longitude: draft.location.longitude,
          imageUrls,
          amenities: draft.accessOptions,
          accessCode: draft.accessCode.trim() || null,
          permissionDeclared: draft.permissionDeclared,
        });
        await syncAvailability(listingId);
      } else {
        const newListingId = await createListing({
          token,
          title: draft.spaceType
            ? `${draft.spaceType} parking`
            : "Parking space",
          address: draft.location.address || "Dublin",
          pricePerDay: Number.parseFloat(draft.pricePerDay),
          availabilityText: draft.availability.detail,
          latitude: draft.location.latitude,
          longitude: draft.location.longitude,
          imageUrls,
          amenities: draft.accessOptions,
          accessCode: draft.accessCode.trim() || null,
          permissionDeclared: draft.permissionDeclared,
        });
        await syncAvailability(newListingId);
      }
      setPublished(true);
      setShowSuccess(true);
      setTimeout(() => {
        (rootNavigation as { dispatch: (action: ReturnType<typeof CommonActions.reset>) => void })
          ?.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: "Listings" as keyof RootStackParamList }],
            })
          );
      }, 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish");
      setPublished(false);
      setShowSuccess(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="never">
        <Text style={styles.kicker}>
          {listingId ? "Review & update" : "Review & publish"}
        </Text>
        <StepProgress current={7} total={7} />
        <Text style={styles.title}>Double‑check your details</Text>
        <Text style={styles.subtitle}>
          {listingId ? "Confirm everything looks right." : "You can edit anything after publishing."}
        </Text>

        <Pressable
          style={[
            styles.confirmRow,
            draft.permissionDeclared && styles.confirmRowActive,
          ]}
          onPress={() =>
            setDraft((prev) => ({
              ...prev,
              permissionDeclared: !prev.permissionDeclared,
            }))
          }
        >
          <View
            style={[
              styles.confirmBox,
              draft.permissionDeclared && styles.confirmBoxActive,
            ]}
          >
            {draft.permissionDeclared ? <Text style={styles.confirmCheck}>✓</Text> : null}
          </View>
          <View style={styles.confirmTextWrap}>
            <Text style={styles.confirmTitle}>I have permission to rent this space</Text>
            <Text style={styles.confirmSubtitle}>
              You confirm you own this space or have the owner’s consent to list it.
            </Text>
          </View>
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.card}>
          <View style={styles.mapPreview}>
            <MapView
              style={styles.map}
              provider={PROVIDER_GOOGLE}
              customMapStyle={LIGHT_MAP_STYLE}
              initialRegion={{
                latitude: draft.location.latitude,
                longitude: draft.location.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
            >
              <Marker
                coordinate={{
                  latitude: draft.location.latitude,
                  longitude: draft.location.longitude,
                }}
                anchor={{ x: 0.5, y: 1 }}
                centerOffset={{ x: 0, y: -6 }}
              >
                <MapPin />
              </Marker>
            </MapView>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Space type</Text>
            <Text style={styles.value}>{draft.spaceType || "Not set"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Availability</Text>
            <Text style={styles.value}>{draft.availability.detail || "Not set"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Price</Text>
            <Text style={styles.value}>€{draft.pricePerDay || "0"}</Text>
          </View>
        </View>
        <View style={styles.editCard}>
          <Text style={styles.editTitle}>Edit a section</Text>
          <Pressable
            style={styles.editRow}
            onPress={() => navigation.navigate("ListingLocation")}
          >
            <Text style={styles.editLabel}>Location</Text>
            <Text style={styles.editChevron}>›</Text>
          </Pressable>
          <Pressable
            style={styles.editRow}
            onPress={() => navigation.navigate("ListingStreetView")}
          >
            <Text style={styles.editLabel}>Street view</Text>
            <Text style={styles.editChevron}>›</Text>
          </Pressable>
          <Pressable
            style={styles.editRow}
            onPress={() => navigation.navigate("ListingDetails")}
          >
            <Text style={styles.editLabel}>Space details</Text>
            <Text style={styles.editChevron}>›</Text>
          </Pressable>
          <Pressable
            style={styles.editRow}
            onPress={() => navigation.navigate("ListingAvailability")}
          >
            <Text style={styles.editLabel}>Availability</Text>
            <Text style={styles.editChevron}>›</Text>
          </Pressable>
          <Pressable style={styles.editRow} onPress={() => navigation.navigate("ListingPrice")}>
            <Text style={styles.editLabel}>Price</Text>
            <Text style={styles.editChevron}>›</Text>
          </Pressable>
          <Pressable
            style={[styles.editRow, styles.editRowLast]}
            onPress={() => navigation.navigate("ListingPhotos")}
          >
            <Text style={styles.editLabel}>Photos</Text>
            <Text style={styles.editChevron}>›</Text>
          </Pressable>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Pressable
          style={[
            styles.primaryButton,
            (!canPublish || submitting || published) && styles.primaryButtonDisabled,
          ]}
          onPress={handlePublish}
          disabled={!canPublish || submitting || published}
        >
          <Text style={styles.primaryButtonText}>
            {submitting ? "Saving..." : listingId ? "Update listing" : "Publish space"}
          </Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => navigation.goBack()}
          disabled={submitting || published}
        >
          <Text style={styles.secondaryButtonText}>Save and finish later</Text>
        </Pressable>
      </View>
      {showSuccess ? (
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <LottieView
              source={require("../../assets/successfully.json")}
              autoPlay
              loop={false}
              style={styles.successAnimation}
            />
            <Text style={styles.successTitle}>Published</Text>
            <Text style={styles.successBody}>Your space is now live.</Text>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f7fb",
  },
  content: {
    padding: 18,
    paddingBottom: 160,
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
  error: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderRadius: 12,
    borderWidth: 1,
    color: "#b42318",
    fontSize: 12,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#e5e7eb",
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 16,
    overflow: "hidden",
  },
  editCard: {
    backgroundColor: "#ffffff",
    borderColor: "#e5e7eb",
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 16,
    overflow: "hidden",
  },
  editTitle: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "700",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  editRow: {
    alignItems: "center",
    borderTopColor: "#e5e7eb",
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  editRowLast: {
    borderBottomWidth: 0,
  },
  editLabel: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "600",
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  editChevron: {
    color: "#94a3b8",
    fontSize: 18,
    fontWeight: "700",
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  mapPreview: {
    height: 160,
  },
  map: {
    flex: 1,
  },
  row: {
    borderTopColor: "#e5e7eb",
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  confirmRow: {
    backgroundColor: "#ffffff",
    borderColor: "#e5e7eb",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
    padding: 14,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 1,
  },
  confirmRowActive: {
    borderColor: "#00d4aa",
  },
  confirmBox: {
    alignItems: "center",
    borderColor: "#cbd5f5",
    borderRadius: 8,
    borderWidth: 1,
    height: 22,
    justifyContent: "center",
    marginTop: 2,
    width: 22,
  },
  confirmBoxActive: {
    backgroundColor: "#00d4aa",
    borderColor: "#00d4aa",
  },
  confirmCheck: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  confirmTextWrap: {
    flex: 1,
  },
  confirmTitle: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "700",
  },
  confirmSubtitle: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 4,
  },
  label: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  value: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 6,
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  footer: {
    backgroundColor: "#ffffff",
    borderTopColor: "#e5e7eb",
    borderTopWidth: 1,
    padding: 16,
  },
  successOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.35)",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  successCard: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 20,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 6,
    width: 240,
  },
  successAnimation: {
    height: 140,
    width: 140,
  },
  successTitle: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 6,
  },
  successBody: {
    color: "#6b7280",
    fontSize: 13,
    marginTop: 4,
    textAlign: "center",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#00d4aa",
    borderRadius: 14,
    paddingVertical: 14,
  },
  primaryButtonDisabled: {
    backgroundColor: "#cbd5e1",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryButton: {
    alignItems: "center",
    borderRadius: 14,
    marginTop: 10,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "600",
  },
});
