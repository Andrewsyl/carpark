import { CommonActions } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker } from "react-native-maps";
import LottieView from "lottie-react-native";
import { createListing, updateListing } from "../../api";
import { useAuth } from "../../auth";
import { MapPin } from "../../components/MapPin";
import type { RootStackParamList } from "../../types";
import { useListingFlow } from "./context";
import { StepProgress } from "./StepProgress";

type FlowStackParamList = {
  ListingReview: undefined;
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
    draft.location.address.trim().length > 0;

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
    if (!draft.spaceType || !draft.pricePerDay) {
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
        });
      } else {
        await createListing({
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
        });
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
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>
          {listingId ? "Review & update" : "Review & publish"}
        </Text>
        <StepProgress current={7} total={7} />
        <Text style={styles.title}>Double‑check your details</Text>
        <Text style={styles.subtitle}>
          {listingId ? "Confirm everything looks right." : "You can edit anything after publishing."}
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.card}>
          <View style={styles.mapPreview}>
            <MapView
              style={styles.map}
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
    backgroundColor: "#f8fafc",
  },
  content: {
    padding: 18,
    paddingBottom: 160,
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
    borderColor: "#e2e8f0",
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 16,
    overflow: "hidden",
  },
  mapPreview: {
    height: 160,
  },
  map: {
    flex: 1,
  },
  row: {
    borderTopColor: "#e2e8f0",
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  label: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  value: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 6,
  },
  footer: {
    backgroundColor: "#f8fafc",
    borderTopColor: "#e2e8f0",
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
    color: "#475569",
    fontSize: 13,
    marginTop: 4,
    textAlign: "center",
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
  secondaryButton: {
    alignItems: "center",
    borderRadius: 14,
    marginTop: 10,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "600",
  },
});
