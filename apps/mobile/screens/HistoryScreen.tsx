import { useCallback, useEffect, useMemo, useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CommonActions, useFocusEffect } from "@react-navigation/native";
import { ActivityIndicator, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { listMyBookings, type BookingSummary } from "../api";
import { useAuth } from "../auth";
import { cardShadow, colors, radius, spacing, textStyles } from "../styles/theme";
import type { RootStackParamList } from "../types";
import { Ionicons } from "@expo/vector-icons";

type Props = NativeStackScreenProps<RootStackParamList, "History">;

export function HistoryScreen({ navigation, route }: Props) {
  const { token, user } = useAuth();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [bookings, setBookings] = useState<BookingSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successVisible, setSuccessVisible] = useState(false);
  const [mapCtaVisible, setMapCtaVisible] = useState(false);

  const loadBookings = useCallback(async () => {
    if (!token) return;
    let active = true;
    setLoading(true);
    setError(null);
    try {
      const data = await listMyBookings(token);
      if (!active) return;
      setBookings(data.driverBookings ?? []);
    } catch (err) {
      if (!active) return;
      setError(err instanceof Error ? err.message : "Could not load bookings");
    } finally {
      if (active) setLoading(false);
    }
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  useFocusEffect(
    useCallback(() => {
      void loadBookings();
    }, [loadBookings])
  );

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: "Search" }],
          })
        );
        return true;
      };
      const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => subscription.remove();
    }, [navigation])
  );

  useEffect(() => {
    if (!route.params?.showSuccess) return;
    setSuccessVisible(true);
    navigation.setParams({ showSuccess: undefined });
    const timer = setTimeout(() => setSuccessVisible(false), 2400);
    return () => clearTimeout(timer);
  }, [navigation, route.params?.showSuccess]);

  useEffect(() => {
    if (!route.params?.showMapCTA) return;
    setMapCtaVisible(true);
    navigation.setParams({ showMapCTA: undefined });
  }, [navigation, route.params?.showMapCTA]);

  useEffect(() => {
    if (!route.params?.initialTab) return;
    setTab(route.params.initialTab);
    navigation.setParams({ initialTab: undefined });
  }, [navigation, route.params?.initialTab]);

  useEffect(() => {
    if (!route.params?.refreshToken) return;
    void loadBookings();
    navigation.setParams({ refreshToken: undefined });
  }, [loadBookings, navigation, route.params?.refreshToken]);

  const now = new Date();
  const upcoming = bookings.filter(
    (booking) => new Date(booking.endTime) >= now && booking.status !== "canceled"
  );
  const past = bookings.filter((booking) => new Date(booking.endTime) < now);
  const visible = tab === "upcoming" ? upcoming : past;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable
          style={styles.backButton}
          onPress={() =>
            navigation.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: "Search" }],
              })
            )
          }
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
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
      {successVisible ? (
        <View style={styles.successBanner}>
          <Text style={styles.successTitle}>✓ Booking confirmed</Text>
          <Text style={styles.successBody}>Your reservation is saved in Upcoming.</Text>
        </View>
      ) : null}
      {mapCtaVisible ? (
        <View style={styles.mapCtaBanner}>
          <View>
            <Text style={styles.mapCtaTitle}>Booking canceled</Text>
            <Text style={styles.mapCtaBody}>Space is available again.</Text>
          </View>
          <Pressable
            style={styles.mapCtaButton}
            onPress={() => {
              setMapCtaVisible(false);
              navigation.navigate("Search");
            }}
          >
            <Text style={styles.mapCtaButtonText}>View on map</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.segment}>
        <Pressable
          style={[styles.segmentTab, tab === "upcoming" && styles.segmentTabActive]}
          onPress={() => setTab("upcoming")}
        >
          <Text style={[styles.segmentText, tab === "upcoming" && styles.segmentTextActive]}>
            Upcoming
          </Text>
        </Pressable>
        <Pressable
          style={[styles.segmentTab, tab === "past" && styles.segmentTabActive]}
          onPress={() => setTab("past")}
        >
          <Text style={[styles.segmentText, tab === "past" && styles.segmentTextActive]}>
            Past
          </Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {!user ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign in to view bookings</Text>
            <Text style={styles.cardBody}>
              Log in to see your upcoming reservations and past stays.
            </Text>
            <Pressable style={styles.primaryButton} onPress={() => navigation.navigate("SignIn")}>
              <Text style={styles.primaryButtonText}>Sign in</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {loading ? (
              <View style={styles.loadingOverlay} pointerEvents="none">
                <View style={styles.loadingBadge}>
                  <ActivityIndicator size="small" color="#10b981" />
                  <Text style={styles.loadingText}>Loading bookings…</Text>
                </View>
              </View>
            ) : null}
            {visible.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  {tab === "upcoming" ? "No upcoming bookings" : "No past bookings"}
                </Text>
                <Text style={styles.cardBody}>
                  {tab === "upcoming"
                    ? "Find a space and your next reservation will show up here."
                    : "Completed reservations will appear here once you’ve booked a space."}
                </Text>
                {tab === "upcoming" ? (
                  <Pressable
                    style={styles.primaryButton}
                    onPress={() => navigation.navigate("Search")}
                  >
                    <Text style={styles.primaryButtonText}>Find parking</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <View style={styles.list}>
                {visible.map((booking) => {
                  const start = new Date(booking.startTime);
                  const end = new Date(booking.endTime);
                  const isRefunded = booking.refundStatus === "succeeded";
                  const statusLabel = isRefunded ? "refunded" : booking.status;
                  const refundedAt = booking.refundedAt ? new Date(booking.refundedAt) : null;
                  return (
                    <Pressable
                      key={booking.id}
                      style={styles.bookingCard}
                      onPress={() => navigation.navigate("BookingDetail", { booking })}
                    >
                      <View
                        style={[
                          styles.statusPill,
                          isRefunded && styles.statusRefunded,
                          !isRefunded && booking.status === "confirmed" && styles.statusConfirmed,
                          !isRefunded && booking.status === "pending" && styles.statusPending,
                          !isRefunded && booking.status === "canceled" && styles.statusCanceled,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            isRefunded && styles.statusTextRefunded,
                            !isRefunded && booking.status === "confirmed" && styles.statusTextConfirmed,
                            !isRefunded && booking.status === "pending" && styles.statusTextPending,
                            !isRefunded && booking.status === "canceled" && styles.statusTextCanceled,
                          ]}
                        >
                          {statusLabel}
                        </Text>
                      </View>
                      <Text style={styles.bookingTitle}>{booking.title}</Text>
                      <Text style={styles.bookingAddress}>{booking.address}</Text>
                      <Text style={styles.bookingTime}>
                        {start.toLocaleDateString()} • {start.toLocaleTimeString()} – {end.toLocaleTimeString()}
                      </Text>
                      {isRefunded ? (
                        <Text style={styles.bookingRefunded}>
                          Refunded {refundedAt ? refundedAt.toLocaleDateString() : ""}
                        </Text>
                      ) : null}
                      <Text style={styles.bookingPrice}>€{(booking.amountCents / 100).toFixed(2)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>
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
  header: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.screenY,
  },
  kicker: {
    ...textStyles.kicker,
  },
  title: {
    ...textStyles.title,
    marginTop: 8,
  },
  subtitle: {
    ...textStyles.subtitle,
    marginTop: 8,
  },
  successBanner: {
    backgroundColor: "#d1fae5",
    borderRadius: radius.card,
    marginHorizontal: spacing.screenX,
    marginBottom: 16,
    paddingHorizontal: spacing.screenX,
    paddingVertical: 16,
  },
  successTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  successBody: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 6,
  },
  mapCtaBanner: {
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: spacing.screenX,
    marginBottom: 16,
    paddingHorizontal: spacing.screenX,
    paddingVertical: 16,
    ...cardShadow,
  },
  mapCtaTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  mapCtaBody: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  mapCtaButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  mapCtaButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  segment: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    paddingHorizontal: spacing.screenX,
    paddingTop: 8,
  },
  segmentTab: {
    alignItems: "center",
    flex: 1,
    paddingBottom: 14,
    paddingTop: 8,
  },
  segmentTabActive: {
    borderBottomColor: colors.accent,
    borderBottomWidth: 2,
  },
  segmentText: {
    color: colors.textSoft,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  segmentTextActive: {
    color: colors.text,
  },
  content: {
    paddingHorizontal: spacing.screenX,
    paddingBottom: 32,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
  },
  loadingBadge: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderRadius: radius.card,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    ...cardShadow,
  },
  list: {
    gap: 16,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: spacing.card,
    ...cardShadow,
  },
  bookingCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: spacing.card,
    ...cardShadow,
  },
  bookingTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  statusPill: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    position: "absolute",
    right: 16,
    top: 16,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  statusConfirmed: {
    backgroundColor: colors.accent,
  },
  statusPending: {
    backgroundColor: "#f59e0b",
  },
  statusCanceled: {
    backgroundColor: "#6b7280",
  },
  statusRefunded: {
    backgroundColor: "#3b82f6",
  },
  statusTextConfirmed: {
    color: "#ffffff",
  },
  statusTextPending: {
    color: "#ffffff",
  },
  statusTextCanceled: {
    color: "#ffffff",
  },
  statusTextRefunded: {
    color: "#ffffff",
  },
  bookingAddress: {
    color: colors.textSoft,
    fontSize: 14,
    marginTop: 4,
  },
  bookingTime: {
    color: colors.textSoft,
    fontSize: 14,
    marginTop: 8,
  },
  bookingRefunded: {
    color: "#3b82f6",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 8,
  },
  bookingPrice: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
    marginTop: 12,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  cardBody: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 6,
  },
  error: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderRadius: 12,
    borderWidth: 1,
    color: "#b42318",
    fontSize: 12,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  loadingText: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "600",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#10b981",
    borderRadius: 12,
    marginTop: 14,
    minHeight: 44,
    paddingVertical: 10,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
});
