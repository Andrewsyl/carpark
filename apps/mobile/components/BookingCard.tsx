import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../styles/theme";
import type { BookingSummary } from "../api";
import { formatBookingReference } from "../utils/bookingFormat";

type Props = {
  booking: BookingSummary;
  statusLabel: string;
  statusTone: "confirmed" | "completed" | "pending" | "canceled" | "refunded" | "active";
  dateLabel: string;
  timeLabel: string;
  rating?: number;
  onPress: () => void;
};

const STATUS_STYLES: Record<
  Props["statusTone"],
  { background: string; text: string; icon: string; border: string }
> = {
  confirmed: {
    background: colors.status.confirmed.background,
    text: colors.status.confirmed.text,
    icon: "checkmark-circle",
    border: colors.status.confirmed.border,
  },
  active: {
    background: colors.status.active.background,
    text: colors.status.active.text,
    icon: "play-circle",
    border: colors.status.active.border,
  },
  completed: {
    background: colors.status.completed.background,
    text: colors.status.completed.text,
    icon: "checkmark-circle-outline",
    border: colors.status.completed.border,
  },
  pending: {
    background: colors.status.pending.background,
    text: colors.status.pending.text,
    icon: "time",
    border: colors.status.pending.border,
  },
  canceled: {
    background: colors.status.canceled.background,
    text: colors.status.canceled.text,
    icon: "close-circle-outline",
    border: colors.status.canceled.border,
  },
  refunded: {
    background: colors.status.refunded.background,
    text: colors.status.refunded.text,
    icon: "arrow-undo",
    border: colors.status.refunded.border,
  },
};


export function BookingCard({
  booking,
  statusLabel,
  statusTone,
  dateLabel,
  timeLabel,
  rating,
  onPress,
}: Props) {
  const badgeStyle = STATUS_STYLES[statusTone];
  const ratingValue = typeof rating === "number" ? Math.round(rating) : null;
  const price = (booking.amountCents / 100).toFixed(2);
  const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const imageUrl =
    booking.imageUrls?.[0] ??
    (mapsKey && booking.latitude != null && booking.longitude != null
      ? `https://maps.googleapis.com/maps/api/streetview?size=240x240&location=${booking.latitude},${booking.longitude}&fov=70&key=${mapsKey}`
      : undefined);
  const [startTime, endTime] = timeLabel.split("–").map((item) => item.trim());
  const secondaryLabel =
    booking.accessCode
      ? "Access code"
      : booking.checkedInAt
      ? "Checked in"
      : booking.refundStatus === "succeeded"
      ? "Refunded"
      : booking.receiptUrl
      ? "Receipt available"
      : statusLabel;

  return (
    <Pressable
      onPress={onPress}
      style={styles.card}
      android_ripple={null}
    >
      <View style={styles.mainContent}>
        <View style={styles.imageWrap}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.thumb} />
          ) : (
            <View style={styles.thumbPlaceholder} />
          )}
        </View>
        <View style={styles.textContent}>
          <View style={styles.header}>
            <View style={styles.titleSection}>
              <Text style={styles.reference}>Booking ID: {formatBookingReference(booking.id)}</Text>
              <Text style={styles.title} numberOfLines={2}>
                {booking.title}
              </Text>
              <Text style={styles.address} numberOfLines={1}>
                {booking.address}
              </Text>
            </View>
            <View style={styles.priceGroup}>
              <Text style={styles.priceText}>€{price}</Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="car-outline" size={14} color={colors.textSoft} />
              <Text style={styles.metaText}>
                {booking.vehiclePlate ? booking.vehiclePlate : "Not selected"}
              </Text>
            </View>
            <View
              style={[
                styles.metaChip,
                statusTone === "canceled" && styles.metaChipDanger,
              ]}
            >
              <Ionicons
                name={statusTone === "canceled" ? "close-circle" : "checkmark-circle"}
                size={14}
                color={statusTone === "canceled" ? colors.danger : colors.accent}
              />
              <Text
                style={[
                  styles.metaChipText,
                  statusTone === "canceled" && styles.metaChipTextDanger,
                ]}
              >
                {secondaryLabel}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.timeBlock}>
        <View style={styles.timeColumn}>
          <Text style={styles.timeLabel}>Arrival</Text>
          <Text style={styles.timeValue}>{startTime}</Text>
          <Text style={styles.timeDate}>{dateLabel}</Text>
        </View>
        <View style={styles.timeArrow}>
          <Ionicons name="arrow-forward" size={16} color={colors.accent} />
        </View>
        <View style={styles.timeColumn}>
          <Text style={styles.timeLabel}>Departure</Text>
          <Text style={styles.timeValue}>{endTime}</Text>
          <Text style={styles.timeDate}>{dateLabel}</Text>
        </View>
      </View>

      <View style={styles.viewMoreRow}>
        <Text style={styles.viewMoreText}>VIEW MORE</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.accent} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: "hidden",
    padding: 0,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  mainContent: {
    flexDirection: "row",
  },
  imageWrap: {
    width: 104,
    paddingLeft: 12,
    paddingTop: 12,
    paddingBottom: 12,
    justifyContent: "center",
  },
  thumb: {
    width: 88,
    height: 88,
    borderRadius: 12,
  },
  thumbPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 12,
    backgroundColor: colors.border,
  },
  reference: {
    color: colors.textSoft,
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 4,
  },
  textContent: {
    flex: 1,
    gap: 10,
    padding: 16,
  },
  titleSection: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
  },
  address: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  priceGroup: {
    alignItems: "center",
    justifyContent: "center",
  },
  priceText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ECFDF5",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metaChipText: {
    fontSize: 11,
    color: colors.accent,
    fontWeight: "700",
  },
  metaChipDanger: {
    backgroundColor: "#FEE2E2",
  },
  metaChipTextDanger: {
    color: colors.danger,
  },
  timeBlock: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  timeColumn: {
    flex: 1,
    alignItems: "center",
  },
  timeLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: "600",
    marginBottom: 4,
  },
  timeValue: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  timeDate: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  timeArrow: {
    width: 32,
    alignItems: "center",
  },
  viewMoreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 2,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: 10,
  },
  viewMoreText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "600",
  },
});
