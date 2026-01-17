import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { cardShadow, colors, radius, spacing } from "../styles/theme";
import type { BookingSummary } from "../api";

type Props = {
  booking: BookingSummary;
  statusLabel: string;
  statusTone: "confirmed" | "completed" | "pending" | "canceled" | "refunded";
  dateLabel: string;
  timeLabel: string;
  onPress: () => void;
};

const STATUS_STYLES: Record<
  Props["statusTone"],
  { background: string; text: string }
> = {
  confirmed: { background: "#10b981", text: "#ffffff" },
  completed: { background: "#e5e7eb", text: "#111827" },
  pending: { background: "#f59e0b", text: "#ffffff" },
  canceled: { background: "#9ca3af", text: "#ffffff" },
  refunded: { background: "#3b82f6", text: "#ffffff" },
};

export function BookingCard({
  booking,
  statusLabel,
  statusTone,
  dateLabel,
  timeLabel,
  onPress,
}: Props) {
  const badgeStyle = STATUS_STYLES[statusTone];
  const price = `€${(booking.amountCents / 100).toFixed(2)}`;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.cardTopRow}>
        <Text style={styles.title} numberOfLines={1}>
          {booking.title}
        </Text>
        <View style={[styles.badge, { backgroundColor: badgeStyle.background }]}>
          <Text style={[styles.badgeText, { color: badgeStyle.text }]}>{statusLabel}</Text>
        </View>
      </View>

      <Text style={styles.address} numberOfLines={1}>
        {booking.address}
      </Text>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
          <Text style={styles.metaText}>{dateLabel}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="time-outline" size={14} color={colors.textMuted} />
          <Text style={styles.metaText}>{timeLabel}</Text>
        </View>
      </View>

      <View style={styles.cardBottomRow}>
        <Text style={styles.price}>{price}</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textSoft} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: spacing.card,
    ...cardShadow,
  },
  cardPressed: {
    transform: [{ translateY: -1 }],
    shadowOpacity: 0.18,
  },
  cardTopRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  title: {
    color: colors.text,
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    marginRight: 12,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  address: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 6,
  },
  metaRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 12,
  },
  metaItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  metaText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "500",
  },
  cardBottomRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  price: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
});
