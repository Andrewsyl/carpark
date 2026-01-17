import { useCallback, useEffect, useRef, useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CommonActions, useFocusEffect } from "@react-navigation/native";
import { Animated, BackHandler, Easing, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { listMyBookings, type BookingSummary } from "../api";
import { useAuth } from "../auth";
import { cardShadow, colors, radius, spacing, textStyles } from "../styles/theme";
import { BookingCard } from "../components/BookingCard";
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
  const tabAnim = useRef(new Animated.Value(1)).current;
  const segmentWidth = useRef(0);
  const segmentAnim = useRef(new Animated.Value(0)).current;

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
            routes: [{ name: "Tabs", params: { screen: "Search" } }],
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
    tabAnim.setValue(0);
    Animated.timing(tabAnim, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [tab, tabAnim]);

  useEffect(() => {
    const target = tab === "upcoming" ? 0 : 1;
    Animated.spring(segmentAnim, {
      toValue: target,
      useNativeDriver: true,
      friction: 7,
      tension: 80,
    }).start();
  }, [segmentAnim, tab]);

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

  const formatDate = (date: Date) =>
    date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  const formatTime = (date: Date) =>
    date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable
          style={styles.backButton}
          onPress={() =>
            navigation.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: "Tabs", params: { screen: "Search" } }],
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
        <Text style={styles.kicker}>Your trips</Text>
        <Text style={styles.title}>Bookings</Text>
        <Text style={styles.subtitle}>Your parking stays, all in one place.</Text>
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
              navigation.navigate("Tabs", { screen: "Search" });
            }}
          >
            <Text style={styles.mapCtaButtonText}>View on map</Text>
          </Pressable>
        </View>
      ) : null}
      {/* Segmented control keeps tab context visible while saving vertical space. */}
      <View
        style={styles.segment}
        onLayout={(event) => {
          segmentWidth.current = event.nativeEvent.layout.width;
        }}
      >
        <Animated.View
          style={[
            styles.segmentIndicator,
            {
              transform: [
                {
                  translateX: segmentAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, segmentWidth.current / 2],
                  }),
                },
              ],
            },
          ]}
        />
        <Pressable style={styles.segmentTab} onPress={() => setTab("upcoming")}>
          <Text style={[styles.segmentText, tab === "upcoming" && styles.segmentTextActive]}>
            Upcoming
          </Text>
        </Pressable>
        <Pressable style={styles.segmentTab} onPress={() => setTab("past")}>
          <Text style={[styles.segmentText, tab === "past" && styles.segmentTextActive]}>
            Past
          </Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View
          style={[
            styles.tabContent,
            {
              opacity: tabAnim,
              transform: [
                {
                  translateY: tabAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [8, 0],
                  }),
                },
              ],
            },
          ]}
        >
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
                <View style={styles.skeletonList}>
                  {[0, 1, 2].map((item) => (
                    <View key={item} style={styles.skeletonCard}>
                      <View style={styles.skeletonRow}>
                        <View style={styles.skeletonTitle} />
                        <View style={styles.skeletonBadge} />
                      </View>
                      <View style={styles.skeletonLine} />
                      <View style={styles.skeletonMetaRow}>
                        <View style={styles.skeletonMeta} />
                        <View style={styles.skeletonMeta} />
                      </View>
                      <View style={styles.skeletonPrice} />
                    </View>
                  ))}
                </View>
              ) : null}
              {visible.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="calendar-outline" size={32} color={colors.textSoft} />
                  <Text style={styles.emptyTitle}>
                    {tab === "upcoming" ? "No upcoming bookings yet" : "No past bookings"}
                  </Text>
                  <Text style={styles.emptyBody}>
                    {tab === "upcoming"
                      ? "Find a space and your next trip will show up here."
                      : "Completed reservations will appear here after your stay."}
                  </Text>
                  {tab === "upcoming" ? (
                    <Pressable
                      style={styles.primaryButton}
                      onPress={() => navigation.navigate("Tabs", { screen: "Search" })}
                    >
                      <Text style={styles.primaryButtonText}>Find parking</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : (
                <View style={styles.list}>
                  {/* Cards highlight status + timing first for quick scanning. */}
                  {visible.map((booking) => {
                    const start = new Date(booking.startTime);
                    const end = new Date(booking.endTime);
                    const isRefunded = booking.refundStatus === "succeeded";
                    const isCompleted = tab === "past" && booking.status === "confirmed";
                    const statusLabel = isRefunded
                      ? "Refunded"
                      : isCompleted
                      ? "Completed"
                      : booking.status === "confirmed"
                      ? "Confirmed"
                      : booking.status === "pending"
                      ? "Pending"
                      : "Cancelled";
                    const statusTone = isRefunded
                      ? "refunded"
                      : isCompleted
                      ? "completed"
                      : booking.status === "confirmed"
                      ? "confirmed"
                      : booking.status === "pending"
                      ? "pending"
                      : "canceled";
                    const dateLabel = formatDate(start);
                    const timeLabel = `${formatTime(start)} – ${formatTime(end)}`;

                    return (
                      <BookingCard
                        key={booking.id}
                        booking={booking}
                        statusLabel={statusLabel}
                        statusTone={statusTone}
                        dateLabel={dateLabel}
                        timeLabel={timeLabel}
                        onPress={() => navigation.navigate("BookingDetail", { booking })}
                      />
                    );
                  })}
                </View>
              )}
            </>
          )}
        </Animated.View>
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
    backgroundColor: colors.headerTint,
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
    fontSize: 18,
    fontWeight: "700",
  },
  header: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.screenY,
    paddingBottom: spacing.screenY,
  },
  kicker: {
    ...textStyles.kicker,
  },
  title: {
    ...textStyles.title,
    fontSize: 28,
    marginTop: 6,
  },
  subtitle: {
    ...textStyles.subtitle,
    marginTop: 6,
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
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    marginHorizontal: spacing.screenX,
    marginTop: 8,
    overflow: "hidden",
    padding: 2,
  },
  segmentIndicator: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    height: "100%",
    left: 0,
    position: "absolute",
    top: 0,
    width: "50%",
    zIndex: 0,
  },
  tabContent: {
    flexGrow: 1,
  },
  segmentTab: {
    alignItems: "center",
    flex: 1,
    paddingVertical: 10,
    zIndex: 1,
  },
  segmentText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  segmentTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  content: {
    paddingHorizontal: spacing.screenX,
    paddingTop: 16,
  },
  skeletonList: {
    gap: 16,
  },
  skeletonCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: spacing.card,
    ...cardShadow,
  },
  skeletonRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  skeletonTitle: {
    backgroundColor: "#e5e7eb",
    borderRadius: 6,
    height: 16,
    width: "55%",
  },
  skeletonBadge: {
    backgroundColor: "#e5e7eb",
    borderRadius: 999,
    height: 20,
    width: 64,
  },
  skeletonLine: {
    backgroundColor: "#e5e7eb",
    borderRadius: 6,
    height: 12,
    marginTop: 12,
    width: "70%",
  },
  skeletonMetaRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  skeletonMeta: {
    backgroundColor: "#e5e7eb",
    borderRadius: 6,
    height: 12,
    width: 90,
  },
  skeletonPrice: {
    backgroundColor: "#e5e7eb",
    borderRadius: 6,
    height: 18,
    marginTop: 16,
    width: 80,
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
  emptyState: {
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    gap: 8,
    padding: spacing.card,
    textAlign: "center",
    ...cardShadow,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  emptyBody: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
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
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#10b981",
    borderRadius: 12,
    marginTop: 14,
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignSelf: "stretch",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
});
