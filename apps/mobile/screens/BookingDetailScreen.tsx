import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View, Image } from "react-native";
import { useRef, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import DatePicker from "react-native-date-picker";
import { useStripe } from "@stripe/stripe-react-native";
import MapView, { Marker } from "react-native-maps";
import { cancelBooking, checkInBooking, confirmBookingExtension, createBookingExtensionIntent } from "../api";
import { useAuth } from "../auth";
import { getNotificationImageAttachment } from "../notifications";
import type { RootStackParamList } from "../types";
import { Ionicons } from "@expo/vector-icons";
import { formatDateTimeLabel } from "../utils/dateFormat";
import { formatBookingReference } from "../utils/bookingFormat";

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
  const start = new Date(booking.startTime);
  const end = localEndTime;
  const now = Date.now();
  const isUpcoming = end.getTime() > now && start.getTime() > now;
  const isInProgress = start.getTime() <= now && end.getTime() > now && localStatus === "confirmed";
  const isCanceled = localStatus === "canceled";
  const isRefunded = booking.refundStatus === "succeeded";
  const refundedAt = booking.refundedAt ? new Date(booking.refundedAt) : null;
  const canReview = end.getTime() <= now && booking.status === "confirmed";
  
  const statusLabel = isRefunded 
    ? "Refunded" 
    : isCanceled 
    ? "Cancelled" 
    : isInProgress 
    ? "In Progress" 
    : isUpcoming 
    ? "Upcoming" 
    : "Completed";
    
  const receiptUrl = booking.receiptUrl ?? null;
  const vehiclePlate = booking.vehiclePlate?.trim();
  const accessCode = booking.accessCode?.trim();
  const showAccessCode = accessCode && localStatus === "confirmed";
  const minExtendTime = new Date(end.getTime() + 5 * 60 * 1000);
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
      setCanceling(false);
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
    } catch (err) {
      setCanceling(false);
      Alert.alert("Cancellation failed", err instanceof Error ? err.message : "Could not cancel booking. Please try again.");
    }
  };

  const handleCancel = () => {
    if (!token || canceling || localStatus === "canceled") return;
    Alert.alert("Cancel booking", "Cancel this reservation and release the space?", [
      { text: "Keep", style: "cancel" },
      { text: "Cancel booking", style: "destructive", onPress: performCancel },
    ]);
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
        setExtendError("We couldn't start the extension payment.");
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
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color="#111827" />
        </Pressable>
        <Text style={styles.headerTitle}>Booking Details</Text>
        <View style={{ width: 40 }} />
      </View>
      
      <ScrollView contentContainerStyle={styles.scrollContent} ref={scrollRef}>
        {/* Map Section - for upcoming/active bookings */}
        {(isUpcoming || isInProgress) && localStatus !== "canceled" ? (
          <View style={styles.mapSection}>
            <Text style={styles.mapTitle}>{booking.title}</Text>
            <Text style={styles.mapAddress}>{booking.address}</Text>
            
            {booking.latitude && booking.longitude ? (
              <TouchableOpacity
                onPress={() => {
                  Alert.alert(
                    "Open Navigation",
                    "Navigate to this parking spot in Google Maps?",
                    [
                      {
                        text: "Cancel",
                        style: "cancel"
                      },
                      {
                        text: "Open Maps",
                        onPress: () => {
                          const destination = `${booking.latitude},${booking.longitude}`;
                          const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
                          Linking.openURL(url);
                        }
                      }
                    ]
                  );
                }}
                activeOpacity={0.8}
              >
                <Image
                  source={{
                    uri: `https://maps.googleapis.com/maps/api/staticmap?center=${booking.latitude},${booking.longitude}&zoom=16&size=600x300&markers=color:green%7C${booking.latitude},${booking.longitude}&key=${process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}`,
                  }}
                  style={styles.parkingImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ) : (
              <View style={styles.mapPlaceholder}>
                <Ionicons name="location" size={48} color="#10B981" />
                <Text style={styles.mapPlaceholderText}>Map preview unavailable</Text>
              </View>
            )}
            
            <TouchableOpacity 
              style={styles.mapButton}
              onPress={() => {
                Alert.alert(
                  "Open Navigation",
                  "Navigate to this parking spot in Google Maps?",
                  [
                    {
                      text: "Cancel",
                      style: "cancel"
                    },
                    {
                      text: "Open Maps",
                      onPress: () => {
                        const destination = booking.latitude && booking.longitude 
                          ? `${booking.latitude},${booking.longitude}`
                          : encodeURIComponent(booking.address);
                        const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
                        Linking.openURL(url);
                      }
                    }
                  ]
                );
              }}
            >
              <Ionicons name="navigate" size={20} color="#10B981" />
              <Text style={styles.mapButtonText}>Open in Google Maps</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Outer Green Card - creates the "frame" */}
        <View style={[
          styles.outerGreenCard,
          isCanceled && styles.outerGreenCardCanceled,
          isRefunded && styles.outerGreenCardRefunded,
          isInProgress && styles.outerGreenCardInProgress,
          isUpcoming && styles.outerGreenCardUpcoming
        ]}>
          {/* Status Header */}
          <View style={styles.statusHeader}>
            <Ionicons 
              name={
                isCanceled ? "close-circle" 
                : isRefunded ? "arrow-undo" 
                : isInProgress ? "time" 
                : isUpcoming ? "calendar" 
                : "checkmark-circle"
              } 
              size={20} 
              color="#FFFFFF" 
            />
            <Text style={styles.statusHeaderText}>{statusLabel}</Text>
          </View>

          {/* Inner White Content with rounded corners */}
          <View style={styles.innerWhiteContent}>
            {/* Listing Header */}
            <View style={styles.listingRow}>
              <View style={styles.carIcon}>
                <Ionicons name="car" size={32} color="#10B981" />
              </View>
              <View style={styles.listingText}>
                <Text style={styles.listingName} numberOfLines={2}>{booking.title}</Text>
                <Text style={styles.listingSubtitle} numberOfLines={2}>{booking.address}</Text>
              </View>
            </View>

            {/* Details Rows - Mixed Vertical/Horizontal Layout */}
            {checkedInAt ? (
              <>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>CHECKED IN</Text>
                  <Text style={styles.detailValue}>{formatDateTimeLabel(checkedInAt)}</Text>
                </View>
              </>
            ) : null}
            
            {isRefunded && refundedAt ? (
              <>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>REFUNDED</Text>
                  <Text style={styles.detailValue}>{formatDateTimeLabel(refundedAt)}</Text>
                </View>
              </>
            ) : null}
          
          {/* Start and End Time - Side by Side */}
          <View style={styles.detailRowDouble}>
            <View style={styles.detailRowDoubleItem}>
              <Text style={styles.detailLabel}>START TIME</Text>
              <Text style={styles.detailValue}>{formatDateTimeLabel(start)}</Text>
            </View>
            <View style={styles.detailRowDoubleItem}>
              <Text style={styles.detailLabel}>END TIME</Text>
              <Text style={styles.detailValue}>{formatDateTimeLabel(end)}</Text>
            </View>
          </View>
          
          <View style={styles.detailRowHorizontal}>
            <Text style={styles.detailLabel}>ORDER ID</Text>
            <Text style={styles.detailValue}>{formatBookingReference(booking.id)}</Text>
          </View>
          
          {vehiclePlate ? (
            <View style={styles.detailRowHorizontal}>
              <Text style={styles.detailLabel}>VEHICLE</Text>
              <Text style={styles.detailValue}>{vehiclePlate}</Text>
            </View>
          ) : null}
          
          {showAccessCode ? (
            <View style={styles.detailRowHorizontal}>
              <Text style={styles.detailLabel}>ACCESS CODE</Text>
              <Text style={styles.detailValue}>{accessCode}</Text>
            </View>
          ) : null}
          
          <View style={styles.divider} />
          
          <View style={styles.detailRowHorizontal}>
            <Text style={styles.detailLabel}>PARKING SPOT</Text>
            <Text style={styles.detailValue}>1 x Parking Space</Text>
          </View>
          
          <View style={styles.detailRowHorizontal}>
            <Text style={styles.detailLabel}>TOTAL</Text>
            <Text style={[styles.detailValue, styles.totalValue]}>€{(localAmountCents / 100).toFixed(2)}</Text>
          </View>
          </View>
        </View>

        {/* Review Card */}
        {canReview ? (
          <TouchableOpacity 
            style={styles.reviewButton}
            onPress={() => navigation.navigate("Review", { booking })}
          >
            <Ionicons name="star-outline" size={20} color="#10B981" />
            <Text style={styles.reviewButtonText}>Leave a review</Text>
          </TouchableOpacity>
        ) : null}

        {/* Action Buttons */}
        {isUpcoming && localStatus !== "canceled" ? (
          <>
            {canCheckIn ? (
              <TouchableOpacity style={styles.actionBtn} onPress={handleCheckIn}>
                <Text style={styles.actionBtnText}>Check In</Text>
              </TouchableOpacity>
            ) : null}
            
            <TouchableOpacity
              style={[styles.actionBtn, extendBusy && styles.actionBtnDisabled]}
              onPress={() => setExtendOpen(true)}
              disabled={extendBusy}
            >
              <Text style={styles.actionBtnText}>
                {extendBusy ? "Extending..." : "Extend Booking"}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.dangerButton, canceling && styles.dangerButtonDisabled]}
              onPress={handleCancel}
              disabled={canceling}
            >
              <Text style={styles.dangerButtonText}>
                {canceling ? "Canceling..." : "Cancel Booking"}
              </Text>
            </TouchableOpacity>
            
            {extendError ? <Text style={styles.errorText}>{extendError}</Text> : null}
          </>
        ) : receiptUrl ? (
          <TouchableOpacity style={styles.actionBtn} onPress={() => Linking.openURL(receiptUrl)}>
            <Text style={styles.actionBtnText}>View Receipt</Text>
          </TouchableOpacity>
        ) : null}

        {/* Help Button */}
        <TouchableOpacity style={styles.helpButton}>
          <Ionicons name="help-circle-outline" size={28} color="#10B981" />
          <Text style={styles.helpText}>Need help?</Text>
        </TouchableOpacity>
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
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    letterSpacing: -0.2,
  },
  
  scrollContent: {
    paddingBottom: 40,
  },
  
  // Review card
  reviewCard: {
    backgroundColor: '#10B981',
    paddingVertical: 24,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 16,
    alignItems: 'center',
  },
  
  reviewTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  
  starsRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  
  // Review button
  reviewButton: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  
  reviewButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    letterSpacing: -0.2,
  },
  
  // Outer Green Card - creates the "frame" effect
  outerGreenCard: {
    backgroundColor: '#047857', // Dark green
    marginHorizontal: 20,
    borderRadius: 28, // Outer corner radius
    paddingHorizontal: 4, // Thin green "border" on sides
    paddingBottom: 4, // Thin green "border" at bottom
    overflow: 'hidden',
  },
  
  outerGreenCardCanceled: {
    backgroundColor: '#DC2626',
  },
  
  outerGreenCardRefunded: {
    backgroundColor: '#3B82F6',
  },
  
  outerGreenCardInProgress: {
    backgroundColor: '#F59E0B', // Amber/Orange
  },
  
  outerGreenCardUpcoming: {
    backgroundColor: '#8B5CF6', // Purple
  },
  
  // Status Header - dark green area at top
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  
  statusHeaderText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  
  // Inner White Content - has its own rounded corners
  innerWhiteContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 24, // Match outer container radius
    borderBottomRightRadius: 24, // Match outer container radius
    padding: 20,
  },
  
  // Listing row
  listingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    gap: 16,
  },
  
  carIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  listingText: {
    flex: 1,
  },
  
  listingName: {
    fontSize: 22,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  
  listingSubtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  
  // Detail rows - vertical stacked layout
  detailRow: {
    paddingVertical: 12,
    alignItems: 'flex-start',
  },
  
  // Detail rows - horizontal layout (label left, value right)
  detailRowHorizontal: {
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  
  // Detail rows - two columns side by side
  detailRowDouble: {
    paddingVertical: 12,
    flexDirection: 'row',
    gap: 16,
  },
  
  detailRowDoubleItem: {
    flex: 1,
    alignItems: 'flex-start',
  },
  
  detailLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    fontFamily: 'System',
  },
  
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    fontFamily: 'System',
  },
  
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 22,
    fontFamily: 'System',
  },
  
  value: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 22,
    fontFamily: 'System',
  },
  
  totalValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  
  // Map section
  mapSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  
  mapTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  
  mapAddress: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 16,
  },
  
  parkingImage: {
    height: 200,
    borderRadius: 16,
    marginBottom: 12,
    backgroundColor: '#F3F4F6',
  },
  
  map: {
    height: 200,
    borderRadius: 16,
    marginBottom: 12,
  },
  
  mapPlaceholder: {
    height: 200,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  
  mapPlaceholderText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
  
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  
  mapButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  
  // Action buttons
  actionBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 16,
    marginHorizontal: 20,
    marginTop: 16,
    alignItems: 'center',
  },
  
  actionBtnDisabled: {
    opacity: 0.6,
  },
  
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  
  dangerButton: {
    borderWidth: 2,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    paddingVertical: 14,
    borderRadius: 16,
    marginHorizontal: 20,
    marginTop: 12,
    alignItems: 'center',
  },
  
  dangerButtonText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '600',
  },
  
  dangerButtonDisabled: {
    opacity: 0.6,
  },
  
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
    marginHorizontal: 20,
  },
  
  // Help button
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    marginTop: 24,
    marginHorizontal: 20,
  },
  
  helpText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#10B981',
  },
});
