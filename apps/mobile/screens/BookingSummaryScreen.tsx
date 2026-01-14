import { CommonActions, useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useStripe } from "@stripe/stripe-react-native";
import * as Notifications from "expo-notifications";
import {
  confirmBookingPayment,
  createBookingPaymentIntent,
  getListing,
} from "../api";
import { useAuth } from "../auth";
import { logError, logInfo } from "../logger";
import type { ListingDetail, RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "BookingSummary">;

export function BookingSummaryScreen({ navigation, route }: Props) {
  const { id, from, to } = route.params;
  const { token, user } = useAuth();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loadingListing, setLoadingListing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [confirmingBooking, setConfirmingBooking] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "google">("card");
  const [paymentFailed, setPaymentFailed] = useState(false);
  const [paymentFailureMessage, setPaymentFailureMessage] = useState<string | null>(null);
  const [vehiclePlate, setVehiclePlate] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoadingListing(true);
      setError(null);
      try {
        const data = await getListing(id);
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
  }, [id]);

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
            routes: [{ name: "Search" }],
          })
        );
        return true;
      };
      const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => subscription.remove();
    }, [bookingBusy, bookingConfirmed, navigation])
  );

  const start = useMemo(() => new Date(from), [from]);
  const end = useMemo(() => new Date(to), [to]);
  const durationHours = useMemo(() => {
    const ms = Math.max(0, end.getTime() - start.getTime());
    return Math.max(1, Math.ceil(ms / (1000 * 60 * 60)));
  }, [end, start]);

  const priceSummary = useMemo(() => {
    if (!listing) return null;
    const days = Math.max(1, Math.ceil(durationHours / 24));
    const total = listing.price_per_day * days;
    return { days, total, totalCents: Math.round(total * 100) };
  }, [durationHours, listing]);

  const scheduleBookingReminders = useCallback(async () => {
    if (!listing) return;
    const permissions = await Notifications.getPermissionsAsync();
    if (!permissions.granted) return;

    const nowMs = Date.now();
    const startReminder = new Date(start.getTime() - 60 * 60 * 1000);
    const endReminder = new Date(end.getTime() - 30 * 60 * 1000);

    if (startReminder.getTime() > nowMs) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Booking starts soon",
          body: `${listing.title} starts in 1 hour.`,
        },
        trigger: startReminder,
      });
    }

    if (endReminder.getTime() > nowMs) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Booking ending soon",
          body: `${listing.title} ends in 30 minutes.`,
        },
        trigger: endReminder,
      });
    }
  }, [end, listing, start]);

  const handlePayment = async () => {
    if (!listing || !priceSummary || !token || bookingConfirmed) return;
    setBookingBusy(true);
    setError(null);
    setPaymentFailed(false);
    setPaymentFailureMessage(null);
    let didConfirm = false;
    try {
      logInfo("Booking started", { listingId: listing.id, from, to });
      const payment = await createBookingPaymentIntent({
        listingId: listing.id,
        from,
        to,
        amountCents: priceSummary.totalCents,
        vehiclePlate: vehiclePlate.trim() ? vehiclePlate.trim() : undefined,
        token,
      });
      const paymentIntentId = payment.paymentIntentId ?? "";
      const initResult = await initPaymentSheet({
        merchantDisplayName: "CarParking",
        customerId: payment.customerId,
        customerEphemeralKeySecret: payment.ephemeralKeySecret,
        paymentIntentClientSecret: payment.paymentIntentClientSecret,
        allowsDelayedPaymentMethods: false,
        returnURL: "carparking://stripe-redirect",
      });
      if (initResult.error) {
        if (paymentIntentId) {
          try {
            await confirmBookingPayment({ paymentIntentId, status: "canceled", token });
          } catch {
            // Ignore cancellation failures; booking cleanup is best-effort.
          }
        }
        setPaymentFailed(true);
        setPaymentFailureMessage("We couldn’t start the payment. Please try again.");
        return;
      }
      const presentResult = await presentPaymentSheet();
      if (presentResult.error) {
        if (paymentIntentId) {
          try {
            await confirmBookingPayment({ paymentIntentId, status: "canceled", token });
          } catch {
            // Ignore cancellation failures; booking cleanup is best-effort.
          }
        }
        if (presentResult.error.code === "Canceled") {
          setPaymentFailed(true);
          setPaymentFailureMessage("Payment canceled. You can try again anytime.");
          return;
        }
        setPaymentFailed(true);
        setPaymentFailureMessage(
          presentResult.error.message ?? "Payment failed. Please try again."
        );
        return;
      }
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
      try {
        await scheduleBookingReminders();
      } catch {
        // Reminder failures shouldn't block the success flow.
      }
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Booking confirmed",
            body: "Your reservation is saved in Upcoming.",
          },
          trigger: null,
        });
      } catch {
        // Notification failures shouldn't block the success flow.
      }
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [
            {
              name: "History",
              params: {
                showSuccess: true,
                refreshToken: Date.now(),
                initialTab: "upcoming",
              },
            },
          ],
        })
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Booking failed";
      logError("Booking error", { message });
      setError(message);
    } finally {
      setConfirmingBooking(false);
      if (!didConfirm) {
        setBookingBusy(false);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable
          style={styles.backButton}
          onPress={() =>
            navigation.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: "Search" }],
              })
            )
          }
          disabled={bookingBusy || bookingConfirmed}
        >
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
        <Text style={styles.topTitle}>Booking summary</Text>
        <View style={styles.backButton} />
      </View>
      {loadingListing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="small" color="#00d4aa" />
          <Text style={styles.muted}>Loading booking…</Text>
        </View>
      ) : !user ? (
        <View style={styles.centered}>
          <Text style={styles.title}>Sign in to continue</Text>
          <Text style={styles.subtitle}>Log in to confirm your booking.</Text>
          <Pressable style={styles.primaryButton} onPress={() => navigation.navigate("SignIn")}>
            <Text style={styles.primaryButtonText}>Sign in</Text>
          </Pressable>
        </View>
      ) : listing ? (
        <ScrollView contentContainerStyle={styles.content}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Confirm your booking</Text>
            <View style={styles.locationBlock}>
              <Text style={styles.locationTitle}>{listing.title}</Text>
              <Text style={styles.locationSubtitle}>{listing.address}</Text>
            </View>
            <View style={styles.detailList}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>START</Text>
                <Text style={styles.detailValue}>{start.toLocaleString()}</Text>
              </View>
              <View style={[styles.detailRow, styles.detailRowBorder]}>
                <Text style={styles.detailLabel}>END</Text>
                <Text style={styles.detailValue}>{end.toLocaleString()}</Text>
              </View>
              <View style={[styles.detailRow, styles.detailRowBorder]}>
                <Text style={styles.detailLabel}>DURATION</Text>
                <Text style={styles.detailValue}>{durationHours} hours</Text>
              </View>
            </View>
            <View style={styles.inputBlock}>
              <Text style={styles.inputLabel}>Vehicle plate (optional)</Text>
              <TextInput
                value={vehiclePlate}
                onChangeText={(value) => setVehiclePlate(value.toUpperCase().replace(/\s+/g, " "))}
                placeholder="e.g. 12-D-12345"
                placeholderTextColor="#94a3b8"
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={12}
                style={styles.inputField}
              />
              <Text style={styles.inputHint}>Share your plate with the host for easy access.</Text>
            </View>
            {priceSummary ? (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>TOTAL</Text>
                <Text style={styles.totalValue}>€{priceSummary.total.toFixed(2)}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Cancellation policy</Text>
            <Text style={styles.sectionBody}>
              Cancel up to 2 hours before the start for a full refund.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Payment method</Text>
            <View style={styles.paymentStack}>
              <Pressable
                onPress={() => setPaymentMethod("google")}
                style={[
                  styles.paymentOption,
                  styles.paymentOptionDark,
                  paymentMethod === "google" && styles.paymentOptionActiveDark,
                ]}
              >
                <Text style={styles.paymentOptionTextDark}>Google Pay</Text>
                <Text style={styles.paymentOptionHintDark}>Fast checkout</Text>
              </Pressable>
              <Pressable
                onPress={() => setPaymentMethod("card")}
                style={[
                  styles.paymentOption,
                  paymentMethod === "card" && styles.paymentOptionActiveLight,
                ]}
              >
                <Text style={styles.paymentOptionText}>Add card</Text>
                <Text style={styles.paymentOptionHint}>Secure payment</Text>
              </Pressable>
            </View>
          </View>
          {paymentFailed ? (
            <View style={styles.noticeCard}>
              <Text style={styles.noticeTitle}>Payment didn’t go through</Text>
              <Text style={styles.noticeText}>
                {paymentFailureMessage ?? "Please try again or use another payment method."}
              </Text>
            </View>
          ) : null}
          <View style={styles.footerSpacer} />
        </ScrollView>
      ) : (
        <View style={styles.centered}>
          <Text style={styles.error}>Listing not found.</Text>
        </View>
      )}
      {listing && user ? (
        <View style={styles.bottomBar}>
          <View>
            <Text style={styles.bottomPrice}>
              €{priceSummary ? priceSummary.total.toFixed(2) : "--"}
            </Text>
            <Text style={styles.bottomMeta}>{durationHours} hours</Text>
          </View>
          <View style={styles.buttonStack}>
            <Pressable
              style={[
                styles.bottomButton,
                (bookingBusy || bookingConfirmed) && styles.bottomButtonDisabled,
              ]}
              onPress={handlePayment}
              disabled={bookingBusy || bookingConfirmed}
            >
              <Text style={styles.bottomButtonText}>
                {bookingBusy
                  ? confirmingBooking
                    ? "Finalizing..."
                    : "Processing..."
                  : paymentFailed
                    ? "Try again"
                    : paymentMethod === "google"
                      ? "Buy with Google Pay"
                      : "Pay & reserve"}
              </Text>
            </Pressable>
            {confirmingBooking ? (
              <Text style={styles.bottomStatus}>Finalizing your booking…</Text>
            ) : null}
          </View>
        </View>
      ) : null}
      {bookingConfirmed ? <View style={styles.successOverlay} pointerEvents="none" /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#f9fafb",
    flex: 1,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  backButton: {
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  backLabel: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "700",
  },
  topTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "700",
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 140,
    paddingTop: 12,
  },
  centered: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  title: {
    color: "#0f172a",
    fontSize: 20,
    fontWeight: "800",
  },
  subtitle: {
    color: "#6b7280",
    fontSize: 13,
    marginTop: 6,
    textAlign: "center",
  },
  muted: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 8,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    marginTop: 16,
    padding: 20,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  cardTitle: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "700",
  },
  sectionBody: {
    color: "#6b7280",
    fontSize: 13,
    marginTop: 10,
    lineHeight: 18,
  },
  noticeCard: {
    backgroundColor: "#ffffff",
    borderColor: "#fee2e2",
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 16,
    padding: 16,
  },
  noticeTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
  },
  noticeText: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 6,
    lineHeight: 18,
  },
  locationBlock: {
    marginTop: 12,
  },
  locationTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
  },
  locationSubtitle: {
    color: "#6b7280",
    fontSize: 13,
    marginTop: 4,
  },
  detailList: {
    marginTop: 14,
    overflow: "hidden",
  },
  detailRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  detailRowBorder: {
    borderTopColor: "#e5e7eb",
    borderTopWidth: 1,
  },
  detailLabel: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  detailValue: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "right",
  },
  inputBlock: {
    marginTop: 16,
  },
  inputLabel: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  inputField: {
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    color: "#111827",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputHint: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 6,
  },
  totalRow: {
    alignItems: "center",
    backgroundColor: "#ecfdf3",
    borderTopColor: "#e5e7eb",
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  totalLabel: {
    color: "#059669",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  totalValue: {
    color: "#047857",
    fontSize: 16,
    fontWeight: "700",
  },
  paymentStack: {
    marginTop: 14,
  },
  paymentOption: {
    borderRadius: 12,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  paymentOptionDark: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  paymentOptionActiveDark: {
    backgroundColor: "#0f172a",
  },
  paymentOptionActiveLight: {
    borderColor: "#10b981",
    backgroundColor: "#ecfdf3",
  },
  paymentOptionTextDark: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  paymentOptionHintDark: {
    color: "#d1d5db",
    fontSize: 12,
    marginTop: 4,
  },
  paymentOptionText: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
  },
  paymentOptionHint: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 4,
  },
  footerSpacer: {
    height: 12,
  },
  bottomBar: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderTopColor: "#e5e7eb",
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  bottomPrice: {
    color: "#111827",
    fontSize: 26,
    fontWeight: "700",
  },
  bottomMeta: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 2,
  },
  bottomButton: {
    alignItems: "center",
    backgroundColor: "#10b981",
    borderRadius: 12,
    minHeight: 44,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  bottomButtonDisabled: {
    backgroundColor: "#cbd5e1",
  },
  bottomButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  buttonStack: {
    alignItems: "flex-end",
  },
  bottomStatus: {
    color: "#6b7280",
    fontSize: 11,
    marginTop: 6,
  },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.35)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  successCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingVertical: 20,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  successTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  successBody: {
    color: "#6b7280",
    fontSize: 13,
    marginTop: 6,
    textAlign: "center",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#00d4aa",
    borderRadius: 12,
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  error: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderRadius: 12,
    borderWidth: 1,
    color: "#b42318",
    fontSize: 12,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
