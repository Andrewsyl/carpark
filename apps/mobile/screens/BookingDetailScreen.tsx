import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { SquircleBtn } from "../components/SquircleBtn";
import { PaymentBrandMark } from "../components/PaymentBrandMark";
import { AppDialog, type DialogAction, type DialogTone } from "../components/AppDialog";
import { useCallback, useEffect, useRef, useState } from "react";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DatePicker from "../components/AdaptiveDatePicker";
import { useStripe } from "@stripe/stripe-react-native";
import { cancelBooking, checkInBooking, confirmBookingExtension, createBookingExtensionIntent, getBooking } from "../api";
import { useAuth } from "../auth";
import { googlePayConfig } from "../utils/googlePay";
import {
  bookingReminderIds,
  cancelBookingReminders,
} from "../notifications";
import type { RootStackParamList } from "../types";
import {
  ArrowRight,
  CarFront,
  ChevronRight,
  LifeBuoy,
  MapPin,
  RotateCcw,
  CircleCheck,
  CirclePlay,
  CircleX,
  Clock,
  Navigation,
  RefreshCw,
  Star,
  Undo2,
  type LucideIcon,
} from "lucide-react-native";
import { StatusBar } from "expo-status-bar";
import { formatTimeLabel } from "../utils/dateFormat";
import { formatBookingReference } from "../utils/bookingFormat";
import { evaluateCancellationRefund } from "../utils/cancellationPolicy";
import { fallbackRoutes, goBackOrFallback } from "../navigation/safeNavigation";
import { colors } from "../styles/theme";
import {
  ACCENT_SOFT as PAGE_ACCENT_SOFT,
  GREEN_DARK as PAGE_ACCENT_DARK,
  GREEN,
  INK,
  MUTED as PAGE_MUTED,
  PILL as PAGE_PILL,
  RULE,
  WHITE,
} from "../styles/pageTokens";
import { radii } from "../styles/tokens";
import {
  DataRow,
  PageHeader,
  PillButton,
  Rule,
  SectionTitle,
  StatusPill,
} from "../components/ui/page";

type Props = NativeStackScreenProps<RootStackParamList, "BookingDetail">;

