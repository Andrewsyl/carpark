import { CommonActions, useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Platform,
  KeyboardAvoidingView,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  StatusBar,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useStripe } from "@stripe/stripe-react-native";
import * as Notifications from "expo-notifications";
import { ModernTimePickerSheet, addMinutes, roundUpToMinuteInterval } from "../components/ModernTimePickerSheet";
import {
  CarFront,
  ChevronDown,
  ChevronRight,
  CircleX,
  Clock,
  Info,
  MapPin,
  Plus,
  ShieldCheck,
} from "lucide-react-native";
import {
  confirmBookingPayment,
  createBookingPaymentIntent,
  getListing,
  validatePromoCode,
  type PromoValidation,
} from "../api";
import { useAuth } from "../auth";
import { BookingReviewBody } from "./BookingReviewBody";
import { googlePayConfig } from "../utils/googlePay";
import { logError, logInfo, logWarn } from "../logger";
import { useGlobalLoading } from "../components/GlobalLoading";
import { useToastOnMessage } from "../components/GlobalToast";
import { PaymentBrandMark, platformWallet } from "../components/PaymentBrandMark";
import { VehicleBrandLogo } from "../components/VehicleBrandLogo";
import { Button, SkeletonBlock, usePulse } from "../components/ui";
import { colors, radius } from "../styles/theme";
import { isMobileE2EActive } from "../e2e/testMode";
import { trackEvent } from "../analytics";
import type { ListingDetail, RootStackParamList } from "../types";
import { publicAddress } from "../utils/address";
import { formatDateLabel, formatTimeLabel } from "../utils/dateFormat";
import {
  calculateListingTotal,
  calculateMonthlyTotal,
  formatPriceValue,
} from "../utils/pricing";
import { fallbackRoutes, goBackOrFallback, resetToSafeRoute } from "../navigation/safeNavigation";

type Props = NativeStackScreenProps<RootStackParamList, "BookingSummary">;

