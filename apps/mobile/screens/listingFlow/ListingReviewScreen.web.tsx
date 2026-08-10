import { CommonActions } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { createListing, updateListing } from "../../api";
import { useAuth } from "../../auth";
import type { RootStackParamList } from "../../types";
import { useListingFlow } from "./context";
import { StepProgress } from "./StepProgress";
import { cardShadow, colors, radius, spacing } from "../../styles/theme";
import { buildStreetViewImageUrl } from "../../utils/streetView";

type FlowStackParamList = {
  ListingReview: undefined;
};

type Props = NativeStackScreenProps<FlowStackParamList, "ListingReview">;

export function ListingReviewScreen({ navigation }: Props) {
  const { draft, listingId, setDraft } = useListingFlow();
  const { token } = useAuth();
  const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const [submitting, setSubmitting] = useState(false);
  const [published, setPublished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootNavigation = navigation.getParent();
  const requiresShortStay =
    draft.pricingMode === "hourly_daily" || draft.pricingMode === "both";
  const requiresMonthly = draft.pricingMode === "monthly" || draft.pricingMode === "both";
  const canPublish =
    draft.pricingMode != null &&
    draft.spaceType.trim().length > 0 &&
    (!requiresShortStay || (draft.pricePerHour.trim().length > 0 && draft.pricePerDay.trim().length > 0)) &&
    (!requiresMonthly || draft.pricePerMonth.trim().length > 0) &&
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
    const hasHourlyPrice = draft.pricePerHour.trim().length > 0;
    const hasDailyPrice = draft.pricePerDay.trim().length > 0;
    const hasMonthlyPrice = draft.pricePerMonth.trim().length > 0;
    if (
      !draft.spaceType ||
      !draft.permissionDeclared ||
      (requiresShortStay && (!hasHourlyPrice || !hasDailyPrice)) ||
      (requiresMonthly && !hasMonthlyPrice)
    ) {
      setError("Complete the required steps first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const coverUrl = buildStreetViewImageUrl({
        coverPanoId: draft.coverPanoId,
        coverHeading: draft.coverHeading,
        coverPitch: draft.coverPitch,
        latitude: draft.location.latitude,
        longitude: draft.location.longitude,
        mapsKey,
      });
      const imageUrls = [
        ...(coverUrl ? [coverUrl] : []),
        ...draft.photos.filter(Boolean),
      ];
      const parsedHourly = Number.parseFloat(draft.pricePerHour);
      const parsedDaily = Number.parseFloat(draft.pricePerDay);
      const parsedMonthly = Number.parseFloat(draft.pricePerMonth);
      const inferredRateType =
        requiresShortStay && Number.isFinite(parsedHourly) && parsedHourly > 0 ? "hourly" : "daily";
      if (listingId) {
        await updateListing({
          token,
          listingId,
          title: draft.spaceType
            ? `${draft.spaceType} parking`
            : "Parking space",
          address: draft.location.address || "Dublin",
          rateType: inferredRateType,
          pricePerDay: parsedDaily,
          pricePerHour: requiresShortStay ? parsedHourly : null,
          pricePerMonth: requiresMonthly ? parsedMonthly : null,
          availabilityText: draft.availability.detail,
          imageUrls,
          amenities: draft.accessOptions,
          accessCode: draft.accessCode.trim() || null,
          arrivalInstructions: draft.arrivalInstructions.trim() || null,
          permissionDeclared: draft.permissionDeclared,
          capacity: draft.capacity,
        });
      } else {
        await createListing({
          token,
          title: draft.spaceType
            ? `${draft.spaceType} parking`
            : "Parking space",
          address: draft.location.address || "Dublin",
          rateType: inferredRateType,
          pricePerDay: parsedDaily,
          pricePerHour: requiresShortStay ? parsedHourly : null,
          pricePerMonth: requiresMonthly ? parsedMonthly : null,
          availabilityText: draft.availability.detail,
          latitude: draft.location.latitude,
          longitude: draft.location.longitude,
          imageUrls,
          amenities: draft.accessOptions,
          accessCode: draft.accessCode.trim() || null,
          arrivalInstructions: draft.arrivalInstructions.trim() || null,
          permissionDeclared: draft.permissionDeclared,
          capacity: draft.capacity,
        });
      }
      setPublished(true);
      setTimeout(() => {
        (rootNavigation as { dispatch: (action: ReturnType<typeof CommonActions.reset>) => void })
          ?.dispatch(
            // Land on the Spaces segment so the host sees the listing they
            // just published, not the (likely empty) host-bookings tab.
            CommonActions.reset({
              index: 0,
              routes: [{ name: "Listings" as keyof RootStackParamList, params: { initialTab: "spaces" } }],
            })
          );
      }, 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish");
      setPublished(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Same ask and same words as the native step. The kicker went with
            the rebuild — no step in the flow opens with one — and the title
            now matches so the two targets don't name the screen differently. */}
        <StepProgress current={9} total={9} />
        <Text style={styles.title}>
          {listingId ? "Review your changes" : "Here's your listing"}
        </Text>
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
            <View style={styles.mapPlaceholder}>
              <Text style={styles.mapPlaceholderText}>Map preview is available on device.</Text>
            </View>
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
            <Text style={styles.value}>
              {requiresShortStay && requiresMonthly
                ? `€${draft.pricePerHour}/hr · €${draft.pricePerDay}/day · €${draft.pricePerMonth}/month`
                : requiresMonthly
                  ? `€${draft.pricePerMonth || "0"}/month`
                  : `€${draft.pricePerHour}/hr · €${draft.pricePerDay}/day`}
            </Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.appBg,
  },
  content: {
    padding: spacing.screenX,
    paddingBottom: 160,
  },
  title: {
    color: colors.text,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 26,
    lineHeight: 31,
    letterSpacing: -0.3,
    marginTop: 6,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 6,
  },
  error: {
    backgroundColor: colors.status.canceled.background,
    borderColor: colors.status.canceled.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.danger,
    fontSize: 12,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    marginTop: 16,
    overflow: "hidden",
  },
  mapPreview: {
    height: 160,
  },
  mapPlaceholder: {
    alignItems: "center",
    backgroundColor: colors.appBg,
    flex: 1,
    justifyContent: "center",
  },
  mapPlaceholderText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  row: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  confirmRow: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
    padding: 14,
    ...cardShadow,
  },
  confirmRowActive: {
    borderColor: colors.accent,
  },
  confirmBox: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 22,
    justifyContent: "center",
    marginTop: 2,
    width: 22,
  },
  confirmBoxActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  confirmCheck: {
    color: colors.cardBg,
    fontSize: 14,
    fontWeight: "600",
  },
  confirmTextWrap: {
    flex: 1,
  },
  confirmTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  confirmSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  value: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    marginTop: 6,
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
    backgroundColor: colors.border,
  },
  primaryButtonText: {
    color: colors.cardBg,
    fontSize: 15,
    fontWeight: "600",
  },
  secondaryButton: {
    alignItems: "center",
    borderRadius: 14,
    marginTop: 10,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
});
