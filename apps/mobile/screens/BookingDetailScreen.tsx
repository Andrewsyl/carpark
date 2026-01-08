import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { cancelBooking } from "../api";
import { useAuth } from "../auth";
import type { RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "BookingDetail">;

export function BookingDetailScreen({ navigation, route }: Props) {
  const { booking } = route.params;
  const { token } = useAuth();
  const start = new Date(booking.startTime);
  const end = new Date(booking.endTime);
  const isUpcoming = end.getTime() > Date.now();
  const statusLabel = booking.status.toUpperCase();

  const handleCancel = () => {
    if (!token) return;
    Alert.alert("Cancel booking", "Cancel this reservation and release the space?", [
      { text: "Keep", style: "cancel" },
      {
        text: "Cancel booking",
        style: "destructive",
        onPress: async () => {
          await cancelBooking({ token, bookingId: booking.id });
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
        <Text style={styles.topTitle}>Booking</Text>
        <View style={styles.backButton} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{booking.title}</Text>
        <Text style={styles.subtitle}>{booking.address}</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Booking details</Text>
          <Text style={styles.cardSubtitle}>Your reservation summary.</Text>
          <View style={styles.detailList}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>STATUS</Text>
              <Text style={styles.detailValue}>{statusLabel}</Text>
            </View>
            <View style={[styles.detailRow, styles.detailRowBorder]}>
              <Text style={styles.detailLabel}>START</Text>
              <Text style={styles.detailValue}>{start.toLocaleString()}</Text>
            </View>
            <View style={[styles.detailRow, styles.detailRowBorder]}>
              <Text style={styles.detailLabel}>END</Text>
              <Text style={styles.detailValue}>{end.toLocaleString()}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>TOTAL</Text>
              <Text style={styles.totalValue}>€{(booking.amountCents / 100).toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {isUpcoming ? (
          <Pressable style={styles.dangerButton} onPress={handleCancel}>
            <Text style={styles.dangerButtonText}>Cancel booking</Text>
          </Pressable>
        ) : (
          <Pressable
            style={styles.primaryButton}
            onPress={() => navigation.navigate("Review", { booking })}
          >
            <Text style={styles.primaryButtonText}>Leave a review</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#f9fafb",
    flex: 1,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  backButton: {
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  backLabel: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "700",
  },
  topTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "700",
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 32,
  },
  title: {
    color: "#111827",
    fontSize: 24,
    fontWeight: "700",
    marginTop: 12,
  },
  subtitle: {
    color: "#6b7280",
    fontSize: 13,
    marginTop: 6,
  },
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#e5e7eb",
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 16,
    padding: 20,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  cardTitle: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "700",
  },
  cardSubtitle: {
    color: "#6b7280",
    fontSize: 13,
    marginTop: 6,
  },
  detailList: {
    borderColor: "#e5e7eb",
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
    borderTopColor: "#e5e7eb",
    borderTopWidth: 1,
  },
  detailLabel: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  detailValue: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "right",
  },
  totalRow: {
    alignItems: "center",
    backgroundColor: "#ecfdf3",
    borderTopColor: "#e5e7eb",
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
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#10b981",
    borderRadius: 12,
    marginTop: 20,
    minHeight: 44,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
});
