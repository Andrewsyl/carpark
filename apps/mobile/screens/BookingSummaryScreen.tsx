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
  TouchableOpacity,
  View,
  Switch,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useStripe } from "@stripe/stripe-react-native";
import * as Notifications from "expo-notifications";
import DatePicker from "react-native-date-picker";
import { Ionicons } from "@expo/vector-icons";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { useGlobalLoading } from "../components/GlobalLoading";
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

const VEHICLE_MAKE_KEY = "vehicle.make";
const VEHICLE_COLOR_KEY = "vehicle.color";

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
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [startAt, setStartAt] = useState(() => new Date(from));
  const [endAt, setEndAt] = useState(() => new Date(to));
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerField, setPickerField] = useState<"start" | "end">("start");
  const [draftDate, setDraftDate] = useState<Date | null>(null);
  const { show: showGlobalLoading, hide: hideGlobalLoading } = useGlobalLoading();

  useEffect(() => {
    let active = true;
    const load = async () => {
      showGlobalLoading("Loading booking...");
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
        hideGlobalLoading();
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

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [savedMake, savedColor] = await Promise.all([
          AsyncStorage.getItem(VEHICLE_MAKE_KEY),
          AsyncStorage.getItem(VEHICLE_COLOR_KEY),
        ]);
        if (!active) return;
        if (savedMake) setVehicleMake(savedMake);
        if (savedColor) setVehicleColor(savedColor);
      } catch {
        // Ignore lookup failures.
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

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
        vehiclePlate: undefined,
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
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          disabled={bookingBusy || bookingConfirmed}
        >
          <View style={styles.backCircle}>
            <Ionicons name="arrow-back" size={16} color={colors.text} />
          </View>
        </TouchableOpacity>
        <Text style={styles.topTitle}>Booking summary</Text>
        <View style={styles.backButton} />
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
            <View style={styles.cardBody}>
              <Text style={styles.listingTitle}>{listing.title || "Adam House Car Park"}</Text>
              <View style={styles.addressRow}>
                <View style={styles.addressDot} />
                <Text style={styles.addressText}>
                  {listing.address || "24 Adam Street, Dublin"}
                </Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.cardBody}>
              <View style={styles.dateRow}>
                <View style={styles.dateColumn}>
                  <Text style={styles.dateLabel}>Parking from</Text>
                  <TouchableOpacity onPress={() => openPicker("start")} style={styles.dateTimePill}>
                    <Ionicons name="time-outline" size={14} color={colors.text} />
                    <Text style={styles.dateTimeText}>{formatDateTimeLabel(start)}</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.durationPill}>
                  <Text style={styles.durationValue}>{durationHours}h</Text>
                </View>
                <View style={styles.dateColumn}>
                  <Text style={styles.dateLabel}>Parking until</Text>
                  <TouchableOpacity onPress={() => openPicker("end")} style={styles.dateTimePill}>
                    <Ionicons name="time-outline" size={14} color={colors.text} />
                    <Text style={styles.dateTimeText}>{formatDateTimeLabel(end)}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardBody}>
              <Text style={styles.fieldLabel}>Vehicle registration</Text>
              <Pressable
                style={styles.regRow}
                onPress={() => navigation.navigate("VehicleType")}
              >
                <View style={styles.plateCountry}>
                  <Text style={styles.plateCountryText}>IRL</Text>
                </View>
                <View style={styles.regDetails}>
                  <Text style={styles.regPlaceholder}>
                    {vehicleMake
                      ? `${vehicleMake}${vehicleColor ? ` · ${vehicleColor}` : ""}`
                      : "REGISTER VEHICLE"}
                  </Text>
                  <Text style={styles.regHint}>Select vehicle type & color</Text>
                </View>
              </Pressable>
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
            <Text style={styles.footerButtonText}>
              {bookingBusy
                ? confirmingBooking
                  ? "Finalizing..."
                  : "Processing..."
                : `€${pricing.finalPrice.toFixed(2)} - Pay and reserve`}
            </Text>
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
    backgroundColor: "#F9FAFB",
  },
  topBar: {
    alignItems: "center",
    backgroundColor: colors.headerTint,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.screenX,
    paddingVertical: 10,
  },
  backButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    width: 56,
  },
  backCircle: {
    alignItems: "center",
    justifyContent: "center",
    height: 32,
    width: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBg,
  },
  topTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
  },
  divider: {
    height: 1,
    backgroundColor: "#F3F4F6",
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardBody: {
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  listingTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  addressRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  addressDot: {
    backgroundColor: colors.textSoft,
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  addressText: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: "400",
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
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  dateTimePill: {
    alignItems: "center",
    backgroundColor: "#F7FFFB",
    borderColor: "#bfe2d8",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateTimeText: {
    color: "#101828",
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },
  durationPill: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f4f6",
    borderColor: "#e5e7eb",
    borderRadius: 999,
    borderWidth: 1,
    width: 38,
    height: 38,
  },
  durationValue: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
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
    color: colors.text,
    fontSize: 15,
    fontWeight: "400",
  },
  rowValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
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
    fontWeight: "600",
    color: colors.text,
  },
  finalValue: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text,
  },
  trustRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
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
  regRow: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
    backgroundColor: "#f8fafc",
    alignItems: "center",
  },
  regDetails: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
    justifyContent: "center",
  },
  plateCountry: {
    width: 48,
    backgroundColor: "#1e3a8a",
    alignItems: "center",
    justifyContent: "center",
  },
  plateCountryText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  regPlaceholder: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  regHint: {
    color: "#94a3b8",
    fontSize: 11,
    marginTop: 4,
  },
  centered: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 22,
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
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  footerButton: {
    backgroundColor: "#0F766E",
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  footerButtonDisabled: {
    backgroundColor: "#E5E7EB",
  },
  footerButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
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
