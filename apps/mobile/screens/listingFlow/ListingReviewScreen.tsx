import { CommonActions } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { PhoneVerifyModal } from "../../components/PhoneVerifyModal";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import LottieView from "lottie-react-native";
import {
  Check,
  MapPin,
  Clock,
  Euro,
  House,
  Camera,
  KeyRound,
  ListChecks,
} from "lucide-react-native";
import {
  createAvailabilityEntry,
  createListing,
  deleteAvailabilityEntry,
  listAvailability,
  updateListing,
} from "../../api";
import { trackEvent } from "../../analytics";
import { useAuth } from "../../auth";
import type { RootStackParamList } from "../../types";
import { useListingFlow } from "./context";
import { generateListingDescription } from "./generateDescription";
import { FlowHeader } from "./FlowHeader";
import { StepQuestion, StepSection } from "./StepQuestion";
import { colors, spacing } from "../../styles/theme";
import { hostFlowColors } from "./hostFlowTheme";
import { clearHostListingDraft, saveHostListingDraft } from "./draftStorage";
import { useGlobalToast } from "../../components/GlobalToast";
import { useExitListingFlowConfirm } from "./confirmExit";
import { buildStreetViewImageUrl } from "../../utils/streetView";

type FlowStackParamList = {
  ListingReview: undefined;
  ListingLocation: { fromReview?: boolean } | undefined;
  ListingStreetView: undefined;
  ListingDetails: { fromReview?: boolean } | undefined;
  ListingFeatures: { fromReview?: boolean } | undefined;
  ListingAccess: { fromReview?: boolean } | undefined;
  ListingAvailability: { fromReview?: boolean } | undefined;
  ListingPrice: { fromReview?: boolean } | undefined;
  ListingPhotos: { fromReview?: boolean } | undefined;
};

type Props = NativeStackScreenProps<FlowStackParamList, "ListingReview">;

// Require hosts to verify their phone before a listing goes live. Keep this OFF
// until AWS grants SMS production access (out of the SNS sandbox) — while in the
// sandbox only pre-verified numbers can receive codes, so enforcing it would
// block every host from publishing. Flip to true once the sandbox exit is approved.
const PHONE_VERIFICATION_REQUIRED = false;

const ACCENT = hostFlowColors.accent;
const FG = hostFlowColors.text;
const MUTED = hostFlowColors.textMuted;
const SOFT = hostFlowColors.textSoft;
const BORDER = hostFlowColors.border;
const CARD = hostFlowColors.cardBg;

type RowStatus = "ok" | "warn";

