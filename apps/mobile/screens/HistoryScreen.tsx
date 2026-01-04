import { useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "History">;

export function HistoryScreen({ navigation }: Props) {
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
        <Text style={styles.topTitle}>Bookings</Text>
        <View style={styles.backButton} />
      </View>
      <View style={styles.header}>
        <Text style={styles.kicker}>Trips</Text>
        <Text style={styles.title}>Manage your bookings</Text>
        <Text style={styles.subtitle}>
          Keep track of upcoming reservations and review past stays.
        </Text>
      </View>
      <View style={styles.segment}>
        <Pressable
          style={[styles.segmentPill, tab === "upcoming" && styles.segmentPillActive]}
          onPress={() => setTab("upcoming")}
        >
          <Text style={[styles.segmentText, tab === "upcoming" && styles.segmentTextActive]}>
            Upcoming
          </Text>
        </Pressable>
        <Pressable
          style={[styles.segmentPill, tab === "past" && styles.segmentPillActive]}
          onPress={() => setTab("past")}
        >
          <Text style={[styles.segmentText, tab === "past" && styles.segmentTextActive]}>
            Past
          </Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {tab === "upcoming" ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No upcoming bookings</Text>
            <Text style={styles.cardBody}>
              Find a space and your next reservation will show up here.
            </Text>
            <Pressable style={styles.primaryButton} onPress={() => navigation.navigate("Search")}>
              <Text style={styles.primaryButtonText}>Find parking</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No past bookings</Text>
            <Text style={styles.cardBody}>
              Completed reservations will appear here once you’ve booked a space.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#f8fafc",
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  kicker: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    color: "#0f172a",
    fontSize: 24,
    fontWeight: "800",
    marginTop: 6,
  },
  subtitle: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 6,
  },
  segment: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  segmentPill: {
    backgroundColor: "#e2e8f0",
    borderRadius: 999,
    flex: 1,
    paddingVertical: 10,
  },
  segmentPillActive: {
    backgroundColor: "#0f172a",
  },
  segmentText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  segmentTextActive: {
    color: "#ffffff",
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  cardTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "700",
  },
  cardBody: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 6,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#2563eb",
    borderRadius: 12,
    marginTop: 14,
    paddingVertical: 10,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
});
