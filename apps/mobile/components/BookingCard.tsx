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
  statusLabel: _statusLabel,
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

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
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
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={14} color={colors.textSoft} />
              <Text style={styles.metaText}>{dateLabel}</Text>
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
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    elevation: 1,
    overflow: "hidden",
    padding: 0,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  cardPressed: {
    shadowOpacity: 0.08,
    transform: [{ scale: 0.98 }],
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
    paddingTop: 16,
    paddingBottom: 0,
    justifyContent: "flex-start",
  },
  thumb: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  thumbPlaceholder: {
    width: 80,
    height: 80,
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
    fontSize: 14,
    fontWeight: "700",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
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
  timeBlock: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  timeColumn: {
    flex: 1,
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
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  viewMoreText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "600",
  },
});
