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
import { cardShadow, colors, radius, spacing, textStyles } from "../../styles/theme";

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
          accessCode: draft.accessCode.trim() || null,
          permissionDeclared: draft.permissionDeclared,
        });
      }
      setPublished(true);
      setTimeout(() => {
        (rootNavigation as { dispatch: (action: ReturnType<typeof CommonActions.reset>) => void })
          ?.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: "Listings" as keyof RootStackParamList }],
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
        <Text style={styles.kicker}>
          {listingId ? "Review & update" : "Review & publish"}
        </Text>
        <StepProgress current={7} total={7} />
        <Text style={styles.title}>Double-check your details</Text>
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
  kicker: textStyles.kicker,
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "600",
    marginTop: 6,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 6,
  },
  error: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
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
    borderColor: "#cbd5f5",
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
    backgroundColor: "#cbd5e1",
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
