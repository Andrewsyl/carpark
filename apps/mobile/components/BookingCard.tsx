import { Pressable, StyleSheet, Text, View, Image } from "react-native";
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
  { background: string; text: string; icon: string; border: string }
> = {
  confirmed: { background: "#ecfdf5", text: "#047857", icon: "checkmark-circle", border: "#10b981" },
  completed: { background: "#f3f4f6", text: "#6b7280", icon: "checkmark-circle-outline", border: "#6b7280" },
  pending: { background: "#fef3c7", text: "#b45309", icon: "time", border: "#f59e0b" },
  canceled: { background: "#fee2e2", text: "#991b1b", icon: "close-circle-outline", border: "#ef4444" },
  refunded: { background: "#dbeafe", text: "#1e40af", icon: "arrow-undo", border: "#3b82f6" },
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
  const imageUrl = booking.imageUrls?.[0];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { borderLeftWidth: 4, borderLeftColor: badgeStyle.border },
        pressed && styles.cardPressed,
      ]}
      android_ripple={null}
    >
      <View style={styles.mainContent}>
        {imageUrl ? (
          <Image 
            source={{ uri: imageUrl }} 
            style={styles.image}
            resizeMode="cover"
          />
        ) : null}
        
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

          <View style={styles.footer}>
            <Text style={styles.viewDetails}>View details</Text>
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
    padding: 0,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
    overflow: "hidden",
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
    shadowOpacity: 0.08,
  },
  mainContent: {
    flexDirection: "row",
    gap: 12,
  },
  image: {
    width: 80,
    height: "100%",
    minHeight: 100,
  },
  textContent: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  titleSection: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  address: {
    color: colors.textMuted,
    fontSize: 13,
    flex: 1,
  },
  statusBadge: {
    borderRadius: 999,
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dateText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: "500",
  },
  separator: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: "500",
  },
  timeText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: "500",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    paddingTop: 4,
  },
  viewDetails: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.accent,
  },
});
