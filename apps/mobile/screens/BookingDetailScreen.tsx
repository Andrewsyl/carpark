import { CommonActions } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRef, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import DatePicker from "react-native-date-picker";
import { useStripe } from "@stripe/stripe-react-native";
import { cancelBooking, checkInBooking, confirmBookingExtension, createBookingExtensionIntent } from "../api";
import { useAuth } from "../auth";
import { getNotificationImageAttachment } from "../notifications";
import { cardShadow, colors, radius, spacing, textStyles } from "../styles/theme";
import type { RootStackParamList } from "../types";
import { Ionicons } from "@expo/vector-icons";

type Props = NativeStackScreenProps<RootStackParamList, "BookingDetail">;

export function BookingDetailScreen({ navigation, route }: Props) {
  const { booking } = route.params;
  const { token } = useAuth();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [localStatus, setLocalStatus] = useState(booking.status);
  const [localEndTime, setLocalEndTime] = useState(() => new Date(booking.endTime));
  const [localAmountCents, setLocalAmountCents] = useState(booking.amountCents);
  const [canceling, setCanceling] = useState(false);
  const [checkedInAt, setCheckedInAt] = useState(
    booking.checkedInAt ? new Date(booking.checkedInAt) : null
  );
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendBusy, setExtendBusy] = useState(false);
  const [extendError, setExtendError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const cancelOffsetRef = useRef<number | null>(null);
  const start = new Date(booking.startTime);
  const end = localEndTime;
  const isUpcoming = end.getTime() > Date.now();
  const isCanceled = localStatus === "canceled";
  const isRefunded = booking.refundStatus === "succeeded";
  const refundedAt = booking.refundedAt ? new Date(booking.refundedAt) : null;
  const canReview = end.getTime() <= Date.now() && booking.status === "confirmed";
  const statusLabel = (isRefunded ? "refunded" : localStatus).toUpperCase();
  const receiptUrl = booking.receiptUrl ?? null;
  const vehiclePlate = booking.vehiclePlate?.trim();
  const accessCode = booking.accessCode?.trim();
  const destination =
    typeof booking.latitude === "number" && typeof booking.longitude === "number"
      ? `${booking.latitude},${booking.longitude}`
      : booking.address;
  const staticMapUrl =
    typeof booking.latitude === "number" && typeof booking.longitude === "number"
      ? `https://maps.googleapis.com/maps/api/staticmap?center=${booking.latitude},${booking.longitude}&zoom=16&size=600x300&markers=color:0x10B981|${booking.latitude},${booking.longitude}&key=${process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""}`
      : null;
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    destination
  )}`;
  const handleOpenMaps = () => {
    Alert.alert("Open Google Maps", "Open directions to this space?", [
      { text: "Cancel", style: "cancel" },
      { text: "Open", onPress: () => Linking.openURL(mapsUrl) },
    ]);
  };
  const showAccessCode = accessCode && localStatus === "confirmed";
  const minExtendTime = new Date(end.getTime() + 5 * 60 * 1000);
  const graceEndsAt = new Date(start.getTime() + 15 * 60 * 1000);
  const canCheckIn =
    localStatus === "confirmed" &&
    !checkedInAt &&
    Date.now() >= start.getTime() - 15 * 60 * 1000 &&
    Date.now() <= end.getTime();

  const performCancel = async () => {
    if (!token || canceling || localStatus === "canceled") return;
    setCanceling(true);
    try {
      await cancelBooking({ token, bookingId: booking.id });
      await AsyncStorage.setItem("searchRefreshToken", Date.now().toString());
      setLocalStatus("canceled");
      try {
        const attachments = await getNotificationImageAttachment();
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Booking canceled",
            body: "The space is now back on the map.",
            attachments,
          },
          trigger: null,
        });
      } catch {
        // Notification failures shouldn't block the cancel flow.
      }
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [
            {
              name: "History",
              params: {
                refreshToken: Date.now(),
                showMapCTA: true,
                initialTab: "upcoming",
              },
            },
          ],
        })
      );
    } finally {
      setCanceling(false);
    }
  };

  const handleCancel = () => {
    if (!token || canceling || localStatus === "canceled") return;
    Alert.alert("Cancel booking", "Cancel this reservation and release the space?", [
      { text: "Keep", style: "cancel" },
      { text: "Cancel booking", style: "destructive", onPress: performCancel },
    ]);
  };

  const handleChangeStartInfo = () => {
    if (!token || localStatus === "canceled") return;
    if (cancelOffsetRef.current == null) {
      handleCancel();
      return;
    }
    scrollRef.current?.scrollTo({
      y: Math.max(cancelOffsetRef.current - 16, 0),
      animated: true,
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
        setLocalEndTime(new Date(result.newEndTime));
        setLocalAmountCents(result.newTotalCents);
        Alert.alert("Booking updated", "Your end time has been extended.");
        return;
      }

      const initResult = await initPaymentSheet({
        merchantDisplayName: "CarParking",
        customerId: result.customerId,
        customerEphemeralKeySecret: result.ephemeralKeySecret,
        paymentIntentClientSecret: result.paymentIntentClientSecret,
        allowsDelayedPaymentMethods: false,
        returnURL: "carparking://stripe-redirect",
      });
      if (initResult.error) {
        setExtendError("We couldn’t start the extension payment.");
        return;
      }

      const presentResult = await presentPaymentSheet();
      if (presentResult.error) {
        setExtendError(
          presentResult.error.code === "Canceled"
            ? "Extension canceled."
            : presentResult.error.message ?? "Payment failed."
        );
        return;
      }

      const confirm = await confirmBookingExtension({
        token,
        bookingId: booking.id,
        paymentIntentId: result.paymentIntentId,
        newEndTime: result.newEndTime,
        newTotalCents: result.newTotalCents,
      });
      setLocalEndTime(new Date(confirm.newEndTime));
      setLocalAmountCents(confirm.newTotalCents);
      Alert.alert("Booking extended", "Your end time has been updated.");
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
      Alert.alert("Checked in", "Thanks! Enjoy your booking.");
    } catch (err) {
      Alert.alert("Check-in failed", err instanceof Error ? err.message : "Try again.");
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Booking</Text>
        <View style={styles.backButton} />
      </View>
      <ScrollView contentContainerStyle={styles.content} ref={scrollRef}>
        <Text style={styles.title}>{booking.title}</Text>
        <Text style={styles.subtitle}>{booking.address}</Text>
        {staticMapUrl ? (
          <Pressable style={styles.mapPreview} onPress={handleOpenMaps}>
            <Image source={{ uri: staticMapUrl }} style={styles.mapImage} resizeMode="cover" />
          </Pressable>
        ) : null}
        <Pressable style={styles.mapButton} onPress={handleOpenMaps}>
          <Ionicons name="navigate" size={16} color={colors.accent} />
          <Text style={styles.mapButtonText}>Open in Google Maps</Text>
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Booking details</Text>
          <Text style={styles.cardSubtitle}>Your reservation summary.</Text>
          <View style={styles.detailList}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>STATUS</Text>
              <Text style={styles.detailValue}>{statusLabel}</Text>
            </View>
            {checkedInAt ? (
              <View style={[styles.detailRow, styles.detailRowBorder]}>
                <Text style={styles.detailLabel}>CHECKED IN</Text>
                <Text style={styles.detailValue}>{checkedInAt.toLocaleString()}</Text>
              </View>
            ) : null}
            {isRefunded ? (
              <View style={[styles.detailRow, styles.detailRowBorder]}>
                <Text style={styles.detailLabel}>REFUND</Text>
                <Text style={styles.detailValue}>
                  {refundedAt ? refundedAt.toLocaleString() : "Refunded"}
                </Text>
              </View>
            ) : null}
            <View style={[styles.detailRow, styles.detailRowBorder]}>
              <Text style={styles.detailLabel}>START</Text>
                <Text style={styles.detailValue}>{start.toLocaleString()}</Text>
            </View>
            <View style={[styles.detailRow, styles.detailRowBorder]}>
              <Text style={styles.detailLabel}>END</Text>
                <Text style={styles.detailValue}>{end.toLocaleString()}</Text>
            </View>
            {vehiclePlate ? (
              <View style={[styles.detailRow, styles.detailRowBorder]}>
                <Text style={styles.detailLabel}>PLATE</Text>
                <Text style={styles.detailValue}>{vehiclePlate}</Text>
              </View>
            ) : null}
            {showAccessCode ? (
              <View style={[styles.detailRow, styles.detailRowBorder]}>
                <Text style={styles.detailLabel}>ACCESS</Text>
                <Text style={styles.detailValue}>{accessCode}</Text>
              </View>
            ) : null}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>TOTAL</Text>
              <Text style={styles.totalValue}>€{(localAmountCents / 100).toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {isUpcoming && localStatus !== "canceled" ? (
          <>
            <View style={styles.noticeCard}>
              <Text style={styles.noticeTitle}>Grace period</Text>
              <Text style={styles.noticeText}>
                Please arrive within 15 minutes of the start time. Grace ends at{" "}
                {graceEndsAt.toLocaleTimeString()}.
              </Text>
            </View>
            {canCheckIn ? (
              <Pressable style={styles.primaryButton} onPress={handleCheckIn}>
                <Text style={styles.primaryButtonText}>I’m parked</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={[styles.primaryButton, extendBusy && styles.primaryButtonDisabled]}
              onPress={() => setExtendOpen(true)}
              disabled={extendBusy}
            >
              <Text style={styles.primaryButtonText}>
                {extendBusy ? "Extending..." : "Extend booking"}
              </Text>
            </Pressable>
            <Pressable onPress={handleChangeStartInfo}>
              <Text style={styles.helperText}>Need to change start time? Cancel and rebook.</Text>
            </Pressable>
            <View
              onLayout={(event) => {
                cancelOffsetRef.current = event.nativeEvent.layout.y;
              }}
            >
              <Pressable
                style={[styles.dangerButton, canceling && styles.dangerButtonDisabled]}
                onPress={handleCancel}
                disabled={canceling}
              >
                <Text style={styles.dangerButtonText}>
                  {canceling ? "Canceling..." : "Cancel booking"}
                </Text>
              </Pressable>
            </View>
            {extendError ? <Text style={styles.error}>{extendError}</Text> : null}
          </>
        ) : receiptUrl ? (
          <Pressable style={styles.primaryButton} onPress={() => Linking.openURL(receiptUrl)}>
            <Text style={styles.primaryButtonText}>View receipt</Text>
          </Pressable>
        ) : canReview ? (
          <Pressable
            style={styles.primaryButton}
            onPress={() => navigation.navigate("Review", { booking })}
          >
            <Text style={styles.primaryButtonText}>Leave a review</Text>
          </Pressable>
        ) : !isCanceled ? (
          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>Reviews unlock after the stay</Text>
            <Text style={styles.noticeText}>
              You can leave a review once the booking has ended and is confirmed.
            </Text>
          </View>
        ) : null}
      </ScrollView>
      <DatePicker
        modal
        open={extendOpen}
        date={minExtendTime}
        minimumDate={minExtendTime}
        mode="datetime"
        minuteInterval={5}
        onConfirm={(date) => {
          setExtendOpen(false);
          handleExtend(date);
        }}
        onCancel={() => {
          setExtendOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.appBg,
    flex: 1,
  },
  topBar: {
    alignItems: "center",
    backgroundColor: colors.headerTint,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.screenX,
    paddingTop: 8,
  },
  backButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
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
  backIcon: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 14,
    textAlign: "center",
    fontWeight: "700",
  },
  topTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  content: {
    paddingHorizontal: spacing.screenX,
    paddingBottom: 32,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "700",
    marginTop: 12,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 6,
  },
  mapButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  mapPreview: {
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 12,
    marginBottom: 4,
  },
  mapImage: {
    width: "100%",
    height: 140,
  },
  mapButtonText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "600",
  },
  card: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    marginTop: 16,
    padding: spacing.card,
    ...cardShadow,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
  },
  cardSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 6,
  },
  detailList: {
    borderColor: colors.border,
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
    borderTopColor: colors.border,
    borderTopWidth: 1,
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
  dangerButton: {
    alignItems: "center",
    borderColor: "#fecaca",
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 20,
    paddingVertical: 12,
  },
  dangerButtonText: {
    color: "#b42318",
    fontSize: 13,
    fontWeight: "700",
  },
  dangerButtonDisabled: {
    opacity: 0.6,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radius.card,
    marginTop: 20,
    minHeight: 44,
    paddingVertical: 12,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  noticeCard: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    marginTop: 16,
    padding: 16,
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
  helperText: {
    color: colors.accent,
    fontSize: 12,
    marginTop: 10,
    textAlign: "center",
    fontWeight: "600",
  },
});