export function BookingSummaryScreen({ navigation, route }: Props) {
  const { id, from, to, mode } = route.params;
  // A one-off single-month booking (from → from+1 month) priced off the host's
  // monthly rate. The term is fixed here — the start date is chosen on the
  // listing screen — so we skip the hourly arrival/departure pickers and promo.
  const isMonthly = mode === "monthly";
  // Measured rather than guessed: the dock's height moves with the brand-mark
  // row and the home-indicator inset, and the old hardcoded 140 over-padded it
  // by ~30px, leaving dead space under the last card.
  const [footerHeight, setFooterHeight] = useState(0);
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();
  // Clears the dock plus a small gap; falls back to an estimate for the first
  // frame, before onLayout has reported.
  const footerSpacer = (footerHeight || 110 + insets.bottom) + 16;
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loadingListing, setLoadingListing] = useState(true);
  const skeletonPulse = usePulse();
  const [error, setError] = useState<string | null>(null);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const bookingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [confirmingBooking, setConfirmingBooking] = useState(false);
  const [paymentFailureMessage, setPaymentFailureMessage] = useState<string | null>(null);
  const [paymentRecoveryAction, setPaymentRecoveryAction] = useState<"retry" | "bookings" | "time" | null>(null);
  const [showServiceFeeInfo, setShowServiceFeeInfo] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promoExpanded, setPromoExpanded] = useState(false);
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [appliedPromo, setAppliedPromo] = useState<PromoValidation | null>(null);
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [startAt, setStartAt] = useState(() => {
    const rawStart = new Date(from);
    const now = Date.now();
    if (rawStart.getTime() < now) {
      return new Date(Math.ceil(now / (5 * 60 * 1000)) * (5 * 60 * 1000));
    }
    return rawStart;
  });
  const [endAt, setEndAt] = useState(() => {
    const rawStart = new Date(from);
    const rawEnd = new Date(to);
    const durationMs = rawEnd.getTime() - rawStart.getTime();
    const now = Date.now();
    if (rawStart.getTime() < now) {
      const rounded = new Date(Math.ceil(now / (5 * 60 * 1000)) * (5 * 60 * 1000));
      return new Date(rounded.getTime() + durationMs);
    }
    return rawEnd;
  });
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerField, setPickerField] = useState<"start" | "end">("start");
  const { reset: resetGlobalLoading } = useGlobalLoading();

  useToastOnMessage(error, { variant: "danger" });
  useToastOnMessage(paymentFailureMessage, { variant: "danger" });

  const showPaymentRecovery = (
    message: string,
    action: "retry" | "bookings" | "time" | null = "retry"
  ) => {
    setPaymentFailureMessage(message);
    setPaymentRecoveryAction(action);
  };

  const clearPaymentRecovery = () => {
    setPaymentFailureMessage(null);
    setPaymentRecoveryAction(null);
  };

  const goToBookings = () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [
          {
            name: "Tabs",
            params: {
              screen: "History",
              params: {
                refreshToken: Date.now(),
                initialTab: "upcoming",
              },
            },
          },
        ],
      })
    );
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoadingListing(true);
      setError(null);
      try {
        const data = await getListing(id, {
          from: startAt.toISOString(),
          to: endAt.toISOString(),
        });
        if (!active) return;
        setListing(data);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Listing failed");
      } finally {
        if (!active) return;
        setLoadingListing(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [endAt, id, startAt]);

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: false });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (bookingBusy || bookingConfirmed) return true;
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: "Tabs", params: { screen: "Search" } }],
          })
        );
        return true;
      };
      const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => subscription.remove();
    }, [bookingBusy, bookingConfirmed, navigation])
  );

  useEffect(() => {
    const rawStart = new Date(from);
    const rawEnd = new Date(to);
    const durationMs = rawEnd.getTime() - rawStart.getTime();
    const now = Date.now();
    if (rawStart.getTime() < now) {
      // Round up to next 5-minute boundary
      const rounded = new Date(Math.ceil(now / (5 * 60 * 1000)) * (5 * 60 * 1000));
      setStartAt(rounded);
      setEndAt(new Date(rounded.getTime() + durationMs));
    } else {
      setStartAt(rawStart);
      setEndAt(rawEnd);
    }
  }, [from, to]);

  useEffect(() => {
    setVehicleMake(user?.vehicleMake ?? "");
    setVehicleColor(user?.vehicleColor ?? "");
    setVehiclePlate(user?.vehiclePlate ?? "");
  }, [user?.vehicleColor, user?.vehicleMake, user?.vehiclePlate]);

  const start = useMemo(() => startAt, [startAt]);
  const end = useMemo(() => endAt, [endAt]);
  const priceSummary = useMemo(() => {
    if (!listing) return null;
    if (isMonthly) return calculateMonthlyTotal(Number(listing.price_per_month ?? 0));
    return calculateListingTotal(listing, start, end);
  }, [end, listing, start, isMonthly]);

  const pricing = useMemo(() => {
    // Same fee-inclusive quote the map, list and listing screens display —
    // the price must never change between search and checkout.
    const parkingFee = priceSummary?.total ?? 0;
    const serviceFee = priceSummary?.serviceFee ?? 0;
    const baseCents = priceSummary?.grossTotalCents ?? 0;
    // Same floor the API applies: Stripe can't charge less than €0.50.
    const discountCents = appliedPromo
      ? Math.min(appliedPromo.discountCents, Math.max(baseCents - 50, 0))
      : 0;
    const finalCents = baseCents - discountCents;
    return {
      parkingFee,
      serviceFee,
      discountCents,
      finalPrice: finalCents / 100,
      finalCents,
    };
  }, [priceSummary, appliedPromo]);

  const whenLine = useMemo(
    () =>
      isMonthly
        ? `${formatDateLabel(start)} – ${formatDateLabel(end)}`
        : `${formatDateLabel(start)} · ${formatTimeLabel(start)} – ${formatTimeLabel(end)}`,
    [isMonthly, start, end]
  );

  // "{street}, {area}" — drops the Eircode, the country and the house number,
  // and shortens "Dublin 8" to "D8". The exact address is only shared after
  // booking, so this is deliberately street-level.
  const addressLine = useMemo(() => {
    // Eircode and country come off in `publicAddress`, which is the one rule
    // for it — the local test here only caught a code that sat in its own
    // comma-separated part, so "Dublin 8 D08 X2Y3" as one part slipped past.
    const parts = publicAddress(listing?.address)
      .split(",")
      .map((p: string) => p.trim())
      .filter(Boolean);
    const trimmed = parts
      .map((part: string) =>
        part.replace(/^Dublin\s*(\d+)$/i, (_, n) => `D${n}`).replace(/^Co\.?\s+/i, "")
      );
    if (!trimmed.length) return "";
    const street = trimmed[0].replace(/^\d+[A-Za-z0-9\-\/]*\s+/, "").trim();
    const area = trimmed[trimmed.length - 1];
    return street === area ? street : `${street}, ${area}`;
  }, [listing?.address]);

  // "Volkswagen Estate · Silver" — one line, because the plate below it is the
  // detail that actually gets checked.
  const vehicleLine = useMemo(() => {
    const model = [vehicleMake, user?.vehicleType].filter(Boolean).join(" ");
    return [model, vehicleColor].filter(Boolean).join(" · ");
  }, [vehicleMake, user?.vehicleType, vehicleColor]);

  const applyPromo = useCallback(async () => {
    const code = promoInput.trim();
    if (!code || !listing || !token || promoBusy) return;
    setPromoBusy(true);
    setPromoError(null);
    try {
      const result = await validatePromoCode({
        code,
        listingId: listing.id,
        from: startAt.toISOString(),
        to: endAt.toISOString(),
        token,
      });
      setAppliedPromo(result);
      setPromoInput("");
    } catch (err) {
      setPromoError(err instanceof Error ? err.message : "That promo code isn't valid.");
    } finally {
      setPromoBusy(false);
    }
  }, [promoInput, listing, token, promoBusy, startAt, endAt]);

  // Booking times change the total, so an applied code has to be re-quoted
  // (percent discounts scale; minimum-spend rules may stop applying).
  const appliedCodeRef = useRef<string | null>(null);
  useEffect(() => {
    appliedCodeRef.current = appliedPromo?.code ?? null;
  }, [appliedPromo]);
  useEffect(() => {
    const code = appliedCodeRef.current;
    if (!code || !listing || !token) return;
    let active = true;
    validatePromoCode({
      code,
      listingId: listing.id,
      from: startAt.toISOString(),
      to: endAt.toISOString(),
      token,
    })
      .then((result) => {
        if (active) setAppliedPromo(result);
      })
      .catch((err) => {
        if (!active) return;
        setAppliedPromo(null);
        setPromoError(
          err instanceof Error ? err.message : "Promo code no longer applies to these times."
        );
      });
    return () => {
      active = false;
    };
  }, [startAt, endAt, listing, token]);

  const hasVehicleProfile =
    !!user?.vehicleMake?.trim() && !!user?.vehicleType?.trim();
  const hasVehiclePlate = vehiclePlate.trim().length > 0;
  const requiresVehicleDetails = !hasVehicleProfile || !hasVehiclePlate;
  const selectedTimeUnavailable = listing?.is_available === false;

  const applyPickedDate = useCallback((field: "start" | "end", next: Date) => {
    if (field === "start") {
      setStartAt(next);
      // Keep the chosen "until" time unless the new "from" passes it
      // (same behaviour as the search screen).
      if (next > endAt) {
        const bumped = new Date(next);
        bumped.setHours(bumped.getHours() + 2);
        setEndAt(bumped);
      }
      return;
    }
    // For the "until" picker: enforce at least 1 h after "from".
    const minEnd = new Date(startAt);
    minEnd.setHours(minEnd.getHours() + 1);
    const safeEnd = next < minEnd ? minEnd : next;
    setEndAt(safeEnd);
  }, [endAt, startAt]);

  const openPicker = useCallback((field: "start" | "end") => {
    setPickerField(field);
    setPickerVisible(true);
  }, []);

  const pickerMinimumDate = useMemo(
    () =>
      pickerField === "start"
        ? roundUpToMinuteInterval(new Date(), 5)
        : addMinutes(startAt, 60),
    [pickerField, startAt]
  );

  const pickerQuickOptions = useMemo(() => {
    if (pickerField === "end") {
      return [1, 2, 4, 8].map((hours) => ({
        label: `${hours}h`,
        value: addMinutes(startAt, hours * 60),
      }));
    }
    const now = roundUpToMinuteInterval(new Date(), 5);
    return [
      { label: "Now", value: now },
      { label: "+30m", value: addMinutes(now, 30) },
      { label: "+1h", value: addMinutes(now, 60) },
    ];
  }, [pickerField, startAt]);

  const isAmbiguousPaymentSheetResultError = (message?: string | null) =>
    typeof message === "string" &&
    message.toLowerCase().includes("failed to retrieve a paymentsheetresult");

  const scheduleBookingReminders = useCallback(async () => {
    if (!listing) return;
    let permissions = await Notifications.getPermissionsAsync();
    if (!permissions.granted && permissions.canAskAgain) {
      permissions = await Notifications.requestPermissionsAsync();
    }
    if (!permissions.granted) {
      logWarn("Booking reminders skipped: notification permission not granted");
      // Don't fail silently: the user expects start/end reminders for this
      // booking. Missing the end-time one can mean a fine, so offer Settings.
      Alert.alert(
        "Reminders are off",
        "Your booking is confirmed, but we can't remind you before it starts or ends. Enable notifications in Settings to get parking reminders.",
        [
          { text: "Not now", style: "cancel" },
          { text: "Open Settings", onPress: () => void Linking.openSettings() },
        ]
      );
      return;
    }

    // All booking notifications — the "Booking confirmed" message plus the
    // start/end reminders — are sent server-side (sendBookingStatusPush +
    // scheduled_notifications/notification processor). That keeps a single
    // source of truth, avoids duplicate notifications, works cross-device, and
    // stays correct if the booking is extended or cancelled. We only ensure
    // notification permission here so those pushes can be shown.
  }, []);

  const handlePayment = async () => {
    if (!listing || !priceSummary || !token || bookingConfirmed) return;
    if (selectedTimeUnavailable) {
      if (isMonthly) {
        // The month term is set on the listing screen — send them back to pick
        // a different start date rather than opening an hourly time picker.
        showPaymentRecovery("This space is fully booked for that month. Pick another start date.", "bookings");
        return;
      }
      showPaymentRecovery("That time is unavailable. Choose another arrival time.", "time");
      openPicker("start");
      return;
    }
    setBookingBusy(true);
    setError(null);
    clearPaymentRecovery();
    bookingTimeoutRef.current = setTimeout(() => {
      setBookingBusy(false);
      showPaymentRecovery(
        "Still checking this booking. Open My bookings before paying again.",
        "bookings"
      );
      bookingTimeoutRef.current = null;
    }, 45_000);
    let didConfirm = false;
    let paymentCompleted = false;
    try {
      logInfo("Booking started", {
        listingId: listing.id,
        from: startAt.toISOString(),
        to: endAt.toISOString(),
      });
      void trackEvent("mobile_booking_started", {
        listingId: listing.id,
        from: startAt.toISOString(),
        to: endAt.toISOString(),
        amountCents: pricing.finalCents,
      });
      const payment = await createBookingPaymentIntent({
        listingId: listing.id,
        from: startAt.toISOString(),
        to: endAt.toISOString(),
        amountCents: pricing.finalCents,
        mode: isMonthly ? "monthly" : undefined,
        vehiclePlate: vehiclePlate.trim().toUpperCase() || undefined,
        promoCode: appliedPromo?.code ?? undefined,
        token,
      });
      const paymentIntentId = payment.paymentIntentId ?? "";
      if (isMobileE2EActive()) {
        setConfirmingBooking(true);
        await confirmBookingPayment({ paymentIntentId, token });
        didConfirm = true;
        setBookingConfirmed(true);
        setConfirmingBooking(false);
        resetGlobalLoading();
        void trackEvent("mobile_booking_confirmed", {
          listingId: listing.id,
          paymentIntentId,
          amountCents: pricing.finalCents,
        });
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [
              {
                name: "Tabs",
                params: {
                  screen: "History",
                  params: {
                    showSuccess: true,
                    refreshToken: Date.now(),
                    initialTab: "upcoming",
                  },
                },
              },
            ],
          })
        );
        return;
      }
      const initResult = await initPaymentSheet({
        merchantDisplayName: "FreeSpace",
        customerId: payment.customerId,
        customerEphemeralKeySecret: payment.ephemeralKeySecret,
        paymentIntentClientSecret: payment.paymentIntentClientSecret,
        allowsDelayedPaymentMethods: false,
        applePay: { merchantCountryCode: "IE" },
        googlePay: googlePayConfig,
      });
      if (initResult.error) {
        logWarn("Payment sheet init failed", {
          paymentIntentId,
          code: initResult.error.code,
          message: initResult.error.message,
        });
        if (paymentIntentId) {
          try {
            await confirmBookingPayment({ paymentIntentId, status: "canceled", token });
          } catch {
            // Ignore cancellation failures; booking cleanup is best-effort.
          }
        }
        showPaymentRecovery("Couldn’t start payment. Try again.", "retry");
        return;
      }
      const presentResult = await presentPaymentSheet();
      if (presentResult.error) {
        logWarn("Payment sheet present failed", {
          paymentIntentId,
          code: presentResult.error.code,
          message: presentResult.error.message,
        });
        let isAmbiguousResult = isAmbiguousPaymentSheetResultError(presentResult.error.message);
        if (isAmbiguousResult && paymentIntentId) {
          logWarn("Payment sheet result was ambiguous; attempting booking confirmation recovery", {
            paymentIntentId,
            code: presentResult.error.code,
            message: presentResult.error.message,
          });
          try {
            setConfirmingBooking(true);
            await confirmBookingPayment({ paymentIntentId, token });
            didConfirm = true;
            setBookingConfirmed(true);
            setConfirmingBooking(false);
            resetGlobalLoading();
            const nowMs = Date.now();
            const initialTab =
              startAt.getTime() <= nowMs && nowMs < endAt.getTime()
                ? "active"
                : "upcoming";
            void scheduleBookingReminders().catch((notificationError) => {
              logWarn("Booking reminder scheduling failed", {
                message: notificationError instanceof Error ? notificationError.message : String(notificationError),
              });
            });
            navigation.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [
                  {
                    name: "Tabs",
                    params: {
                      screen: "History",
                      params: {
                        showSuccess: true,
                        refreshToken: Date.now(),
                        initialTab,
                      },
                    },
                  },
                ],
              })
            );
            return;
          } catch (recoveryError) {
            const recoveryMsg = recoveryError instanceof Error ? recoveryError.message : "";
            logWarn("Payment sheet recovery confirmation failed", {
              paymentIntentId,
              message: recoveryMsg,
            });
            setConfirmingBooking(false);
            // If Stripe confirmed the payment was never made, it’s not actually ambiguous.
            if (/requires_payment_method|requires_action/i.test(recoveryMsg)) {
              isAmbiguousResult = false;
            }
          }
        }
        if (paymentIntentId) {
          try {
            await confirmBookingPayment({ paymentIntentId, status: "canceled", token });
          } catch {
            // Ignore cancellation failures; booking cleanup is best-effort.
          }
        }
        if (presentResult.error.code === "Canceled") {
          // User dismissed the payment sheet — not an error, so no user-facing
          // message, but it's the one abandonment point in the funnel with no
          // visibility otherwise (no error, no confirmation, silent return).
          void trackEvent("mobile_payment_sheet_abandoned", {
            listingId: listing.id,
            amountCents: pricing.finalCents,
          });
          return;
        }
        showPaymentRecovery(
          isAmbiguousResult
            ? "Still checking this booking. Open My bookings before paying again."
            : "Payment not completed. No booking was created.",
          isAmbiguousResult ? "bookings" : "retry"
        );
        return;
      }
      paymentCompleted = true;
      const confirmWithRetry = async () => {
        const attempts = [0, 400, 900];
        let lastError: unknown;
        for (const delay of attempts) {
          if (delay) {
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
          try {
            await confirmBookingPayment({ paymentIntentId, token });
            return;
          } catch (err) {
            if (
              err instanceof Error &&
              err.message.toLowerCase().includes("time slot already booked")
            ) {
              throw err;
            }
            lastError = err;
          }
        }
        throw lastError instanceof Error ? lastError : new Error("Payment confirmation failed");
      };
      setConfirmingBooking(true);
      await confirmWithRetry();
      didConfirm = true;
      setBookingConfirmed(true);
      setConfirmingBooking(false);
      resetGlobalLoading();
      void trackEvent("mobile_booking_confirmed", {
        listingId: listing.id,
        paymentIntentId,
        amountCents: pricing.finalCents,
      });
      const nowMs = Date.now();
      const initialTab =
        startAt.getTime() <= nowMs && nowMs < endAt.getTime()
          ? "active"
          : "upcoming";
      void scheduleBookingReminders().catch((notificationError) => {
        logWarn("Booking reminder scheduling failed", {
          message: notificationError instanceof Error ? notificationError.message : String(notificationError),
        });
      });
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [
            {
              name: "Tabs",
              params: {
                screen: "History",
                params: {
                  showSuccess: true,
                  refreshToken: Date.now(),
                  initialTab,
                },
              },
            },
          ],
        })
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Booking failed";
      logError("Booking error", { message });
      void trackEvent("mobile_booking_failed", {
        listingId: listing?.id ?? id,
        message,
      });
      if (message.toLowerCase().includes("time slot already booked")) {
        showPaymentRecovery(
          "That slot was just taken. Choose another time.",
          "time"
        );
        setError(null);
        return;
      }
      if (paymentCompleted) {
        // The payment sheet succeeded; only the confirmation call failed.
        // Send users to their bookings instead of asking them to pay again.
        showPaymentRecovery(
          "Payment received. We're still confirming your booking. Check My bookings now.",
          "bookings"
        );
        setError(null);
        return;
      }
      setError(message);
    } finally {
      if (bookingTimeoutRef.current) {
        clearTimeout(bookingTimeoutRef.current);
        bookingTimeoutRef.current = null;
      }
      setConfirmingBooking(false);
      if (!didConfirm) {
        setBookingBusy(false);
      }
    }
  };

  const ctaLabel = selectedTimeUnavailable
    ? isMonthly
      ? "Choose another date"
      : "Choose another time"
    : confirmingBooking
      ? "Confirming…"
      : "Confirm and pay";
  const ctaDisabled =
    bookingBusy || bookingConfirmed || (!selectedTimeUnavailable && requiresVehicleDetails);

  /**
   * `autoPay` means the caller already showed a review step and the driver
   * already tapped pay, so we open the Stripe sheet on arrival rather than
   * asking them to confirm the same booking a second time.
   *
   * Guarded by a ref so it can fire exactly once — this starts a charge, and
   * an effect that re-ran would create a second payment intent. If the CTA is
   * disabled (missing vehicle, slot gone, signed out) nothing fires and the
   * driver simply lands on this screen, which is the safe fallback.
   */
  // PROTOTYPE (12a): the review layout, rendered by this screen so Pay is the
  // same button it always was — `handlePayment`, unchanged. Nothing about the
  // charge moves; only what sits above it.
  /**
   * The review layout is the confirm page — not an alternative to it.
   *
   * It used to sit behind a `review` param that only the listing passed, so a
   * driver who signed in mid-flow, or came back from the vehicle screen, got
   * the old summary instead: one booking, two visual identities. Rendering it
   * whenever there is a listing to review removes that entirely.
   *
   * Payment recovery renders here too, as a notice above the booking. It used
   * to fall through to the old summary, which meant a driver whose payment
   * failed saw a different design at the worst possible moment.
   *
   * What remains below handles only what this body cannot be: still loading,
   * signed out, or no listing at all. Those are states, not a second design.
   */
  if (listing && !loadingListing && user) {
    return (
      <BookingReviewBody
        onClose={() => goBackOrFallback(navigation, fallbackRoutes.search)}
        onContinue={handlePayment}
        onChangeTimes={() => openPicker("start")}
        onChangeVehicle={() => navigation.navigate("VehicleType", { returnTo: "BookingSummary" })}
        title={listing.title || "Parking space"}
        locationLabel={addressLine ?? ""}
        address={listing.address ?? ""}
        imageUri={listing.image_urls?.[0]}
        rating={listing.rating ?? null}
        ratingCount={listing.rating_count ?? 0}
        startAt={startAt}
        endAt={endAt}
        priceSummary={priceSummary}
        notice={
          paymentFailureMessage
            ? {
                message: paymentFailureMessage,
                actionLabel:
                  paymentRecoveryAction === "bookings"
                    ? "Open my bookings"
                    : paymentRecoveryAction === "time"
                      ? "Pick another time"
                      : paymentRecoveryAction === "retry"
                        ? "Try again"
                        : undefined,
                onAction:
                  paymentRecoveryAction === "bookings"
                    ? () => resetToSafeRoute(navigation, fallbackRoutes.bookings)
                    : paymentRecoveryAction === "time"
                      ? () => openPicker("start")
                      : paymentRecoveryAction === "retry"
                        ? () => {
                            clearPaymentRecovery();
                            void handlePayment();
                          }
                        : undefined,
              }
            : null
        }
        promo={{
          code: appliedPromo?.code ?? null,
          input: promoInput,
          onInput: setPromoInput,
          onApply: () => void applyPromo(),
          busy: promoBusy,
          error: promoError,
        }}
        vehicleMake={vehicleMake}
        vehicleLine={vehicleLine}
        vehiclePlate={vehiclePlate}
        payBlockedReason={
          requiresVehicleDetails
            ? "Add your vehicle to continue"
            : selectedTimeUnavailable
              ? "This space is no longer free"
              : bookingBusy
                ? "Starting payment…"
                : undefined
        }
      />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      >
        {/* The skeleton mirrors the real layout — masthead, then the ground's
            headers and tiles. No spinner, no invented delay. */}
        {loadingListing ? (
          <ScrollView style={styles.flex} contentContainerStyle={styles.skeletonContent} scrollEnabled={false}>
            <SkeletonBlock width={36} height={36} borderRadius={18} pulse={skeletonPulse} />
            <SkeletonBlock width="55%" height={28} borderRadius={8} pulse={skeletonPulse} style={{ marginTop: 14 }} />
            <SkeletonBlock width="70%" height={14} borderRadius={5} pulse={skeletonPulse} style={{ marginTop: 8 }} />
            {[0, 1, 2].map((row) => (
              <SkeletonBlock
                key={row}
                height={44}
                borderRadius={6}
                pulse={skeletonPulse}
                style={{ marginTop: 16 }}
              />
            ))}
          </ScrollView>
        ) : !user ? (
          <View style={styles.centered}>
            <Text style={styles.centeredTitle}>Sign in to continue</Text>
            <Text style={styles.centeredSubtitle}>Log in or create an account to confirm your booking.</Text>
            <View style={styles.authButtons}>
              <Button style={styles.authButton} onPress={() => navigation.navigate("Auth", { screen: "SignIn", params: { returnTo: { screen: "BookingSummary" as const, params: route.params } } })} title="Sign in" />
              <Button variant="secondary" style={styles.authButton} onPress={() => navigation.navigate("Auth", { screen: "Register", params: { returnTo: { screen: "BookingSummary" as const, params: route.params } } })} title="Create account" />
            </View>
          </View>
        ) : (
          <View style={styles.centered}>
            <Text style={styles.muted}>Listing not found.</Text>
          </View>
        )}
      </KeyboardAvoidingView>

      <ModernTimePickerSheet
        visible={pickerVisible}
        title={pickerField === "start" ? "Arrival time" : "Departure time"}
        subtitle={pickerField === "end" ? `Arriving ${formatTimeLabel(startAt)}` : "Pick a date, hour and minute."}
        value={pickerField === "start" ? start : end}
        minimumDate={pickerMinimumDate}
        minuteInterval={5}
        quickOptions={pickerQuickOptions}
        confirmLabel={pickerField === "start" ? "Use arrival" : "Use departure"}
        onCancel={() => setPickerVisible(false)}
        onConfirm={(next) => {
          applyPickedDate(pickerField, next);
          setPickerVisible(false);
        }}
      />
      {bookingConfirmed ? <View style={styles.successOverlay} pointerEvents="none" /> : null}
    </SafeAreaView>
  );
}

