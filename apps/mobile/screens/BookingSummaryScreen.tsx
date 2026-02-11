import { CommonActions, useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Alert,
  LayoutAnimation,
  Platform,
  UIManager,
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
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
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
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [staticMapFailed, setStaticMapFailed] = useState(false);
  const [startAt, setStartAt] = useState(() => new Date(from));
  const [endAt, setEndAt] = useState(() => new Date(to));
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerField, setPickerField] = useState<"start" | "end">("start");
  const [draftDate, setDraftDate] = useState<Date | null>(null);
  const { reset: resetGlobalLoading } = useGlobalLoading();
  const [showBreakdown, setShowBreakdown] = useState(false);

  useEffect(() => {
    if (Platform.OS === "android") {
      UIManager.setLayoutAnimationEnabledExperimental?.(true);
    }
  }, []);

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
  const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const mapCenter =
    listing?.latitude && listing?.longitude
      ? `${listing.latitude},${listing.longitude}`
      : null;
  const mapCoords = useMemo(() => {
    if (typeof listing?.latitude !== "number" || typeof listing?.longitude !== "number") {
      return null;
    }
    return { latitude: listing.latitude, longitude: listing.longitude };
  }, [listing?.latitude, listing?.longitude]);
  const mapCoordsKey = mapCoords
    ? `${mapCoords.latitude.toFixed(6)},${mapCoords.longitude.toFixed(6)}`
    : null;
  const lastMapKeyRef = useRef<string | null>(null);
  const [staticMapVersion, setStaticMapVersion] = useState(0);
  const staticMapUrl = useMemo(() => {
    if (!mapsKey || !mapCenter) return null;
    const cacheBuster = `${staticMapVersion}`;
    return `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(
      mapCenter
    )}&zoom=16&size=640x280&scale=2&format=png&maptype=roadmap&markers=color:0x10B981|${encodeURIComponent(
      mapCenter
    )}&key=${mapsKey}&v=${encodeURIComponent(cacheBuster)}`;
  }, [mapsKey, mapCenter, staticMapVersion]);

  useEffect(() => {
    setStaticMapFailed(false);
    if (mapCoords) {
      console.log("[BookingSummary] Map coords", mapCoords);
    } else {
      console.warn("[BookingSummary] Missing map coords");
    }
    if (staticMapUrl) {
      console.log("[BookingSummary] Static map URL", staticMapUrl);
    }
  }, [staticMapUrl, mapCoords]);

  useEffect(() => {
    if (!mapCoordsKey) return;
    if (lastMapKeyRef.current === mapCoordsKey) return;
    lastMapKeyRef.current = mapCoordsKey;
    setStaticMapVersion((prev) => prev + 1);
  }, [mapCoordsKey]);
  const durationHours = useMemo(() => {
    const ms = Math.max(0, end.getTime() - start.getTime());
    return Math.max(1, Math.ceil(ms / (1000 * 60 * 60)));
  }, [end, start]);

  const priceSummary = useMemo(() => {
    if (!listing) return null;
    const hourlyRate = listing.price_per_day / 24;
    const total = Math.round(hourlyRate * durationHours);
    return { total, totalCents: total * 100 };
  }, [durationHours, listing]);

  const pricing = useMemo(() => {
    const parkingFee = priceSummary?.total ?? 0;
    const transactionFee = 0;
    const finalPrice = parkingFee;
    const finalCents = Math.round(parkingFee * 100);
    return {
      parkingFee,
      transactionFee,
      finalPrice,
      finalCents,
    };
  }, [priceSummary]);

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
    const minEnd = new Date(startAt);
    minEnd.setHours(minEnd.getHours() + 1);
    const safeEnd = next < minEnd ? minEnd : next;
    setEndAt(safeEnd);
  };

  const toggleBreakdown = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowBreakdown((prev) => !prev);
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
        amountCents: pricing.finalCents,
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
      resetGlobalLoading();
      const nowMs = Date.now();
      const startMs = Date.parse(from);
      const endMs = Date.parse(to);
      const initialTab =
        Number.isFinite(startMs) &&
        Number.isFinite(endMs) &&
        startMs <= nowMs &&
        nowMs < endMs
          ? "active"
          : "upcoming";
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
      <View style={styles.progressHeader}>
        <BookingProgressBar currentStep={bookingBusy || confirmingBooking ? 3 : 2} />
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.progressBackButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          disabled={bookingBusy || bookingConfirmed}
        >
            <View style={styles.backCircle}>
              <Ionicons name="arrow-back" size={12} color={colors.text} />
            </View>
        </TouchableOpacity>
      </View>
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

          <View style={styles.summaryMapWrap}>
            {Platform.OS !== "ios" && staticMapUrl && !staticMapFailed ? (
              <Image
                source={{ uri: staticMapUrl }}
                style={styles.summaryMap}
                resizeMode="cover"
                onError={(event) => {
                  setStaticMapFailed(true);
                  console.warn("[BookingSummary] Static map failed", event.nativeEvent);
                }}
                onLoad={() => {
                  console.log("[BookingSummary] Static map loaded");
                }}
              />
            ) : mapCoords ? (
              <MapView
                provider={PROVIDER_GOOGLE}
                style={styles.summaryMap}
                region={{
                  latitude: mapCoords.latitude,
                  longitude: mapCoords.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                pointerEvents="none"
              >
                <Marker coordinate={mapCoords} />
              </MapView>
            ) : (
              <View style={styles.summaryMapPlaceholder}>
                <Text style={styles.summaryMapPlaceholderText}>Map preview unavailable</Text>
              </View>
            )}
          </View>
          <View style={styles.summaryHeader}>
            <Text style={styles.listingTitle}>{listing.title || "Adam House Car Park"}</Text>
            <View style={styles.addressRow}>
              <Ionicons name="location-sharp" size={14} color={colors.textMuted} />
              <Text style={styles.addressText}>
                {listing.address || "24 Adam Street, Dublin"}
              </Text>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>Your parking session</Text>
            <View style={styles.sessionRow}>
              <Text style={styles.sessionLabel}>Duration</Text>
              <Text style={styles.sessionValue}>{durationHours} hours</Text>
            </View>
            <View style={styles.sessionRow}>
              <Text style={styles.sessionLabel}>Start time</Text>
              <Text style={styles.sessionValue}>{formatDateTimeLabel(start)}</Text>
            </View>
            <View style={styles.sessionRow}>
              <Text style={styles.sessionLabel}>End time</Text>
              <Text style={styles.sessionValue}>{formatDateTimeLabel(end)}</Text>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.totalRow}>
              <Pressable style={styles.totalInfo} onPress={toggleBreakdown}>
                <Text style={styles.totalDueLabel}>Total due today</Text>
                <MaterialCommunityIcons name="information-outline" size={16} color="#94a3b8" />
              </Pressable>
              <Text style={styles.totalDueValue}>€{Math.round(pricing.finalPrice)}</Text>
            </View>
            {showBreakdown ? (
              <View style={styles.breakdownList}>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Parking fee</Text>
                  <Text style={styles.breakdownValue}>
                    €{Math.round(pricing.parkingFee)}
                  </Text>
                </View>
                {pricing.transactionFee > 0 ? (
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Platform fee (host)</Text>
                    <Text style={styles.breakdownValue}>
                      €{Math.round(pricing.transactionFee)}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
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
                : "Pay and reserve"}
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
                minuteInterval={30}
                textColor={colors.accent}
                onDateChange={(date) => {
                  setDraftDate(date);
                  applyPickedDate(date);
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
    paddingVertical: 6,
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
    width: 120,
  },
  progressHeader: {
    backgroundColor: "#FFFFFF",
    paddingBottom: 0,
    paddingTop: 18,
  },
  progressBackButton: {
    position: "absolute",
    left: spacing.screenX,
    top: 2,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    paddingTop: 0,
  },
  divider: {
    height: 1,
    backgroundColor: "#F3F4F6",
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 16,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 4,
  },
  cardBody: {
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  cardSectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Poppins-SemiBold",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  listingTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
    fontFamily: "Poppins-Bold",
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
    fontSize: 14,
    fontWeight: "400",
    fontFamily: "Poppins-Regular",
  },
  summaryHeader: {
    marginBottom: 16,
  },
  summaryMapWrap: {
    marginHorizontal: -16,
    marginBottom: 16,
    backgroundColor: "transparent",
  },
  summaryMap: {
    width: "100%",
    height: 140,
    borderRadius: 0,
    backgroundColor: "transparent",
  },
  summaryMapPlaceholder: {
    width: "100%",
    height: 140,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryMapPlaceholderText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "500",
    fontFamily: "Poppins-Medium",
  },
  summaryCode: {
    alignSelf: "flex-start",
    borderWidth: 2,
    borderColor: "#22a06b",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 10,
  },
  summaryCodeText: {
    color: "#111827",
    fontWeight: "700",
    fontFamily: "Poppins-Bold",
    fontSize: 16,
    letterSpacing: 0.6,
  },
  sectionCard: {
    backgroundColor: "transparent",
    borderRadius: 0,
    borderWidth: 0,
    borderColor: "transparent",
    paddingHorizontal: 0,
    paddingVertical: 0,
    marginBottom: 18,
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Poppins-SemiBold",
    color: "#374151",
    marginBottom: 10,
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: "#E5E7EB",
  },
  sessionLabel: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Poppins-SemiBold",
  },
  sessionValue: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "Poppins-SemiBold",
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
    fontFamily: "Poppins-SemiBold",
    marginBottom: 6,
  },
  dateTimePill: {
    alignItems: "center",
    backgroundColor: "#F7FFFB",
    borderColor: "#D1D5DB",
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
    fontFamily: "Poppins-SemiBold",
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
    fontFamily: "Poppins-SemiBold",
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
    fontFamily: "Poppins-Regular",
  },
  rowValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Poppins-SemiBold",
  },
  rowSubtext: {
    marginTop: 8,
    color: "#6B7280",
    fontSize: 12,
    fontFamily: "Poppins-Regular",
    lineHeight: 18,
  },
  totalDue: {
    marginTop: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  totalDueLabel: {
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Poppins-SemiBold",
    color: "#111827",
  },
  totalDueValue: {
    fontSize: 24,
    fontWeight: "800",
    fontFamily: "Poppins-Bold",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  totalInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  breakdownList: {
    marginTop: 8,
    borderTopWidth: 1.5,
    borderTopColor: "#E5E7EB",
    paddingTop: 8,
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  breakdownLabel: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Poppins-SemiBold",
  },
  breakdownValue: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "Poppins-SemiBold",
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
    fontFamily: "Poppins-SemiBold",
    marginBottom: 10,
  },
  fieldInput: {
    backgroundColor: "#F8F9FA",
    borderColor: "#e2e8f0",
    borderRadius: 10,
    borderWidth: 1,
    color: "#111827",
    fontSize: 15,
    fontFamily: "Poppins-Regular",
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
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 0.2,
  },
  regHint: {
    color: "#94a3b8",
    fontSize: 11,
    fontFamily: "Poppins-Regular",
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
    fontFamily: "Poppins-Bold",
    letterSpacing: -0.4,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    fontFamily: "Poppins-Regular",
    marginTop: 8,
    textAlign: "center",
    lineHeight: 22,
  },
  muted: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: "Poppins-Regular",
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
    fontFamily: "Poppins-SemiBold",
  },
  noticeText: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: "Poppins-Regular",
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
    fontFamily: "Poppins-SemiBold",
    color: colors.text,
  },
  pickerDone: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  pickerDoneText: {
    color: colors.accent,
    fontWeight: "600",
    fontFamily: "Poppins-SemiBold",
  },
  footerBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 4,
  },
  footerButton: {
    backgroundColor: "#2a9d7f",
    borderRadius: 14,
    paddingVertical: 10,
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
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Poppins-SemiBold",
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
    fontFamily: "Poppins-SemiBold",
    textAlign: "center",
  },
  successBody: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: "Poppins-Regular",
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
    fontFamily: "Poppins-SemiBold",
  },
  error: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderRadius: 12,
    borderWidth: 1,
    color: "#b42318",
    fontSize: 12,
    fontFamily: "Poppins-Regular",
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
