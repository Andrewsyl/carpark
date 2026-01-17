import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "../styles/theme";
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
  { background: string; text: string; icon: string }
> = {
  confirmed: { background: "#ecfdf5", text: "#047857", icon: "checkmark-circle" },
  completed: { background: "#f3f4f6", text: "#6b7280", icon: "checkmark-circle-outline" },
  pending: { background: "#fef3c7", text: "#b45309", icon: "time" },
  canceled: { background: "#f3f4f6", text: "#6b7280", icon: "close-circle-outline" },
  refunded: { background: "#dbeafe", text: "#1e40af", icon: "arrow-undo" },
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
      android_ripple={null}
    >
      {/* Status badge with icon */}
      <View style={[styles.statusBadge, { backgroundColor: badgeStyle.background }]}>
        <Ionicons name={badgeStyle.icon as any} size={14} color={badgeStyle.text} />
        <Text style={[styles.statusText, { color: badgeStyle.text }]}>{statusLabel}</Text>
      </View>

      {/* Location info */}
      <View style={styles.locationSection}>
        <Text style={styles.title} numberOfLines={2}>
          {booking.title}
        </Text>
        <View style={styles.addressRow}>
          <Ionicons name="location-outline" size={14} color={colors.textSoft} />
          <Text style={styles.address} numberOfLines={1}>
            {booking.address}
          </Text>
        </View>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Date and time */}
      <View style={styles.infoSection}>
        <View style={styles.infoRow}>
          <View style={styles.iconCircle}>
            <Ionicons name="calendar" size={16} color={colors.accent} />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Date</Text>
            <Text style={styles.infoValue}>{dateLabel}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.iconCircle}>
            <Ionicons name="time" size={16} color={colors.accent} />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Time</Text>
            <Text style={styles.infoValue}>{timeLabel}</Text>
          </View>
        </View>
      </View>

      {/* Price and action */}
      <View style={styles.footer}>
        <View>
          <Text style={styles.priceLabel}>Total paid</Text>
          <Text style={styles.price}>{price}</Text>
        </View>
        <View style={styles.actionButton}>
          <Text style={styles.actionButtonText}>View details</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.accent} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 20,
    padding: 20,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
    shadowOpacity: 0.12,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
    marginBottom: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  locationSection: {
    gap: 8,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 24,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  address: {
    color: colors.textMuted,
    fontSize: 14,
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 16,
  },
  infoSection: {
    gap: 12,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: colors.textSoft,
    fontWeight: "500",
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  priceLabel: {
    fontSize: 12,
    color: colors.textSoft,
    fontWeight: "500",
    marginBottom: 4,
  },
  price: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#ecfdf5",
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.accent,
  },
});
