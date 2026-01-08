import { CommonActions } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
  const [paymentMethod, setPaymentMethod] = useState<"card" | "google">("card");

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

  const handlePayment = async () => {
    if (!listing || !priceSummary || !token) return;
    setBookingBusy(true);
    setError(null);
    try {
      logInfo("Booking started", { listingId: listing.id, from, to });
      const payment = await createBookingPaymentIntent({
        listingId: listing.id,
        from,
        to,
        amountCents: priceSummary.totalCents,
        token,
      });
      const paymentIntentId = payment.paymentIntentId ?? "";
      const initResult = await initPaymentSheet({
        merchantDisplayName: "CarParking",
        customerId: payment.customerId,
        customerEphemeralKeySecret: payment.ephemeralKeySecret,
        paymentIntentClientSecret: payment.paymentIntentClientSecret,
        allowsDelayedPaymentMethods: false,
      });
      if (initResult.error) {
        if (paymentIntentId) {
          try {
            await confirmBookingPayment({ paymentIntentId, status: "canceled", token });
          } catch {
            // Ignore cancellation failures; booking cleanup is best-effort.
          }
        }
        throw new Error(initResult.error.message ?? "Payment setup failed");
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
          setError("Payment canceled.");
          return;
        }
        const detail = presentResult.error.code
          ? `${presentResult.error.message ?? "Payment failed"} (${presentResult.error.code})`
          : presentResult.error.message ?? "Payment failed";
        throw new Error(detail);
      }
      await confirmBookingPayment({
        paymentIntentId,
        token,
      });
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Booking confirmed",
          body: "Your reservation is saved in Upcoming.",
        },
        trigger: null,
      });
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: "History", params: { showSuccess: true } }],
        })
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Booking failed";
      logError("Booking error", { message });
      setError(message);
    } finally {
      setBookingBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
        <Text style={styles.topTitle}>Booking summary</Text>
        <View style={styles.backButton} />
      </View>
      {loadingListing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="small" color="#00d4aa" />
          <Text style={styles.muted}>Loading listing…</Text>
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
            <Text style={styles.cardTitle}>Parking location</Text>
            <Text style={styles.cardSubtitle}>Confirm the spot details below.</Text>
            <View style={styles.locationBlock}>
              <Text style={styles.locationTitle}>{listing.title}</Text>
              <Text style={styles.locationSubtitle}>{listing.address}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Session details</Text>
            <Text style={styles.cardSubtitle}>Review the dates and duration.</Text>
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
          </View>

          {priceSummary ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Price breakdown</Text>
              <Text style={styles.cardSubtitle}>All fees are included.</Text>
              <View style={styles.detailList}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>RATE</Text>
                  <Text style={styles.detailValue}>€{listing.price_per_day} / day</Text>
                </View>
                <View style={[styles.detailRow, styles.detailRowBorder]}>
                  <Text style={styles.detailLabel}>BILLING</Text>
                  <Text style={styles.detailValue}>{priceSummary.days} day(s)</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>TOTAL</Text>
                  <Text style={styles.totalValue}>€{priceSummary.total.toFixed(2)}</Text>
                </View>
              </View>
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Cancellation policy</Text>
            <Text style={styles.sectionBody}>
              Cancel up to 2 hours before the start for a full refund.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Payment method</Text>
            <Text style={styles.cardSubtitle}>Choose how you want to pay.</Text>
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
          <Pressable
            style={[styles.bottomButton, bookingBusy && styles.bottomButtonDisabled]}
            onPress={handlePayment}
            disabled={bookingBusy}
          >
            <Text style={styles.bottomButtonText}>
              {bookingBusy
                ? "Processing..."
                : paymentMethod === "google"
                  ? "Buy with Google Pay"
                  : "Pay & reserve"}
            </Text>
          </Pressable>
        </View>
      ) : null}
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
    borderColor: "#e5e7eb",
    borderRadius: 16,
    borderWidth: 1,
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
  cardSubtitle: {
    color: "#6b7280",
    fontSize: 13,
    marginTop: 6,
  },
  sectionBody: {
    color: "#6b7280",
    fontSize: 13,
    marginTop: 10,
    lineHeight: 18,
  },
  locationBlock: {
    borderColor: "#e5e7eb",
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
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
    borderColor: "#e5e7eb",
    borderRadius: 12,
    borderWidth: 1,
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
    borderColor: "#e5e7eb",
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
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
