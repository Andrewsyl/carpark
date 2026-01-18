import { CommonActions, useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useStripe } from "@stripe/stripe-react-native";
import * as Notifications from "expo-notifications";
import DatePicker from "react-native-date-picker";
import { Ionicons } from "@expo/vector-icons";
import { cardShadow, colors, radius, spacing, textStyles } from "../styles/theme";
import {
  confirmBookingPayment,
  createBookingPaymentIntent,
  getListing,
} from "../api";
import { useAuth } from "../auth";
import { logError, logInfo } from "../logger";
import { getNotificationImageAttachment } from "../notifications";
import { BookingProgressBar } from "../components/BookingProgressBar";
import type { ListingDetail, RootStackParamList } from "../types";
import { formatDateLabel, formatTimeLabel } from "../utils/dateFormat";

type Props = NativeStackScreenProps<RootStackParamList, "BookingSummary">;

const formatDateTimeLabel = (date: Date) => `${formatDateLabel(date)} · ${formatTimeLabel(date)}`;

const snapTo5Minutes = (date: Date) => {
  const next = new Date(date);
  const minutes = next.getMinutes();
  const snapped = Math.round(minutes / 5) * 5;
  next.setMinutes(snapped, 0, 0);
  return next;
};

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
  const [startAt, setStartAt] = useState(() => new Date(from));
  const [endAt, setEndAt] = useState(() => new Date(to));
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerField, setPickerField] = useState<"start" | "end">("start");
  const [draftDate, setDraftDate] = useState<Date | null>(null);

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
    setStartAt(new Date(from));
    setEndAt(new Date(to));
  }, [from, to]);

  const start = useMemo(() => startAt, [startAt]);
  const end = useMemo(() => endAt, [endAt]);
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

  const openPicker = (field: "start" | "end") => {
    setPickerField(field);
    const current = field === "start" ? startAt : endAt;
    setDraftDate(current);
    setPickerVisible(true);
  };

  const applyPickedDate = (next: Date) => {
    if (pickerField === "start") {
      let nextEnd = endAt;
      if (next > endAt) {
        const bumped = new Date(next);
        bumped.setHours(bumped.getHours() + 2);
        nextEnd = bumped;
        setEndAt(bumped);
      }
      setStartAt(next);
      return;
    }
    setEndAt(next);
  };

  const scheduleBookingReminders = useCallback(async () => {
    if (!listing) return;
    const permissions = await Notifications.getPermissionsAsync();
    if (!permissions.granted) return;

    const nowMs = Date.now();
    const startReminder = new Date(start.getTime() - 60 * 60 * 1000);
    const endReminder = new Date(end.getTime() - 30 * 60 * 1000);

    if (startReminder.getTime() > nowMs) {
      const attachments = await getNotificationImageAttachment();
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Booking starts soon",
          body: `${listing.title} starts in 1 hour.`,
          attachments,
        },
        trigger: startReminder,
      });
    }

    if (endReminder.getTime() > nowMs) {
      const attachments = await getNotificationImageAttachment();
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Booking ending soon",
          body: `${listing.title} ends in 30 minutes.`,
          attachments,
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
      logInfo("Booking started", {
        listingId: listing.id,
        from: startAt.toISOString(),
        to: endAt.toISOString(),
      });
      const payment = await createBookingPaymentIntent({
        listingId: listing.id,
        from: startAt.toISOString(),
        to: endAt.toISOString(),
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
      void scheduleBookingReminders().catch(() => {
        // Reminder failures shouldn't block the success flow.
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Booking failed";
      logError("Booking error", { message });
      if (message.toLowerCase().includes("time slot already booked")) {
        setPaymentFailed(true);
        setPaymentFailureMessage(
          "That slot was just booked by someone else. Please choose another time."
        );
        setError(null);
        return;
      }
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
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBackButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          disabled={bookingBusy || bookingConfirmed}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking summary</Text>
      </View>
      <BookingProgressBar currentStep={bookingBusy || confirmingBooking ? 3 : 2} />
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
              <Text style={styles.detailLabel}>TIME</Text>
              <View style={styles.dateRow}>
                <Pressable style={styles.dateTimePill} onPress={() => openPicker("start")}>
                  <Text style={styles.dateTimeText}>{formatDateTimeLabel(start)}</Text>
                </Pressable>
                <View style={styles.dateArrow}>
                  <Text style={styles.dateArrowText}>→</Text>
                </View>
                <Pressable style={styles.dateTimePill} onPress={() => openPicker("end")}>
                  <Text style={styles.dateTimeText}>{formatDateTimeLabel(end)}</Text>
                </Pressable>
              </View>
              <View style={[styles.detailRow, styles.detailRowBorder]}>
                <Text style={styles.detailLabel}>DURATION</Text>
                <Text style={styles.detailValue}>{durationHours} hours</Text>
              </View>
            </View>
            <View style={styles.inputBlock}>
              <Text style={styles.inputLabel}>Vehicle plate (optional)</Text>
              <View style={styles.plateRow}>
                <View style={styles.plateCountry}>
                  <Text style={styles.plateCountryText}>IRL</Text>
                </View>
                <TextInput
                  value={vehiclePlate}
                  onChangeText={(value) =>
                    setVehiclePlate(value.toUpperCase().replace(/\s+/g, " "))
                  }
                  placeholder="12-D-12345"
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={12}
                  style={styles.plateInput}
                />
              </View>
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
      {pickerVisible ? (
        <Modal transparent animationType="fade" visible>
          <Pressable
            style={styles.pickerBackdrop}
            onPress={() => {
              setPickerVisible(false);
              setDraftDate(null);
            }}
          >
            <Pressable style={styles.pickerSheet} onPress={() => undefined}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>
                  {pickerField === "start" ? "Start" : "End"}
                </Text>
                <Pressable
                  style={styles.pickerDone}
                  onPress={() => {
                    setPickerVisible(false);
                    setDraftDate(null);
                  }}
                >
                  <Text style={styles.pickerDoneText}>Done</Text>
                </Pressable>
              </View>
              <DatePicker
                date={draftDate ?? (pickerField === "start" ? start : end)}
                mode="datetime"
                androidVariant="iosClone"
                minuteInterval={5}
                textColor={colors.accent}
                onDateChange={(date) => {
                  const snapped = snapTo5Minutes(date);
                  setDraftDate(snapped);
                  applyPickedDate(snapped);
                }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
      {bookingConfirmed ? <View style={styles.successOverlay} pointerEvents="none" /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.appBg,
    flex: 1,
  },
  header: {
    alignItems: "center",
    backgroundColor: colors.headerTint,
    flexDirection: "row",
    paddingHorizontal: spacing.screenX,
    paddingVertical: 12,
  },
  headerBackButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.screenX,
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
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 6,
    textAlign: "center",
  },
  muted: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 8,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    marginTop: 16,
    padding: spacing.card,
    ...cardShadow,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
  },
  sectionBody: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 10,
    lineHeight: 18,
  },
  noticeCard: {
    backgroundColor: colors.cardBg,
    borderColor: "#fee2e2",
    borderRadius: radius.card,
    borderWidth: 1,
    marginTop: 16,
    padding: spacing.card,
  },
  noticeTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  noticeText: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 6,
    lineHeight: 18,
  },
  locationBlock: {
    marginTop: 12,
  },
  locationTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  locationSubtitle: {
    color: colors.textMuted,
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
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  dateRow: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 12,
    marginTop: 8,
  },
  dateTimePill: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 999,
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  dateTimeText: {
    color: "#101828",
    fontSize: 13,
    fontWeight: "600",
  },
  dateArrow: {
    paddingHorizontal: 8,
  },
  dateArrowText: {
    color: colors.textMuted,
    fontSize: 16,
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  detailValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "right",
  },
  inputBlock: {
    marginTop: 16,
  },
  inputLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  inputField: {
    backgroundColor: colors.appBg,
    borderRadius: 12,
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  plateRow: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d1d5db",
    overflow: "hidden",
    backgroundColor: "#ffffff",
    marginTop: 8,
  },
  plateCountry: {
    width: 54,
    backgroundColor: "#1d4ed8",
    alignItems: "center",
    justifyContent: "center",
  },
  plateCountryText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  plateInput: {
    flex: 1,
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  inputHint: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 6,
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  pickerSheet: {
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    width: "100%",
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  pickerDone: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  pickerDoneText: {
    color: colors.accent,
    fontWeight: "700",
  },
  totalRow: {
    alignItems: "center",
    backgroundColor: "#ecfdf3",
    borderTopColor: colors.border,
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
    ...cardShadow,
  },
  paymentOptionDark: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  paymentOptionActiveDark: {
    backgroundColor: "#0f172a",
  },
  paymentOptionActiveLight: {
    borderColor: colors.accent,
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
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  paymentOptionHint: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  footerSpacer: {
    height: 12,
  },
  bottomBar: {
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.screenX,
    paddingVertical: 14,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  bottomPrice: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "700",
  },
  bottomMeta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  bottomButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 12,
    minHeight: 44,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  bottomButtonDisabled: {
    backgroundColor: colors.textSoft,
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
    color: colors.textMuted,
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
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    paddingHorizontal: 24,
    paddingVertical: 20,
    ...cardShadow,
  },
  successTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  successBody: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 6,
    textAlign: "center",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
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
