import { Pressable, StyleSheet, Text, View } from "react-native";
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

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { borderLeftWidth: 0 },
        pressed && styles.cardPressed,
      ]}
      android_ripple={null}
    >
      <View style={styles.mainContent}>
        <View style={styles.textContent}>
          <View style={styles.header}>
            <View style={styles.titleSection}>
              <Text style={styles.title} numberOfLines={1}>
                {booking.title}
              </Text>
              <View style={styles.addressRow}>
                <Ionicons name="location-outline" size={12} color={colors.textSoft} />
                <Text style={styles.address} numberOfLines={1}>
                  {booking.address}
                </Text>
              </View>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: badgeStyle.background }]}>
              <Ionicons name={badgeStyle.icon as any} size={12} color={badgeStyle.text} />
            </View>
          </View>

          <View style={styles.timeRow}>
            <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
            <Text style={styles.dateText}>{dateLabel}</Text>
            <Text style={styles.separator}>•</Text>
            <Ionicons name="time-outline" size={14} color={colors.textMuted} />
            <Text style={styles.timeText}>{timeLabel}</Text>
          </View>

          {ratingValue ? (
            <View style={styles.ratingRow}>
              {Array.from({ length: 5 }).map((_, index) => (
                <Ionicons
                  key={`rating-${booking.id}-${index}`}
                  name={index < ratingValue ? "star" : "star-outline"}
                  size={13}
                  color={index < ratingValue ? colors.star.active : colors.star.inactive}
                />
              ))}
            </View>
          ) : null}

          <View style={styles.footer}>
            <Text style={styles.reference}>{formatBookingReference(booking.id)}</Text>
            <View style={styles.viewDetailsRow}>
              <Text style={styles.viewDetails}>View details</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.accent} />
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  address: {
    color: colors.textMuted,
    flex: 1,
    fontSize: 13,
  },
  addressRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
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
  dateText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "500",
  },
  footer: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 4,
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  mainContent: {
    flexDirection: "row",
  },
  ratingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 2,
  },
  reference: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  separator: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "500",
  },
  statusBadge: {
    alignItems: "center",
    borderRadius: 999,
    justifyContent: "center",
    padding: 6,
  },
  textContent: {
    flex: 1,
    gap: 12,
    padding: 16,
  },
  timeRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  timeText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "500",
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
  },
  titleSection: {
    flex: 1,
    gap: 4,
  },
  viewDetails: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "600",
  },
  viewDetailsRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
});