export function ListingReviewScreen({ navigation }: Props) {
  const { draft, setDraft, listingId } = useListingFlow();
  const { token, user, setAuthUser } = useAuth();
  // Aliased: this component already has a boolean `showSuccess` state for the
  // success overlay, so the toast helper is bound under a distinct name.
  const { showSuccess: showSuccessToast } = useGlobalToast();
  // If createListing succeeded but a later step (availability sync) failed, remember the id so
  // a retry updates that listing instead of creating a duplicate.
  const createdListingIdRef = useRef<string | null>(null);
  const { presentExitConfirm, exitConfirmModal } = useExitListingFlowConfirm();
  const insets = useSafeAreaInsets();
  const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const [submitting, setSubmitting] = useState(false);
  const [published, setPublished] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showPhoneVerify, setShowPhoneVerify] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingDescription, setEditingDescription] = useState(false);
  const rootNavigation = navigation.getParent();
  const requiresShortStay =
    draft.pricingMode === "hourly_daily" || draft.pricingMode === "both";
  const requiresMonthly = draft.pricingMode === "monthly" || draft.pricingMode === "both";
  const canPublish =
    draft.pricingMode != null &&
    draft.spaceType.trim().length > 0 &&
    (!requiresShortStay || (draft.pricePerHour.trim().length > 0 && draft.pricePerDay.trim().length > 0)) &&
    (!requiresMonthly || draft.pricePerMonth.trim().length > 0) &&
    draft.location.address.trim().length > 0 &&
    draft.permissionDeclared;

  const priceLabel = (() => {
    if (requiresShortStay && requiresMonthly)
      return `€${draft.pricePerHour}/hr · €${draft.pricePerDay}/day · €${draft.pricePerMonth}/month`;
    if (requiresMonthly)
      return `€${draft.pricePerMonth || "0"}/month`;
    if (draft.pricePerHour.trim().length > 0 && draft.pricePerDay.trim().length > 0)
      return `€${draft.pricePerHour}/hr · €${draft.pricePerDay}/day`;
    if (draft.pricePerHour.trim().length > 0)
      return `€${draft.pricePerHour}/hr`;
    return `€${draft.pricePerDay || "0"}/day`;
  })();

  // The exact cover a driver will see: the framed Street View leads (matching
  // publish), otherwise the first uploaded photo.
  const coverPhotoUri = useMemo(() => {
    const { latitude, longitude } = draft.location;
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      const url = buildStreetViewImageUrl({
        coverPanoId: draft.coverPanoId,
        coverHeading: draft.coverHeading,
        coverPitch: draft.coverPitch,
        latitude,
        longitude,
        mapsKey,
      });
      if (url) return url;
    }
    return draft.photos.find((p) => p?.trim()) ?? null;
  }, [draft.coverHeading, draft.coverPitch, draft.coverPanoId, draft.location, draft.photos, mapsKey]);

  // Labels mirror the vehicle options on the Details screen so the fit the host
  // selected (and which is now persisted) is visible on the review summary.
  const VEHICLE_FIT_LABELS: Record<string, string> = {
    small: "Hatchback",
    medium: "Saloon",
    large: "SUV / Jeep",
    van: "Van",
  };
  const spaceTypeValue = (() => {
    if (!draft.spaceType) return "Not set";
    const parts = [draft.spaceType];
    if (draft.capacity > 1) parts.push(`${draft.capacity} spaces`);
    const fit = VEHICLE_FIT_LABELS[draft.vehicleSize];
    if (fit) parts.push(`Fits ${fit}`);
    return parts.join(" · ");
  })();

  const accessSummary = (() => {
    if (draft.requiresAccessCode === false) return "Open access";
    // Restricted can now carry a code method (Key XOR Pin) and/or Special
    // instructions, so surface every selected method, not just the first.
    const parts: string[] = [];
    if (draft.accessOptions.includes("Pin code")) {
      parts.push(draft.accessCode.trim() ? `Pin code · ${draft.accessCode.trim()}` : "Pin code");
    } else if (draft.accessOptions.includes("Key or security fob")) {
      parts.push(
        draft.accessCode.trim()
          ? `Key collection · ${draft.accessCode.trim()}`
          : "Key or security fob"
      );
    }
    if (draft.accessOptions.includes("Special instructions")) {
      parts.push(
        draft.arrivalInstructions.trim()
          ? `Arrival instructions · ${draft.arrivalInstructions.trim()}`
          : "Special instructions"
      );
    }
    return parts.length ? parts.join("  •  ") : "Open access";
  })();

  const ACCESS_OPTION_VALUES = ["Key or security fob", "Pin code", "Special instructions"];
  const featureSummary = (() => {
    const features = draft.accessOptions.filter((o) => !ACCESS_OPTION_VALUES.includes(o));
    return features.length ? features.join(", ") : "None selected";
  })();

  const pricingOk: RowStatus =
    (!requiresShortStay || (draft.pricePerHour.trim().length > 0 && draft.pricePerDay.trim().length > 0)) &&
    (!requiresMonthly || draft.pricePerMonth.trim().length > 0)
      ? "ok"
      : "warn";

  // Tell the host exactly what's blocking publish. The permission checkbox is the
  // usual culprit and lives inside the scrollable panel, so surfacing it on the
  // fixed footer points them back up rather than leaving a dead button.
  const publishHint = (() => {
    if (canPublish) return null;
    if (!draft.location.address.trim()) return "Add your location to publish";
    if (!draft.spaceType.trim()) return "Add your space details to publish";
    if (pricingOk === "warn") return "Set your pricing to publish";
    if (!draft.permissionDeclared) return "Tick the box above to confirm you can list this space";
    return "Complete the highlighted steps to publish";
  })();

  const buildAvailabilityPayloads = () => {
    const weekdayIndex: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
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
      return [{ startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), repeatWeekdays: [0, 1, 2, 3, 4, 5, 6], repeatUntil: null }];
    }
    if (mode === "recurring") {
      const repeatWeekdays = draft.availability.weekdays
        .map((day) => weekdayIndex[day])
        .filter((value) => typeof value === "number");
      if (!repeatWeekdays.length) return [];
      const dayTimeRanges = draft.availability.dayTimeRanges ?? {};
      return repeatWeekdays.map((weekdayIdx) => {
        const dayCode = Object.entries(weekdayIndex).find(([, idx]) => idx === weekdayIdx)?.[0] ?? "Mon";
        const range = dayTimeRanges[dayCode];
        const startRef = range?.start ? new Date(range.start) : timeStart;
        const endRef = range?.end ? new Date(range.end) : timeEnd;
        const startsAt = withTime(baseDate, startRef);
        const endsAt = withTime(baseDate, endRef);
        if (endsAt <= startsAt) endsAt.setDate(endsAt.getDate() + 1);
        return { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), repeatWeekdays: [weekdayIdx], repeatUntil: null };
      });
    }
    const dateStart = new Date(draft.availability.dateStart);
    const dateEnd = new Date(draft.availability.dateEnd);
    const startsAt = withTime(dateStart, timeStart);
    const endsAt = withTime(dateEnd, timeEnd);
    if (endsAt <= startsAt) endsAt.setDate(endsAt.getDate() + 1);
    return [{ startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), repeatWeekdays: null, repeatUntil: null }];
  };

  const syncAvailability = async (targetListingId: string) => {
    if (!token) return;
    const existing = await listAvailability({ token, listingId: targetListingId });
    await Promise.all(existing.map((entry) => deleteAvailabilityEntry({ token, availabilityId: entry.id })));
    const payloads = buildAvailabilityPayloads();
    if (!payloads.length) return;
    await Promise.all(payloads.map((payload) =>
      createAvailabilityEntry({ token, listingId: targetListingId, kind: "open", startsAt: payload.startsAt, endsAt: payload.endsAt, repeatWeekdays: payload.repeatWeekdays, repeatUntil: payload.repeatUntil })
    ));
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (!published) return;
      const actionType = event.data.action.type;
      if (actionType === "GO_BACK" || actionType === "POP") event.preventDefault();
    });
    return unsubscribe;
  }, [navigation, published]);

  // Pre-fill the title and description the first time the host reaches this
  // screen (only if they haven't written/edited their own). The title default
  // uses the address locality so every listing in a city doesn't publish as an
  // identical "<type> parking".
  useEffect(() => {
    setDraft((prev) => {
      const next = { ...prev };
      if (!prev.description?.trim()) {
        next.description = generateListingDescription(prev);
      }
      if (!prev.listingTitle?.trim()) {
        const spaceType = prev.spaceType || "Parking space";
        const parts = prev.location.address.split(",").map((p) => p.trim()).filter(Boolean);
        const locality = parts.length > 1 ? parts[1] : "";
        next.listingTitle =
          locality && locality.length <= 30 ? `${spaceType} near ${locality}` : `${spaceType} parking`;
      }
      return next;
    });
    // Run once on mount; the host can freely edit afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // What actually publishes — the host's (possibly edited) title, with the old
  // generic fallback only if they blanked it.
  const publishTitle =
    (draft.listingTitle ?? "").trim() ||
    (draft.spaceType ? `${draft.spaceType} parking` : "Parking space");

  const handlePublish = async () => {
    if (!token) {
      setError(listingId ? "Sign in to update your space." : "Sign in to publish your space.");
      return;
    }
    if (user && user.emailVerified === false) {
      await saveHostListingDraft(draft);
      setError(
        "Verify your email to publish — check your inbox for the link. Your listing is saved to Listings in the meantime."
      );
      return;
    }
    const hasHourlyPrice = draft.pricePerHour.trim().length > 0;
    const hasDailyPrice = draft.pricePerDay.trim().length > 0;
    const hasMonthlyPrice = draft.pricePerMonth.trim().length > 0;
    if (!draft.spaceType || !draft.permissionDeclared || (requiresShortStay && (!hasHourlyPrice || !hasDailyPrice)) || (requiresMonthly && !hasMonthlyPrice)) {
      setError("Complete the required steps first.");
      return;
    }
    // Hosts must have a verified phone before a listing goes live, since drivers
    // may call them if they can't find the space. Verified once, never re-asked.
    // Gated behind a flag so we don't block publishing while SMS is still in the
    // SNS sandbox (see PHONE_VERIFICATION_REQUIRED above).
    if (PHONE_VERIFICATION_REQUIRED && !user?.phoneVerified) {
      setError(null);
      setShowPhoneVerify(true);
      return;
    }
    await doPublish();
  };

  const doPublish = async () => {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      void trackEvent("mobile_host_publish_started", { pricingMode: draft.pricingMode, hasPhotos: draft.photos.length > 0 });
      const coverUrl = buildStreetViewImageUrl({
        coverPanoId: draft.coverPanoId,
        coverHeading: draft.coverHeading,
        coverPitch: draft.coverPitch,
        latitude: draft.location.latitude,
        longitude: draft.location.longitude,
        mapsKey,
      });
      const imageUrls = [...(coverUrl ? [coverUrl] : []), ...draft.photos.filter(Boolean)];
      const parsedHourly = Number.parseFloat(draft.pricePerHour);
      const parsedDaily = Number.parseFloat(draft.pricePerDay);
      const parsedMonthly = Number.parseFloat(draft.pricePerMonth);
      const inferredRateType = requiresShortStay && Number.isFinite(parsedHourly) && parsedHourly > 0 ? "hourly" : "daily";
      // The Features & access screen keeps typed code/instructions even after the
      // host changes their access choice (so switching never loses data), so gate
      // what we publish on the final selection — a buffer left over from a
      // since-changed choice must not reach the live listing.
      const accessSelected = draft.requiresAccessCode === true;
      const wantsCode =
        accessSelected &&
        (draft.accessOptions.includes("Pin code") ||
          draft.accessOptions.includes("Key or security fob"));
      const wantsInstructions =
        accessSelected && draft.accessOptions.includes("Special instructions");
      const publishAccessCode = wantsCode ? draft.accessCode.trim() || null : null;
      const publishArrivalInstructions = wantsInstructions
        ? draft.arrivalInstructions.trim() || null
        : null;
      const effectiveListingId = listingId ?? createdListingIdRef.current;
      if (effectiveListingId) {
        await updateListing({ token, listingId: effectiveListingId, title: publishTitle, address: draft.location.address || "Dublin", rateType: inferredRateType, pricePerDay: parsedDaily, pricePerHour: requiresShortStay ? parsedHourly : null, pricePerMonth: requiresMonthly ? parsedMonthly : null, availabilityText: draft.availability.detail, imageUrls, amenities: draft.accessOptions, accessCode: publishAccessCode, arrivalInstructions: publishArrivalInstructions, permissionDeclared: draft.permissionDeclared, capacity: draft.capacity, description: (draft.description ?? "").trim() || null, vehicleSizeSuitability: draft.vehicleSize.trim() || null });
        await syncAvailability(effectiveListingId);
      } else {
        const newListingId = await createListing({ token, title: publishTitle, address: draft.location.address || "Dublin", rateType: inferredRateType, pricePerDay: parsedDaily, pricePerHour: requiresShortStay ? parsedHourly : null, pricePerMonth: requiresMonthly ? parsedMonthly : null, availabilityText: draft.availability.detail, latitude: draft.location.latitude, longitude: draft.location.longitude, imageUrls, amenities: draft.accessOptions, accessCode: publishAccessCode, arrivalInstructions: publishArrivalInstructions, permissionDeclared: draft.permissionDeclared, capacity: draft.capacity, description: (draft.description ?? "").trim() || null, vehicleSizeSuitability: draft.vehicleSize.trim() || null });
        createdListingIdRef.current = newListingId;
        await syncAvailability(newListingId);
      }
      await clearHostListingDraft();
      setPublished(true);
      setShowSuccess(true);
      void trackEvent("mobile_host_publish_succeeded", { pricingMode: draft.pricingMode, listingId: listingId ?? "new" });
      setTimeout(() => {
        (rootNavigation as { dispatch: (action: ReturnType<typeof CommonActions.reset>) => void })?.dispatch(
          // Land on the Spaces segment so the host sees the listing they just
          // published, not the (likely empty) host-bookings tab.
          CommonActions.reset({
            index: 0,
            routes: [{ name: "Listings" as keyof RootStackParamList, params: { initialTab: "spaces" } }],
          })
        );
      }, 1800);
    } catch (err) {
      void trackEvent("mobile_host_publish_failed", { pricingMode: draft.pricingMode, listingId: listingId ?? "new" });
      if (!listingId) {
        await saveHostListingDraft(draft);
      }
      setError(err instanceof Error ? err.message : "Could not publish");
      setPublished(false);
      setShowSuccess(false);
    } finally {
      setSubmitting(false);
    }
  };

  const exitFlow = () => {
    const parent = navigation.getParent();
    if (parent?.canGoBack()) parent.goBack();
  };

  // Edit mode opens straight to Review (it's the flow's root screen there), so
  // Android hardware back would pop the whole flow and silently discard edits.
  // Intercept it and route through the same save/leave confirm as the header X.
  // (iOS swipe-back is disabled for this screen in the navigator.) Create mode
  // isn't guarded here — back just steps to the previous screen, which is safe.
  useEffect(() => {
    if (!listingId) return;
    const onHardwareBack = () => {
      if (published) return true;
      presentExitConfirm({
        canSave: false,
        message: "Leave without saving your changes? Your edits won't be applied to the live listing.",
        onConfirm: exitFlow,
      });
      return true;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onHardwareBack);
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId, published]);

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <FlowHeader current={9} onClose={exitFlow} showHelp={false} />

      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 32 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* The step's one ask, in the same 26/31 every other step uses. The
            kicker above it went with the rebuild — no other step has one. */}
        <View style={styles.stepBlock}>
          <StepQuestion title={listingId ? "Review your changes" : "Here's your listing"} />
        </View>

        {/* ── Hero: exactly what drivers will see (tap to edit photos) ── */}
        <Pressable
          style={styles.heroCard}
          onPress={() => navigation.navigate("ListingPhotos", { fromReview: true })}
        >
          <View style={styles.heroMedia}>
            {coverPhotoUri ? (
              <Image style={styles.heroImage} source={{ uri: coverPhotoUri }} resizeMode="cover" />
            ) : (
              <View style={styles.heroPlaceholder}>
                <Camera size={26} color={SOFT} strokeWidth={1.7} />
                <Text style={styles.heroPlaceholderText}>Add photos of your space</Text>
              </View>
            )}
          </View>
          {/* No count chip and no price pill over the photo: the design puts
              the card's whole job in the two lines under it, and the rows
              below already state the rate. */}
          <View style={styles.heroMeta}>
            <Text style={styles.heroTitle} numberOfLines={1}>
              {publishTitle}
            </Text>
            <Text style={styles.heroAddress} numberOfLines={1}>
              {draft.location.address || "Location not set"}
            </Text>
          </View>
        </Pressable>

        {/* ── Description (reviewable text, lightweight edit) ── */}
        <View style={styles.descCard}>
          <View style={styles.descHeaderRow}>
            <StepSection title="Title &amp; description" />
            <Pressable onPress={() => setEditingDescription((v) => !v)} hitSlop={10}>
              <Text style={styles.editLink}>{editingDescription ? "Done" : "Edit"}</Text>
            </Pressable>
          </View>
          {editingDescription ? (
            <>
              <TextInput
                style={styles.titleInput}
                value={draft.listingTitle ?? ""}
                onChangeText={(text) => setDraft((prev) => ({ ...prev, listingTitle: text }))}
                autoFocus
                placeholder="Listing title…"
                placeholderTextColor={MUTED}
                maxLength={80}
              />
              <TextInput
                style={styles.descriptionInput}
                value={draft.description ?? ""}
                onChangeText={(text) => setDraft((prev) => ({ ...prev, description: text }))}
                multiline
                textAlignVertical="top"
                placeholder="Describe your space…"
                placeholderTextColor={MUTED}
              />
            </>
          ) : (
            <Text style={styles.descriptionText}>
              {draft.description?.trim() || "Add a short description to help drivers choose your space."}
            </Text>
          )}
          <Text style={styles.generatedNote}>
            Written from your details — tap Edit to make it yours.
          </Text>
        </View>

        {/* ── Review & edit (only what isn't already shown above) ── */}
        <View style={styles.section}>
          <DetailRow
            icon={<MapPin size={18} color={FG} strokeWidth={1.8} />}
            label="Location"
            value={draft.location.address || "Not set"}
            status={draft.location.address.trim().length > 0 ? "ok" : "warn"}
            onPress={() => navigation.navigate("ListingLocation", { fromReview: true })}
          />
          <DetailRow
            icon={<House size={18} color={FG} strokeWidth={1.8} />}
            label="Space"
            value={spaceTypeValue}
            status={draft.spaceType.trim().length > 0 ? "ok" : "warn"}
            onPress={() => navigation.navigate("ListingDetails", { fromReview: true })}
          />
          <DetailRow
            icon={<Euro size={18} color={FG} strokeWidth={1.8} />}
            label="Rates"
            value={priceLabel}
            status={pricingOk}
            onPress={() => navigation.navigate("ListingPrice", { fromReview: true })}
          />
          <DetailRow
            icon={<Clock size={18} color={FG} strokeWidth={1.8} />}
            label="Availability"
            value={draft.availability.detail || "Not set"}
            status={draft.availability.detail.trim().length > 0 ? "ok" : "warn"}
            onPress={() => navigation.navigate("ListingAvailability", { fromReview: true })}
          />
          <DetailRow
            icon={<ListChecks size={18} color={FG} strokeWidth={1.8} />}
            label="Features"
            value={featureSummary}
            onPress={() => navigation.navigate("ListingFeatures", { fromReview: true })}
          />
          <DetailRow
            icon={<KeyRound size={18} color={FG} strokeWidth={1.8} />}
            label="Access"
            value={accessSummary}
            onPress={() => navigation.navigate("ListingAccess", { fromReview: true })}
            isLast
          />
        </View>

        {/* ── The conclusion: reassure, confirm, publish ── */}
        <View style={styles.publishPanel}>
          <Text style={styles.publishTitle}>{listingId ? "Save your changes" : "Ready to go live"}</Text>
          <View style={styles.reassureRow}>
            <View style={styles.reassureDot}><Check size={11} color={ACCENT} strokeWidth={3} /></View>
            <Text style={styles.reassureText}>
              {listingId ? "Your updates show to drivers right away." : "Your space appears on the map the moment you publish."}
            </Text>
          </View>
          <View style={styles.reassureRow}>
            <View style={styles.reassureDot}><Check size={11} color={ACCENT} strokeWidth={3} /></View>
            <Text style={styles.reassureText}>You can edit, pause or remove it anytime.</Text>
          </View>
          {!listingId ? (
            <View style={styles.reassureRow}>
              <View style={styles.reassureDot}><Check size={11} color={ACCENT} strokeWidth={3} /></View>
              <Text style={styles.reassureText}>
                After publishing, connect Stripe payouts from your dashboard to receive your earnings.
              </Text>
            </View>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[styles.permissionCard, draft.permissionDeclared && styles.permissionCardActive]}
            onPress={() => setDraft((prev) => ({ ...prev, permissionDeclared: !prev.permissionDeclared }))}
          >
            <View style={[styles.checkbox, draft.permissionDeclared && styles.checkboxActive]}>
              {draft.permissionDeclared ? <Check size={13} color={colors.textInverse} strokeWidth={3} /> : null}
            </View>
            <View style={styles.permissionText}>
              <Text style={styles.permissionTitle}>I have the right to list this space</Text>
              <Text style={styles.permissionSubtitle}>
                You own it or have the owner's permission — and you're happy with everything above.
              </Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>

      {/* ── Footer ── */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {publishHint && !submitting ? (
          <Text style={styles.publishHint}>{publishHint}</Text>
        ) : null}
        {/* The flow's own primary: a dark ink rect at radius 12, the same
            button every other step ends with. This was a green pill, which
            made the first and last screens of the wizard the two that broke
            the rule the middle seven state. */}
        <Pressable
          style={[styles.publishButton, (!canPublish || submitting || published) && styles.publishButtonDisabled]}
          onPress={handlePublish}
          disabled={!canPublish || submitting || published}
          accessibilityRole="button"
        >
          <Text
            style={[
              styles.publishButtonText,
              (!canPublish || submitting || published) && styles.publishButtonTextDisabled,
            ]}
          >
            {submitting ? "Saving…" : listingId ? "Update listing" : "Publish space"}
          </Text>
        </Pressable>
        {/* Only offered when the host genuinely can't publish yet (missing fields
            or unverified email) — for a completable listing it was a standing
            invitation to defer at the moment of commitment. The header's
            "Save & exit" still offers save-and-leave at any time. */}
        {!listingId && (!canPublish || user?.emailVerified === false) ? (
          <Pressable
            style={styles.saveLaterBtn}
            onPress={async () => {
              await saveHostListingDraft(draft);
              showSuccessToast("Saved to Listings. Finish it anytime.");
              exitFlow();
            }}
            disabled={submitting || published}
          >
            <Text style={styles.saveLaterText}>Save and finish later</Text>
          </Pressable>
        ) : null}
      </View>
      </KeyboardAvoidingView>

      {/* ── Phone verification gate ── */}
      {token ? (
        <PhoneVerifyModal
          visible={showPhoneVerify}
          token={token}
          initialPhone={user?.phone}
          onClose={() => setShowPhoneVerify(false)}
          onVerified={async (verifiedPhone) => {
            setShowPhoneVerify(false);
            if (user) {
              await setAuthUser({ ...user, phone: verifiedPhone, phoneVerified: true });
            }
            await doPublish();
          }}
        />
      ) : null}

      {/* ── Success overlay ── */}
      {showSuccess ? (
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <LottieView
              source={require("../../assets/successfully.json")}
              autoPlay
              loop={false}
              style={styles.successAnimation}
            />
            <Text style={styles.successTitle}>
              {listingId ? "Updated" : "Published"}
            </Text>
            <Text style={styles.successBody}>
              {listingId ? "Your listing has been saved." : "Your space is live. Next: set up payouts from your dashboard."}
            </Text>
          </View>
        </View>
      ) : null}

      {exitConfirmModal}
    </SafeAreaView>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function DetailRow({
  icon,
  label,
  value,
  isLast,
  status,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  isLast?: boolean;
  status?: RowStatus;
  onPress?: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.detailRow,
        !isLast && styles.detailRowBorder,
        pressed && styles.editRowPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Edit ${label.toLowerCase()}`}
    >
      <View style={styles.detailIconWrap}>{icon}</View>
      <View style={styles.detailBody}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text
          style={[styles.detailValue, status === "warn" && styles.valueWarning]}
          numberOfLines={2}
        >
          {value}
        </Text>
      </View>
      {/* The word, not a chevron and not a tick. A row that is complete needs
          no badge saying so — the value is the confirmation — and "Edit" says
          what the tap does, which an arrow only implies. */}
      <Text style={styles.detailEdit}>Edit</Text>
    </Pressable>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

// No card shadow: the system separates with a rule and white space.

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: hostFlowColors.bg },
  kav: { flex: 1 },

  scroll: { paddingTop: 24, gap: 0 },

  // ── Page header ──────────────────────────────────────────────
  stepBlock: { paddingHorizontal: 24 },

  // ── Hero (the listing as drivers see it) ─────────────────────
  // 1px rule, 12 corner, no shadow: on a white ground the border is the
  // whole edge, and a shadow under it read as a floating card.
  heroCard: {
    marginTop: 20, marginHorizontal: 24,
    backgroundColor: CARD, borderRadius: 12,
    borderWidth: 1, borderColor: hostFlowColors.border,
    overflow: "hidden",
  },
  heroMedia: { aspectRatio: 1.6, backgroundColor: hostFlowColors.cardBgMuted },
  heroImage: { width: "100%", height: "100%" },
  heroPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: hostFlowColors.cardBgMuted,
  },
  heroPlaceholderText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    color: SOFT,
  },
  heroMeta: { paddingHorizontal: 16, paddingVertical: 14 },
  heroTitle: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 16,
    color: FG,
  },
  heroAddress: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    color: MUTED,
    marginTop: 3,
  },

  // ── Cards ────────────────────────────────────────────────────
  section: { paddingHorizontal: 24, paddingTop: 8 },

  // ── Description (lighter than the surrounding cards) ─────────
  descCard: {
    marginTop: 20,
    marginHorizontal: 24,
    backgroundColor: CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  descHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  editLink: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    color: ACCENT,
    letterSpacing: -0.1,
  },
  descriptionText: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    lineHeight: 21,
    color: MUTED,
  },
  titleInput: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    color: FG,
    marginBottom: 8,
  },
  descriptionInput: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    lineHeight: 20,
    color: FG,
  },
  generatedNote: {
    color: SOFT,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 8,
  },

  // ── Review list header ───────────────────────────────────────

  // ── Detail rows ──────────────────────────────────────────────
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
  },
  detailRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: hostFlowColors.border,
  },
  detailIconWrap: { flexShrink: 0 },
  detailBody: { flex: 1, minWidth: 0 },
  // Uppercase 12 over a 15: the label names the field and the value answers
  // it, so they read as one fact rather than a heading and a caption.
  detailLabel: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: MUTED,
  },
  detailValue: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    color: FG,
    marginTop: 2,
  },
  detailEdit: {
    flexShrink: 0,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14,
    color: FG,
    textDecorationLine: "underline",
  },
  valueWarning: { color: colors.status.pending.text },

  // ── Edit rows ────────────────────────────────────────────────
  editRowPressed: { backgroundColor: hostFlowColors.bg },

  // ── Error ────────────────────────────────────────────────────
  error: {
    backgroundColor: colors.status.canceled.background,
    borderColor: colors.status.canceled.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.danger,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginTop: 14,
  },

  // ── Publish panel (the conclusion) ───────────────────────────
  publishPanel: {
    marginTop: 24,
    marginHorizontal: 24,
    backgroundColor: hostFlowColors.accentSoft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: hostFlowColors.accentSoftBorder,
    padding: 18,
  },
  publishTitle: {
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 17,
    color: FG,
    letterSpacing: -0.4,
    marginBottom: 12,
  },
  reassureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 9,
  },
  reassureDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: hostFlowColors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  reassureText: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13.5,
    color: MUTED,
    lineHeight: 19,
    flex: 1,
  },

  // ── Permission card (inside the conclusion) ──────────────────
  permissionCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: BORDER,
    flexDirection: "row",
    gap: 13,
    padding: 14,
    alignItems: "flex-start",
    marginTop: 5,
  },
  permissionCardActive: {
    borderWidth: 2,
    borderColor: hostFlowColors.text,
    backgroundColor: hostFlowColors.cardBgMuted,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: hostFlowColors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxActive: {
    borderWidth: 2,
    borderColor: hostFlowColors.text,
    backgroundColor: hostFlowColors.cardBgMuted,
  },
  permissionText: { flex: 1 },
  permissionTitle: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14,
    color: FG,
    letterSpacing: -0.2,
    lineHeight: 20,
    marginBottom: 4,
  },
  permissionSubtitle: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    color: MUTED,
    lineHeight: 19,
  },

  // ── Footer ───────────────────────────────────────────────────
  footer: {
    borderTopWidth: 1,
    borderTopColor: hostFlowColors.border,
    backgroundColor: CARD,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  publishButton: {
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    borderRadius: 12,
    backgroundColor: FG,
  },
  publishButtonDisabled: { backgroundColor: hostFlowColors.disabledBg },
  publishButtonText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 17,
    color: colors.textInverse,
  },
  publishButtonTextDisabled: { color: hostFlowColors.disabledText },
  publishHint: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12.5,
    color: MUTED,
    textAlign: "center",
    lineHeight: 17,
    marginBottom: 10,
  },
  saveLaterBtn: {
    alignItems: "center",
    height: 42,
    justifyContent: "center",
  },
  saveLaterText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14,
    color: MUTED,
  },

  // ── Success overlay ──────────────────────────────────────────
  successOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  successCard: {
    alignItems: "center",
    backgroundColor: CARD,
    borderRadius: 20,
    paddingHorizontal: 28,
    paddingVertical: 24,
    width: 240,
  },
  successAnimation: { height: 130, width: 130 },
  successTitle: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 17,
    color: FG,
    letterSpacing: -0.4,
    marginTop: 8,
  },
  successBody: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    color: MUTED,
    marginTop: 4,
    textAlign: "center",
  },
});
