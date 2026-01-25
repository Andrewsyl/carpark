import { CommonActions, useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Switch,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useStripe } from "@stripe/stripe-react-native";
import * as Notifications from "expo-notifications";
import DatePicker from "react-native-date-picker";
import { Ionicons } from "@expo/vector-icons";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { cardShadow, colors, radius, spacing } from "../styles/theme";
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

const formatIrishReg = (value: string) => {
  const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const year = raw.replace(/\D/g, "").slice(0, 3);
  const rest = raw.slice(year.length);
  const county = rest.replace(/[^A-Z]/g, "").slice(0, 1);
  const serial = rest.replace(/\D/g, "");
  const parts = [year, county, serial].filter(Boolean);
  return parts.join("-");
};

export function BookingSummaryScreen({ navigation, route }: Props) {
  const { id, from, to } = route.params;
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loadingListing, setLoadingListing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [confirmingBooking, setConfirmingBooking] = useState(false);
  const [paymentFailed, setPaymentFailed] = useState(false);
  const [paymentFailureMessage, setPaymentFailureMessage] = useState<string | null>(null);
  const [insuranceEnabled, setInsuranceEnabled] = useState(true);
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

  const pricing = useMemo(() => {
    const parkingFee = priceSummary?.total ?? 0;
    const insuranceFee = 2.99;
    const transactionFee = 1.5;
    const finalPrice = parkingFee + transactionFee + (insuranceEnabled ? insuranceFee : 0);
    return {
      parkingFee,
      insuranceFee,
      transactionFee,
      finalPrice,
    };
  }, [insuranceEnabled, priceSummary]);

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
    const normalizedPlate = vehiclePlate.trim().replace(/-/g, " ");
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
        vehiclePlate: normalizedPlate ? normalizedPlate : undefined,
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
      <View style={styles.gradientWrapper}>
        <LinearGradient colors={["#ECFDF5", "#F9FAFB"]} style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerBackButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            disabled={bookingBusy || bookingConfirmed}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Booking summary</Text>
        </LinearGradient>
      </View>
      <BookingProgressBar currentStep={bookingBusy || confirmingBooking ? 3 : 2} />
      {loadingListing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="small" color="#247881" />
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
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardHeaderTitle}>{listing.title || "Adam House Car Park"}</Text>
              <View style={styles.cardHeaderSubtitleRow}>
                <Ionicons name="location-outline" size={18} color={colors.text} />
                <Text style={styles.cardHeaderSubtitle}>
                  {listing.address || "24 Adam Street, Dublin"}
                </Text>
              </View>
            </View>
            <View style={styles.cardBody}>
              <View style={styles.dateRow}>
                <View style={styles.dateColumn}>
                  <Text style={styles.dateLabel}>Parking from</Text>
                  <TouchableOpacity onPress={() => openPicker("start")}>
                    <Text style={styles.dateValue}>{formatDateTimeLabel(start)}</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.durationColumn}>
                  <Text style={styles.durationValue}>{durationHours}h</Text>
                </View>
                <View style={styles.dateColumn}>
                  <Text style={styles.dateLabel}>Parking until</Text>
                  <TouchableOpacity onPress={() => openPicker("end")}>
                    <Text style={styles.dateValue}>{formatDateTimeLabel(end)}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardBody}>
              <Text style={styles.fieldLabel}>Registration number</Text>
              <View style={styles.plateRow}>
                <View style={styles.plateCountry}>
                  <Text style={styles.plateCountryText}>IRL</Text>
                </View>
                <TextInput
                  value={vehiclePlate}
                  onChangeText={(value) => setVehiclePlate(formatIrishReg(value))}
                  placeholder="12-D-12345"
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={12}
                  style={styles.plateInput}
                />
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardBody}>
              <View style={styles.rowBetween}>
                <View style={styles.rowLeft}>
                  <Switch
                    value={insuranceEnabled}
                    onValueChange={setInsuranceEnabled}
                    trackColor={{ false: "#d1d5db", true: "#247881" }}
                    thumbColor={insuranceEnabled ? "#247881" : "#f3f4f6"}
                  />
                  <View style={styles.rowLabelGroup}>
                    <Text style={styles.rowLabel}>Insurance</Text>
                    <MaterialCommunityIcons name="information-outline" size={16} color="#94a3b8" />
                  </View>
                </View>
                <Text style={styles.rowValue}>€{pricing.insuranceFee.toFixed(2)}</Text>
              </View>
              <Text style={styles.rowSubtext}>
                Covers accidental damage and extends your booking protection.
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.cardBody}>
              <View style={styles.rowBetween}>
                <View style={styles.rowLabelGroup}>
                  <Text style={styles.rowLabel}>Parking fee</Text>
                  <MaterialCommunityIcons name="information-outline" size={16} color="#94a3b8" />
                </View>
                <Text style={styles.rowValue}>€{pricing.parkingFee.toFixed(2)}</Text>
              </View>
              <View style={styles.rowBetween}>
                <View style={styles.rowLabelGroup}>
                  <Text style={styles.rowLabel}>Transaction fee</Text>
                  <MaterialCommunityIcons name="information-outline" size={16} color="#94a3b8" />
                </View>
                <Text style={styles.rowValue}>€{pricing.transactionFee.toFixed(2)}</Text>
              </View>
              <View style={styles.finalRow}>
                <Text style={styles.finalLabel}>Final price</Text>
                <Text style={styles.finalValue}>€{pricing.finalPrice.toFixed(2)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.trustRow}>
              <View style={styles.rowLabelGroup}>
                <MaterialCommunityIcons name="shield-check" size={20} color="#247881" />
                <Text style={styles.rowLabel}>Best Price Guarantee</Text>
              </View>
              <MaterialCommunityIcons name="information-outline" size={18} color="#94a3b8" />
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
        </ScrollView>
      ) : (
        <View style={styles.centered}>
          <Text style={styles.error}>Listing not found.</Text>
        </View>
      )}
      {listing && user ? (
        <View style={[styles.footerBar, { paddingBottom: 12 + insets.bottom }]}>
          <TouchableOpacity
            style={[
              styles.footerButton,
              (bookingBusy || bookingConfirmed) && styles.footerButtonDisabled,
            ]}
            onPress={handlePayment}
            disabled={bookingBusy || bookingConfirmed}
          >
            <View style={styles.footerButtonContent}>
              <MaterialCommunityIcons name="credit-card-outline" size={18} color={colors.text} />
              <Text style={styles.footerButtonText}>
                {bookingBusy
                  ? confirmingBooking
                    ? "Finalizing..."
                    : "Processing..."
                  : `€${pricing.finalPrice.toFixed(2)} - Pay and reserve`}
              </Text>
            </View>
          </TouchableOpacity>
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
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  gradientWrapper: {
    flex: 0,
  },
  header: {
    alignItems: "center",
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
  scrollContent: {
    padding: 15,
    paddingBottom: 120,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    backgroundColor: "#1B2B39",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardHeaderTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  cardHeaderSubtitle: {
    color: "#cbd5e1",
    fontSize: 12,
    marginTop: 4,
  },
  cardBody: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  dateColumn: {
    flex: 1,
  },
  dateLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  dateValue: {
    color: "#247881",
    fontSize: 13,
    fontWeight: "600",
    textDecorationLine: "underline",
    textDecorationColor: "#247881",
  },
  durationColumn: {
    width: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  durationValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowLabelGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rowLabel: {
    color: "#1f2937",
    fontSize: 14,
    fontWeight: "600",
  },
  rowValue: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "600",
  },
  rowSubtext: {
    marginTop: 8,
    color: "#94a3b8",
    fontSize: 12,
    lineHeight: 16,
  },
  finalRow: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  finalLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  finalValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  trustRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fieldLabel: {
    color: "#1f2937",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 10,
  },
  fieldInput: {
    backgroundColor: "#F8F9FA",
    borderColor: "#e2e8f0",
    borderRadius: 10,
    borderWidth: 1,
    color: "#111827",
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  plateRow: {
    flexDirection: "row",
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#0f172a",
    overflow: "hidden",
    backgroundColor: "#f8fafc",
  },
  plateCountry: {
    width: 56,
    backgroundColor: "#1e3a8a",
    alignItems: "center",
    justifyContent: "center",
  },
  plateCountryText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  plateInput: {
    flex: 1,
    color: "#0f172a",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 2,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#fefefe",
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
    fontWeight: "600",
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
    fontWeight: "600",
  },
  noticeText: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 6,
    lineHeight: 18,
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
    fontWeight: "600",
    color: colors.text,
  },
  pickerDone: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  pickerDoneText: {
    color: colors.accent,
    fontWeight: "600",
  },
  footerBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#F8F9FA",
    paddingHorizontal: 15,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  footerButton: {
    backgroundColor: "#BCCAD1",
    borderRadius: 8,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  footerButtonDisabled: {
    opacity: 0.7,
  },
  footerButtonText: {
    color: "#243b4a",
    fontSize: 15,
    fontWeight: "700",
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
    fontWeight: "600",
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
    fontWeight: "600",
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