// Sourced from styles/theme.ts. CARD_SHADOW is gone: the sticky dock is the
// only elevated surface on this screen; everything else is a flat tile whose
// border does the separating.
const GREEN    = colors.primary;
const FG       = colors.text;
const MUTED    = colors.textMuted;
const SUBTLE   = colors.textSoft;
// #DDE2E2 per the funnel design: light enough to describe a tile edge without
// drawing a line around it. `colors.border` (#C7CFCF) reads as an outline here.
const EDGE     = colors.borderHairline;
const GROUND   = colors.ground;   // page tint + in-tile hairlines

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.appBg },
  flex: { flex: 1 },

  // ── Skeleton ─────────────────────────────────────────────────
  skeletonContent: { paddingHorizontal: 16, paddingTop: 13 },

  // ── White masthead sheet ─────────────────────────────────────
  // Back button sits inline with the title rather than stacked above it, so the
  // header costs one row instead of three.
  // White panel; the ground below does the separating.

  // ── Fact stack ───────────────────────────────────────────────
  // 2a: gap 12, 15 vertical padding, icon nudged 1 to sit on the first line.
  // flex-start rather than centre because this row stacks a name, an address
  // and a note — the icon aligns to the first line, not to the block.
  // The booking window is the fact people re-read most on this screen, so it
  // gets a step of its own above the rest of the stack.
  // The space's own name leads; the street sits under it in grey, the way the
  // confirm screen presents it.
  // 2a: 12px #7C8383, 2 under the line it qualifies.

  // ── When: arriving / leaving ─────────────────────────────────
  // Same edge and radius as `tile` (payment details) — every card on the ground
  // shares one border treatment.
  // 2a: 14 / 16 / 15.
  // Inset top and bottom rather than full height, so the rule separates the two
  // fields without touching the card's own edges.
  // 2a: 7px dots, filled for arrival and 1.5px-outlined for departure.
  // 2a: 27/29, 800, -1.1.

  // ── Ground ───────────────────────────────────────────────────
  // Hairline where the white blocks meet the tint, matching the listing page —
  // without it the two surfaces fade into each other.

  // Tiles — sharper than the mock's 8: a 4px corner over a 1px `border` grey
  // reads crisp on the tint instead of soft.

  // ── Price rows ───────────────────────────────────────────────

  // ── Promo ────────────────────────────────────────────────────

  // ── Pay with ─────────────────────────────────────────────────

  // ── Notices ──────────────────────────────────────────────────

  // ── Trust + legal ────────────────────────────────────────────

  // ── Sticky dock — the one elevated surface ───────────────────

  // ── Empty / auth states ─────────────────────────────────────
  centered: { alignItems: "center", flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  centeredTitle: {
    fontFamily: "PlusJakartaSans-ExtraBold", fontSize: 20, lineHeight: 25,
    letterSpacing: -0.6, color: FG, textAlign: "center",
  },
  centeredSubtitle: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 13, lineHeight: 19,
    color: MUTED, marginTop: 10, textAlign: "center",
  },
  muted: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, lineHeight: 19, color: MUTED },
  authButtons: { marginTop: 16, width: "100%", maxWidth: 320, gap: 12 },
  authButton: { width: "100%" },

  // ── Overlay ─────────────────────────────────────────────────
  successOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15, 23, 42, 0.35)" },
});