export function BookingDetailScreen({ navigation, route }: Props) {
  const { booking } = route.params;
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [localStatus, setLocalStatus] = useState(booking.status);
  const [localRefundStatus, setLocalRefundStatus] = useState(booking.refundStatus ?? null);
  const [localRefundedAt, setLocalRefundedAt] = useState(booking.refundedAt ?? null);
  const [localEndTime, setLocalEndTime] = useState(() => new Date(booking.endTime));
  const [localAmountCents, setLocalAmountCents] = useState(booking.amountCents);
  const [canceling, setCanceling] = useState(false);
  const [checkedInAt, setCheckedInAt] = useState(
    booking.checkedInAt ? new Date(booking.checkedInAt) : null
  );
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendBusy, setExtendBusy] = useState(false);
  const [extendError, setExtendError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{
    tone: DialogTone;
    title: string;
    message?: string;
    actions: DialogAction[];
  } | null>(null);
  // The booking arrives as a navigation-param snapshot from the list fetch.
  // Access code and arrival instructions are live reads (invariant: hosts can
  // update them after booking), and status/refunds can change server-side, so
  // a silent focus refetch below replaces this with fresh truth.
  const [live, setLive] = useState(booking);
  const start = new Date(booking.startTime);
  const end = localEndTime;
  // Ticks every 30s so status flags (in progress / completed / check-in window)
  // stay accurate while the screen is open.
  const [now, setNow] = useState(() => Date.now());
  // Tick only while focused (and refresh on focus) so the screen doesn't keep
  // waking every 30s while it sits unfocused under the navigation stack.
  useFocusEffect(
    useCallback(() => {
      setNow(Date.now());
      const interval = setInterval(() => setNow(Date.now()), 30_000);
      return () => clearInterval(interval);
    }, [])
  );

  // Best-effort refresh on focus; failures keep the snapshot on screen.
  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      let activeFetch = true;
      void getBooking(token, booking.id)
        .then((fresh) => {
          if (!activeFetch) return;
          setLive(fresh);
          setLocalStatus(fresh.status);
          setLocalRefundStatus(fresh.refundStatus ?? null);
          setLocalRefundedAt(fresh.refundedAt ?? null);
          setLocalEndTime(new Date(fresh.endTime));
          setLocalAmountCents(fresh.amountCents);
          setCheckedInAt(fresh.checkedInAt ? new Date(fresh.checkedInAt) : null);
        })
        .catch(() => {});
      return () => {
        activeFetch = false;
      };
    }, [token, booking.id])
  );
  const isUpcoming = end.getTime() > now && start.getTime() > now;
  const isInProgress = start.getTime() <= now && end.getTime() > now && localStatus === "confirmed";
  const isCanceled = localStatus === "canceled";
  const isRefunded = localRefundStatus === "succeeded";
  const canReview = end.getTime() <= now && localStatus === "confirmed";
  const [reviewed, setReviewed] = useState(false);
  const [reviewedRating, setReviewedRating] = useState<number | null>(null);
  const [pendingRating, setPendingRating] = useState<number | null>(null);

  // The "ending soon" reminder (with the "Extend +" action) is now sent
  // server-side via the notification processor, so we no longer schedule it
  // locally here — that avoids duplicate notifications and keeps it correct if
  // the booking is extended or cancelled.

  // Arriving from the "Extend +" notification action opens the extend picker
  // straight away. Guarded so it only fires once per mount and only while the
  // booking can actually be extended.
  const autoExtendHandledRef = useRef(false);
  useEffect(() => {
    if (autoExtendHandledRef.current || !route.params?.autoExtend) return;
    if ((isUpcoming || isInProgress) && !isCanceled && localStatus === "confirmed") {
      autoExtendHandledRef.current = true;
      setExtendOpen(true);
    }
  }, [isUpcoming, isInProgress, isCanceled, localStatus, route.params?.autoExtend]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setPendingRating(null);
      void (async () => {
        try {
          const stored = await AsyncStorage.getItem(`bookingRating:${booking.id}`);
          if (!stored) {
            if (active) {
              setReviewed(false);
              setReviewedRating(null);
            }
            return;
          }
          const parsed = JSON.parse(stored) as { rating?: number };
          if (!active) return;
          if (typeof parsed.rating === "number") {
            setReviewed(true);
            setReviewedRating(parsed.rating);
          } else {
            setReviewed(false);
            setReviewedRating(null);
          }
        } catch {
          if (active) {
            setReviewed(false);
            setReviewedRating(null);
          }
        }
      })();
      return () => {
        active = false;
      };
    }, [booking.id])
  );

  const receiptUrl = live.receiptUrl ?? null;
  const destination =
    typeof booking.latitude === "number" && typeof booking.longitude === "number"
      ? `${booking.latitude},${booking.longitude}`
      : booking.address;
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    destination
  )}`;
  const minExtendTime = new Date(end.getTime() + 5 * 60 * 1000);
  const canCheckIn =
    localStatus === "confirmed" &&
    !checkedInAt &&
    now >= start.getTime() - 15 * 60 * 1000 &&
    now <= end.getTime();
  const isCompleted = !isUpcoming && !isInProgress && !isCanceled;
  const canBookAgain = isCanceled || (!isUpcoming && !isInProgress);
  // Copy-only mirror of the server cancellation policy — the /cancel route
  // re-decides authoritatively. Missing createdAt defaults to non-refundable
  // copy (createdAtMs 0), which the server would correct on submit.
  const cancelRefundEligible = evaluateCancellationRefund({
    nowMs: now,
    startMs: start.getTime(),
    createdAtMs: live.createdAt ? new Date(live.createdAt).getTime() : 0,
    checkedIn: Boolean(checkedInAt),
  }).refundEligible;
  const statusConfig = (() => {
    if (isCanceled && isRefunded) return { label: "Refunded", icon: Undo2 };
    if (isCanceled) return { label: "Booking canceled", icon: CircleX };
    if (isInProgress) return { label: "In progress", icon: CirclePlay };
    if (isUpcoming) return { label: "Confirmed", icon: CircleCheck };
    return { label: "Completed", icon: CircleCheck };
  })();
  const StatusIcon = statusConfig.icon as LucideIcon;
  const showArrivalInfo =
    (isUpcoming || isInProgress || canReview) &&
    (Boolean(live.arrivalInstructions?.trim()) || Boolean(live.accessCode?.trim()));
  const cancellationSource = booking.cancellationSource ?? null;
  const bookingDateLabel = `${start.toLocaleDateString("en-IE", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "Europe/Dublin",
  })} · ${formatTimeLabel(start)} - ${formatTimeLabel(end)}`;
  const startDateLabel = start.toLocaleDateString("en-IE", {
    weekday: "short", day: "2-digit", month: "short", timeZone: "Europe/Dublin",
  });
  const endDateLabel = end.toLocaleDateString("en-IE", {
    weekday: "short", day: "2-digit", month: "short", timeZone: "Europe/Dublin",
  });
  const refundedDateLabel = localRefundedAt
    ? new Date(localRefundedAt).toLocaleDateString("en-IE", {
        weekday: "short", day: "2-digit", month: "short", timeZone: "Europe/Dublin",
      })
    : null;
  const durationMs    = end.getTime() - start.getTime();
  const durH          = Math.floor(durationMs / 3_600_000);
  const durM          = Math.floor((durationMs % 3_600_000) / 60_000);
  const durationLabel = durH > 0
    ? (durM > 0 ? `${durH}h ${durM}m` : `${durH}h`)
    : `${durM}m`;

  const performCancel = async () => {
    if (!token || canceling || localStatus === "canceled") return;
    setCanceling(true);
    try {
      const result = await cancelBooking({ token, bookingId: booking.id });
      await AsyncStorage.setItem("searchRefreshToken", Date.now().toString());
      // Drop the pending "starts soon"/"ends soon" reminders for this booking.
      void cancelBookingReminders([
        bookingReminderIds.start(booking.listingId, start.getTime()),
        bookingReminderIds.end(booking.listingId, end.getTime()),
      ]);
      setLocalStatus("canceled");
      if (result.refunded) {
        setLocalRefundStatus("succeeded");
        setLocalRefundedAt(new Date().toISOString());
      }
      setCanceling(false);
      // The "Booking canceled" notification is sent server-side
      // (sendBookingStatusPush) to both driver and host, so we don't fire a
      // duplicate local one here.
    } catch (err) {
      setCanceling(false);
      setDialog({
        tone: "error",
        title: "Cancellation failed",
        message: err instanceof Error ? err.message : "Could not cancel booking. Please try again.",
        actions: [{ label: "OK" }],
      });
    }
  };

  const handleCancel = () => {
    if (!token || canceling || localStatus === "canceled") return;
    setDialog({
      tone: "confirm",
      title: "Cancel booking",
      message: cancelRefundEligible
        ? "Cancel this reservation and release the space? Your payment will be refunded to your original payment method."
        : "Cancel this reservation and release the space? This booking is non-refundable, so you won't get a refund.",
      actions: [
        { label: "Keep", variant: "neutral" },
        { label: "Cancel booking", variant: "danger", onPress: performCancel },
      ],
    });
  };

  const handleExtend = async (nextEnd: Date) => {
    if (!token || extendBusy || localStatus !== "confirmed") return;
    setExtendBusy(true);
    setExtendError(null);
    try {
      const result = await createBookingExtensionIntent({
        token,
        bookingId: booking.id,
        newEndTime: nextEnd.toISOString(),
      });

      if ("noCharge" in result && result.noCharge) {
        void cancelBookingReminders([
          bookingReminderIds.end(booking.listingId, end.getTime()),
        ]);
        setLocalEndTime(new Date(result.newEndTime));
        setLocalAmountCents(result.newTotalCents);
        setDialog({
          tone: "success",
          title: "Booking updated",
          message: "Your end time has been extended.",
          actions: [{ label: "Done" }],
        });
        return;
      }

      if (!("paymentIntentClientSecret" in result)) {
        setExtendError("We could not prepare the extension payment.");
        return;
      }

      const initResult = await initPaymentSheet({
        merchantDisplayName: "FreeSpace",
        customerId: result.customerId,
        customerEphemeralKeySecret: result.ephemeralKeySecret,
        paymentIntentClientSecret: result.paymentIntentClientSecret,
        allowsDelayedPaymentMethods: false,
        applePay: { merchantCountryCode: "IE" },
        googlePay: googlePayConfig,
      });
      if (initResult.error) {
        setExtendError("We couldn't start the extension payment.");
        return;
      }

      const presentResult = await presentPaymentSheet();
      if (presentResult.error) {
        // Dismissing the payment sheet isn't an error — stay silent.
        if (presentResult.error.code !== "Canceled") {
          setExtendError(presentResult.error.message ?? "Payment failed.");
        }
        return;
      }

      const confirm = await confirmBookingExtension({
        token,
        bookingId: booking.id,
        paymentIntentId: result.paymentIntentId,
        newEndTime: result.newEndTime,
        newTotalCents: result.newTotalCents,
      });
      // The old end-time reminder is now wrong; the schedule effect will create
      // one for the new end time when localEndTime updates.
      void cancelBookingReminders([
        bookingReminderIds.end(booking.listingId, end.getTime()),
      ]);
      setLocalEndTime(new Date(confirm.newEndTime));
      setLocalAmountCents(confirm.newTotalCents);
      setDialog({
        tone: "success",
        title: "Booking extended",
        message: "Your end time has been updated.",
        actions: [{ label: "Done" }],
      });
    } catch (err) {
      setExtendError(err instanceof Error ? err.message : "Could not extend booking");
    } finally {
      setExtendBusy(false);
    }
  };

  const handleCheckIn = async () => {
    if (!token || !canCheckIn) return;
    try {
      const result = await checkInBooking({ token, bookingId: booking.id });
      setCheckedInAt(new Date(result.checkedInAt));
      setDialog({
        tone: "success",
        title: "Checked in",
        message: "Thanks! Enjoy your booking.",
        actions: [{ label: "Done" }],
      });
    } catch (err) {
      setDialog({
        tone: "error",
        title: "Check-in failed",
        message: err instanceof Error ? err.message : "Try again.",
        actions: [{ label: "OK" }],
      });
    }
  };

  // Opens the listing with a fresh now/+2h window — used by both the header
  // card tap ("view the space") and the Book again button.
  const handleOpenListing = () => {
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000);
    navigation.navigate("Listing", {
      id: booking.listingId,
      from: startTime.toISOString(),
      to: endTime.toISOString(),
    });
  };

  const handleOpenMaps = () => {
    Linking.openURL(mapsUrl);
  };

  const handleStarPress = (star: number) => {
    setPendingRating(star);
    // Navigate after a short delay so the filled stars are visible during
    // the transition. pendingRating is NOT cleared here — it resets via
    // useFocusEffect when the user returns to this screen.
    setTimeout(() => {
      navigation.navigate("Review", { booking, initialRating: star });
    }, 350);
  };

  const handleContactSupport = () => {
    navigation.navigate("Support", {
      prefillSubject: isCanceled ? "Refund request" : "Payment or refund",
      prefillMessage: `Booking reference: ${formatBookingReference(booking.id)}\nListing: ${booking.title}\nIssue:\n`,
    });
  };

  const progressPct = isInProgress
    ? Math.min(1, Math.max(0, (now - start.getTime()) / (end.getTime() - start.getTime())))
    : 0;

  const heroUri = booking.imageUrls?.[0] ?? null;
  const hasCoords =
    typeof booking.latitude === "number" && typeof booking.longitude === "number";
  // The band carries the state at a glance. Tones come from the shared status
  // palette so a cancelled booking is the same red wherever it appears.
  const ticketTone = isRefunded
    ? { band: colors.status.refunded.text }
    : isCanceled
      ? { band: colors.status.canceled.text }
      : isInProgress || isCompleted
        ? { band: GREEN }
        : { band: INK };


  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar style="dark" translucent={false} backgroundColor={WHITE} />

      {/* Same masthead as the checkout the driver just came from — a centred
          nav bar here made the two screens read as different apps. */}
      <PageHeader
        title="Your booking"
        align="left"
        onBack={() => goBackOrFallback(navigation, fallbackRoutes.bookings)}
      />

      <ScrollView
        contentContainerStyle={[styles.content, styles.contentFill]}
        showsVerticalScrollIndicator={false}
      >

        {/* The space itself. A booking is a record of a real place, and the
            listing already carries a photo of it — worth more than another
            block of grey text. */}
        <View style={styles.hero}>
          {heroUri ? (
            <Image source={{ uri: heroUri }} style={styles.heroImage} resizeMode="cover" />
          ) : null}
        </View>


          {/* Masthead in the listing's language: centred title, place beneath
              it, state as a pill — not a bordered card with a left-aligned
              heading. The two screens are one flow and should read as one. */}
          <Pressable onPress={handleOpenListing} style={styles.masthead}>
            {/* Below the photo on white, not over it — the state reads first,
                then what it is about. */}
            <View style={styles.mastheadStatus}>
              <StatusPill
                label={statusConfig.label}
                icon={StatusIcon}
                tone={
                  isRefunded ? "info" : isCanceled ? "danger" : isInProgress || isCompleted ? "positive" : "neutral"
                }
              />
            </View>
            <Text style={styles.mastheadTitle} numberOfLines={2}>{booking.title}</Text>
            <View style={styles.mastheadPlace}>
              <MapPin size={15} color={MUTED} strokeWidth={1.8} />
              <Text style={styles.mastheadAddress} numberOfLines={1}>{booking.address}</Text>
            </View>
          </Pressable>

          <Rule tight />

          <SectionTitle>Your parking window</SectionTitle>
          <View style={styles.block}>
            <View style={styles.windowTimes}>
              <Text style={styles.windowTime}>{formatTimeLabel(start)}</Text>
              <ArrowRight size={16} color={MUTED} strokeWidth={2} style={styles.windowArrow} />
              <Text style={styles.windowTime}>{formatTimeLabel(end)}</Text>
            </View>
            <Text style={styles.windowMeta}>{`${startDateLabel} · ${durationLabel}`}</Text>
            {isInProgress ? (
              <View style={styles.progressWrap}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.round(progressPct * 100)}%` as `${number}%` }]} />
                </View>
              </View>
            ) : null}
          </View>

          <Rule tight />

          <SectionTitle>Details</SectionTitle>
          <View style={styles.block}>
            <DataRow
              label="Reference"
              valueNode={
                <Text style={styles.detailRef} selectable>
                  {formatBookingReference(booking.id)}
                </Text>
              }
            />
            {live.vehiclePlate ? (
              <DataRow
                label="Vehicle"
                valueNode={<Text style={styles.detailRef}>{live.vehiclePlate}</Text>}
              />
            ) : null}
            {checkedInAt ? (
              <DataRow
                label="Checked in"
                valueNode={<Text style={styles.detailCheckedIn}>{formatTimeLabel(checkedInAt)}</Text>}
              />
            ) : null}
            <DataRow label="Total paid" value={`€${(localAmountCents / 100).toFixed(2)}`} last />
          </View>

          {isRefunded ? (
            <View style={styles.refund}>
              <RotateCcw size={17} color={PAGE_ACCENT_DARK} strokeWidth={2} />
              <Text style={styles.refundText}>
                {`Refunded in full — €${(localAmountCents / 100).toFixed(2)} back to your card within 3–5 days.`}
              </Text>
            </View>
          ) : null}

          {canReview && !reviewed ? (
            <>
              <Rule tight />
              <SectionTitle>How was your parking?</SectionTitle>
              <View style={styles.block}>
                <Text style={styles.reviewHint}>
                  Your rating helps the next driver decide.
                </Text>
                <View style={styles.reviewStars}>
                  {Array.from({ length: 5 }).map((_, i) => {
                    const star = i + 1;
                    const filled = pendingRating !== null && star <= pendingRating;
                    return (
                      <Pressable
                        key={i}
                        onPress={() => handleStarPress(star)}
                        hitSlop={12}
                        accessibilityRole="button"
                        accessibilityLabel={`Rate ${star} out of 5`}
                      >
                        <Star
                          size={34}
                          color={filled ? colors.star.review : RULE}
                          fill={filled ? colors.star.review : RULE}
                          strokeWidth={0}
                        />
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </>
          ) : null}

          {/* Cancellation note */}
          {isCanceled ? (
            <View style={styles.cancellationNote}>
              <Text style={styles.cancellationText}>
                {isRefunded ? "Refund submitted to your original payment method."
                  : cancellationSource === "host" ? "Canceled by the host."
                  : "Booking canceled."}
                {!isRefunded ? <Text style={styles.sectionLink} onPress={handleContactSupport}> Contact support →</Text> : null}
              </Text>
            </View>
          ) : null}


        <View style={styles.actionsSpacer} />

        {/* Closing actions: one green pill for what most people want next,
            then quiet links. Cancel stays separate — a destructive action does
            not belong beside a primary. */}
        <View style={styles.actionsSection}>
          {extendError ? <Text style={styles.errorText}>{extendError}</Text> : null}

          {(isUpcoming || isInProgress) && localStatus === "confirmed" ? (
            <Pressable
              style={styles.primaryAction}
              onPress={() => setExtendOpen(true)}
              disabled={extendBusy}
              accessibilityRole="button"
            >
              <Clock size={17} color={WHITE} strokeWidth={2} />
              <Text style={styles.primaryActionText}>
                {extendBusy ? "Extending…" : "Extend end time"}
              </Text>
            </Pressable>
          ) : canBookAgain ? (
            <Pressable
              style={styles.primaryAction}
              onPress={handleOpenListing}
              accessibilityRole="button"
            >
              <RefreshCw size={17} color={WHITE} strokeWidth={2} />
              <Text style={styles.primaryActionText}>Book this space again</Text>
            </Pressable>
          ) : null}

          <Pressable style={styles.helpRow} onPress={handleContactSupport} accessibilityRole="button">
            <LifeBuoy size={16} color={MUTED} strokeWidth={1.9} />
            <Text style={styles.helpText}>Need help?</Text>
          </Pressable>

          {isUpcoming && !isCanceled ? (
            <Pressable style={styles.cancelRow} onPress={handleCancel} disabled={canceling}>
              <Text style={styles.cancelText}>{canceling ? "Canceling…" : "Cancel booking"}</Text>
              {!canceling && !cancelRefundEligible ? (
                <Text style={styles.cancelSubtext}>Non-refundable</Text>
              ) : null}
            </Pressable>
          ) : null}

          {receiptUrl ? (
            <View style={styles.linkRow}>
              <Pressable onPress={() => Linking.openURL(receiptUrl)}>
                <Text style={styles.linkText}>View receipt</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

      </ScrollView>

      {/* Check-in lives in a pinned footer, not the scroll flow: during the
          arrival window it must be visible without scrolling past the
          Getting in / Location / Details stack. */}
      {canCheckIn ? (
        <View style={[styles.checkInBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <SquircleBtn
            label="Check in"
            onPress={handleCheckIn}
            icon={<CircleCheck size={18} color={WHITE} strokeWidth={2.2} />}
            fullWidth
          />
        </View>
      ) : null}

      <DatePicker
        modal
        open={extendOpen}
        date={minExtendTime}
        minimumDate={minExtendTime}
        mode="datetime"
        minuteInterval={30}
        onConfirm={(date) => { setExtendOpen(false); handleExtend(date); }}
        onCancel={() => setExtendOpen(false)}
      />

      <AppDialog
        visible={dialog !== null}
        tone={dialog?.tone}
        title={dialog?.title ?? ""}
        message={dialog?.message}
        actions={dialog?.actions ?? []}
        onRequestClose={() => setDialog(null)}
      />
    </SafeAreaView>
  );
}

// Sourced from styles/theme.ts (see docs/PARKING_DESIGN_BIBLE.md §0) — kept as
// local aliases so the styles below don't need touching one by one.
const ACCENT = GREEN;
const FG     = INK;
const MUTED  = PAGE_MUTED;
const SUBTLE = PAGE_MUTED;
const LINE   = RULE;

const styles = StyleSheet.create({
  // ── Masthead — the listing's, centred ──────────────────────────────────────
  block: { paddingHorizontal: 24 },

  masthead: { paddingHorizontal: 24, paddingTop: 18 },
  mastheadTitle: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 24, lineHeight: 29, letterSpacing: -0.5, color: INK, marginTop: 10,
  },
  mastheadPlace: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  mastheadAddress: {
    flexShrink: 1,
    fontFamily: "PlusJakartaSans-Regular", fontSize: 15, lineHeight: 21, color: MUTED,
  },

  windowTimes: { flexDirection: "row", alignItems: "baseline", gap: 10 },
  windowArrow: { alignSelf: "center" },
  windowTime: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 22, lineHeight: 27, letterSpacing: -0.4, color: INK,
  },
  windowMeta: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 15, color: MUTED, marginTop: 4,
  },
  progressWrap: { marginTop: 14 },
  progressTrack: { height: 4, borderRadius: radii.round, backgroundColor: PAGE_PILL, overflow: "hidden" },
  progressFill: { height: 4, borderRadius: radii.round, backgroundColor: ACCENT },

  detailRef: {
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 15, color: INK,
  },
  detailCheckedIn: { fontFamily: "PlusJakartaSans-Regular", fontSize: 15, color: ACCENT },


  // ── Hero — the space itself, above the ticket ─────────────────────────────
  hero: { height: 152, backgroundColor: PAGE_PILL },
  heroImage: { width: "100%", height: "100%" },
  mastheadStatus: { alignSelf: "flex-start" },
  // The ticket rides up over the photo, so the two read as one object rather
  // than a picture with a card underneath it.

  reviewHint: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 15, lineHeight: 21, color: MUTED,
  },
  reviewStars: { flexDirection: "row", gap: 10, marginTop: 14 },
  // The code gets the accent tint so it reads as the thing to act on, and
  // stays selectable — people copy it into a keypad app or a note.
  // The one deliberate exception to the type scale: an entry code is read off
  // a phone at a gate, monospaced with wide tracking. It is not body type.

  refund: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 24, marginTop: 16,
    backgroundColor: PAGE_ACCENT_SOFT, borderRadius: radii.surface,
    paddingVertical: 12, paddingHorizontal: 14,
  },
  refundText: {
    flex: 1, fontFamily: "PlusJakartaSans-Regular", fontSize: 15, lineHeight: 21,
    color: PAGE_ACCENT_DARK,
  },


  // Rides up over the photo so the sheet reads as lifted off it, the same
  // relationship the listing has between its hero and its content.




  // ── Parking window — the listing's tinted pair, read-only ─────────────────

  // What the tiles used to give: an inset block on the page, no border.

  container: { flex: 1, backgroundColor: WHITE },

  // ── Nav header ──────────────────────────────────────────────

  // ── Scroll content ───────────────────────────────────────────
  content: { paddingBottom: 20 },
  contentFill: { flexGrow: 1 },
  actionsSpacer: { flex: 1, minHeight: 20 },

  // ── Pinned check-in bar ──────────────────────────────────────
  checkInBar: {
    paddingHorizontal: 24,
    paddingTop: 12,
    backgroundColor: WHITE,
    borderTopWidth: 1,
    borderTopColor: RULE,
  },

  // ── Full-bleed banners ───────────────────────────────────────


  // ── Cards wrapper ─────────────────────────────────────────────

  // ── Header card (status + title + time) ──────────────────────
  // RULE (not divider) for card edges: divider-weight hairlines wash
  // out against light grounds on iOS — same lesson as BookingCard/Favourites
  // (2026-07-09).

  // ── Status pill ──────────────────────────────────────────────

  // ── Card (generic) ───────────────────────────────────────────

  // ── Time row ─────────────────────────────────────────────────
  // The status hero is its own surface, not a tile, so it carries its own 16.

  // ── Progress bar (in-progress bookings) ──────────────────────

  // ── Extend row ───────────────────────────────────────────────

  // ── Detail rows (inside Details card) ────────────────────────
  // The tile supplies the 16 inset and the 6px row rhythm used across the
  // system; the row only spaces itself from its neighbours.

  // ── Getting in ───────────────────────────────────────────────
  // The one deliberate exception to the type scale: an entry code is read off
  // a phone at a gate, monospaced with 6pt tracking. It is not body type and
  // shouldn't be sized like it.

  // ── Cancellation note ────────────────────────────────────────
  cancellationNote: { paddingHorizontal: 24, paddingTop: 16 },
  cancellationText: { fontFamily: "PlusJakartaSans-Regular", fontSize: 15, color: MUTED, lineHeight: 21 },
  sectionLink: { fontFamily: "PlusJakartaSans-SemiBold", color: ACCENT },

  // ── Actions ──────────────────────────────────────────────────
  actionsSection: { paddingHorizontal: 24, paddingBottom: 20, gap: 14 },
  primaryAction: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    height: 50, borderRadius: radii.round, backgroundColor: ACCENT,
  },
  primaryActionText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 16, color: WHITE },
  helpRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  helpText: { fontFamily: "PlusJakartaSans-Regular", fontSize: 15, color: MUTED },
  errorText: { color: colors.danger, fontSize: 13, textAlign: "center", fontFamily: "PlusJakartaSans-Regular" },
  cancelRow: {
    borderWidth: 1, borderColor: colors.status.canceled.border, borderRadius: radii.field,
    backgroundColor: colors.status.canceled.background,
    paddingVertical: 14, alignItems: "center",
  },
  cancelText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 14, color: colors.danger },
  cancelSubtext: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: colors.danger, marginTop: 2, opacity: 0.8 },
  linkRow: { flexDirection: "row", justifyContent: "center", gap: 24, paddingVertical: 4 },
  linkText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 13, color: MUTED },
});
