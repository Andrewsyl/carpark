import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CommonActions, useFocusEffect } from "@react-navigation/native";
import { Animated, BackHandler, Easing, FlatList, InteractionManager, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import LottieView from "lottie-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { listMyBookings, type BookingSummary } from "../api";
import { useAuth } from "../auth";
import { cardShadow, colors, radius, spacing, textStyles } from "../styles/theme";
import { BookingCard } from "../components/BookingCard";
import { Spinner } from "../components/Spinner";
import type { RootStackParamList } from "../types";
import { Ionicons } from "@expo/vector-icons";
import { formatDateLabel, formatTimeLabel } from "../utils/dateFormat";

type Props = NativeStackScreenProps<RootStackParamList, "History">;

export function HistoryScreen({ navigation, route }: Props) {
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<"upcoming" | "active" | "past">("upcoming");
  const [displayTab, setDisplayTab] = useState<"upcoming" | "active" | "past">("upcoming");
  const [bookings, setBookings] = useState<BookingSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [newBookingId, setNewBookingId] = useState<string | null>(null);
  const [mapCtaVisible, setMapCtaVisible] = useState(false);
  const [ratingByBookingId, setRatingByBookingId] = useState<Record<string, number>>({});
  const tabAnim = useRef(new Animated.Value(1)).current;
  const segmentWidth = useRef(0);
  const segmentAnim = useRef(new Animated.Value(0)).current;
  const newBookingSlideAnim = useRef(new Animated.Value(50)).current;
  const newBookingOpacityAnim = useRef(new Animated.Value(0)).current;

  const loadBookings = useCallback(async () => {
    if (!token) return;
    let active = true;
    setLoading(true);
    setError(null);
    try {
      const data = await listMyBookings(token);
      if (!active) return;
      setBookings(data.driverBookings ?? []);
      return data.driverBookings ?? [];
    } catch (err) {
      if (!active) return;
      setError(err instanceof Error ? err.message : "Could not load bookings");
      return [];
    } finally {
      if (active) setLoading(false);
    }
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (!bookings.length) {
      setRatingByBookingId({});
      return;
    }
    const keys = bookings.map((booking) => `bookingRating:${booking.id}`);
    void (async () => {
      try {
        const entries = await AsyncStorage.multiGet(keys);
        const nextRatings: Record<string, number> = {};
        entries.forEach(([key, value]) => {
          if (!value) return;
          try {
            const parsed = JSON.parse(value) as { rating?: number };
            if (typeof parsed.rating === "number") {
              const bookingId = key.replace("bookingRating:", "");
              nextRatings[bookingId] = parsed.rating;
            }
          } catch {
            // Ignore malformed ratings.
          }
        });
        setRatingByBookingId(nextRatings);
      } catch {
        setRatingByBookingId({});
      }
    })();
  }, [bookings]);

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
    console.log('[HistoryScreen] Setting showSuccess to true');
    setShowSuccess(true);
    
    // Reset animation values
    newBookingSlideAnim.setValue(50);
    newBookingOpacityAnim.setValue(0);
    
    // Start loading bookings immediately during animation
    console.log('[HistoryScreen] Starting to load bookings during animation');
    const previousBookingIds = new Set(bookings.map(b => b.id));
    
    void loadBookings().then((newBookings) => {
      // Find the new booking after load completes
      if (newBookings && newBookings.length > 0) {
        const newBooking = newBookings.find(b => !previousBookingIds.has(b.id));
        console.log('[HistoryScreen] Found new booking:', newBooking?.id);
        if (newBooking) {
          setNewBookingId(newBooking.id);
        }
      }
    });
    
    const hideTimer = setTimeout(() => {
      console.log('[HistoryScreen] Hiding success animation');
      setShowSuccess(false);
      
      // Trigger slide-in animation after overlay disappears
      setTimeout(() => {
        console.log('[HistoryScreen] Starting slide-in animation');
        Animated.parallel([
          Animated.spring(newBookingSlideAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 50,
            friction: 8,
          }),
          Animated.timing(newBookingOpacityAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start(() => {
          console.log('[HistoryScreen] Animation complete');
          // Clear the newBookingId after animation completes
          setTimeout(() => setNewBookingId(null), 100);
        });
      }, 100);
    }, 1800);
    
    // Clear the param immediately but don't add to deps
    navigation.setParams({ showSuccess: undefined });
    
    return () => {
      console.log('[HistoryScreen] Cleaning up timers');
      clearTimeout(hideTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const target = tab === "upcoming" ? 0 : tab === "active" ? 1 : 2;
    Animated.timing(segmentAnim, {
      toValue: target,
      duration: 250,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1), // Ease-in-out cubic
      useNativeDriver: true,
    }).start();
    
    // Defer heavy list update until after animation
    const handle = InteractionManager.runAfterInteractions(() => {
      setDisplayTab(tab);
    });
    
    return () => handle.cancel();
  }, [segmentAnim, tab]);

  useEffect(() => {
    if (!route.params?.refreshToken) return;
    void loadBookings();
    navigation.setParams({ refreshToken: undefined });
  }, [loadBookings, navigation, route.params?.refreshToken]);

  const now = new Date();
  const upcoming = bookings.filter(
    (booking) => new Date(booking.startTime) > now && booking.status !== "canceled"
  );
  const active = bookings.filter(
    (booking) => new Date(booking.startTime) <= now && new Date(booking.endTime) >= now && booking.status !== "canceled"
  );
  const past = bookings.filter((booking) => new Date(booking.endTime) < now);
  const visible = displayTab === "upcoming" ? upcoming : displayTab === "active" ? active : past;

  const items = useMemo(() => {
    const result: Array<
      | { type: "header"; id: string; label: string }
      | { type: "booking"; id: string; booking: BookingSummary }
    > = [];
    let lastLabel = "";
    const formatMonth = (value: string) =>
      new Date(value).toLocaleString("en-US", { month: "long", year: "numeric" }).toUpperCase();
    visible.forEach((booking) => {
      const label = formatMonth(booking.startTime);
      if (label !== lastLabel) {
        result.push({ type: "header", id: `header-${label}`, label });
        lastLabel = label;
      }
      result.push({ type: "booking", id: booking.id, booking });
    });
    return result;
  }, [visible]);

  const renderBookingCard = useCallback(({ item: booking }: { item: BookingSummary }) => {
    const start = new Date(booking.startTime);
    const end = new Date(booking.endTime);
    const isRefunded = booking.refundStatus === "succeeded";
    const isCompleted = displayTab === "past" && booking.status === "confirmed";
    const isActive = displayTab === "active" && booking.status === "confirmed";
    const statusLabel = isRefunded
      ? "Refunded"
      : isActive
      ? "In Progress"
      : isCompleted
      ? "Completed"
      : booking.status === "confirmed"
      ? "Confirmed"
      : booking.status === "pending"
      ? "Pending"
      : "Cancelled";
    const statusTone = isRefunded
      ? "refunded"
      : isActive
      ? "active"
      : isCompleted
      ? "completed"
      : booking.status === "confirmed"
      ? "confirmed"
      : booking.status === "pending"
      ? "pending"
      : "canceled";
    const dateLabel = formatDateLabel(start);
    const timeLabel = `${formatTimeLabel(start)} – ${formatTimeLabel(end)}`;
    
    const isNewBooking = booking.id === newBookingId;
    
    const cardContent = (
      <BookingCard
        booking={booking}
        statusLabel={statusLabel}
        statusTone={statusTone}
        dateLabel={dateLabel}
        timeLabel={timeLabel}
        rating={ratingByBookingId[booking.id]}
        onPress={() => navigation.navigate("BookingDetail", { booking })}
      />
    );
    
    if (isNewBooking) {
      return (
        <Animated.View
          style={{
            opacity: newBookingOpacityAnim,
            transform: [{ translateX: newBookingSlideAnim }],
          }}
        >
          {cardContent}
        </Animated.View>
      );
    }

    return cardContent;
  }, [navigation, displayTab, newBookingId, newBookingOpacityAnim, newBookingSlideAnim]);

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: 220, // Approximate card height + gap
    offset: 220 * index,
    index,
  }), []);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>My bookings</Text>
      </View>
      {mapCtaVisible ? (
        <View style={styles.mapCtaBanner}>
          <View style={styles.mapCtaContent}>
            <Text style={styles.mapCtaTitle}>Booking canceled</Text>
            <Text style={styles.mapCtaBody}>Space is available again</Text>
          </View>
          <Pressable
            style={styles.mapCtaButton}
            onPress={() => {
              setMapCtaVisible(false);
              navigation.navigate("Tabs", { screen: "Search" });
            }}
          >
            <Text style={styles.mapCtaButtonText}>View on map</Text>
            <Ionicons name="map-outline" size={14} color="#ffffff" />
          </Pressable>
        </View>
      ) : null}
      {/* Tab bar with underline indicator for active tab */}
      <View 
        style={styles.tabBar}
        onLayout={(event) => {
          segmentWidth.current = event.nativeEvent.layout.width;
        }}
      >
        <Pressable 
          style={styles.tab} 
          onPress={() => setTab("upcoming")}
          android_ripple={null}
        >
          <Text
            style={[
              styles.tabText,
              tab === "upcoming" && styles.tabTextActive,
            ]}
          >
            Upcoming
          </Text>
        </Pressable>
        <Pressable 
          style={styles.tab} 
          onPress={() => setTab("active")}
          android_ripple={null}
        >
          <Text
            style={[
              styles.tabText,
              tab === "active" && styles.tabTextActive,
            ]}
          >
            Active
          </Text>
        </Pressable>
        <Pressable 
          style={styles.tab} 
          onPress={() => setTab("past")}
          android_ripple={null}
        >
          <Text
            style={[
              styles.tabText,
              tab === "past" && styles.tabTextActive,
            ]}
          >
            Past
          </Text>
        </Pressable>
        {/* Animated indicator that slides between tabs */}
        <Animated.View
          style={[
            styles.tabIndicator,
            {
              transform: [
                {
                  translateX: segmentAnim.interpolate({
                    inputRange: [0, 1, 2],
                    outputRange: [0, segmentWidth.current / 3, (segmentWidth.current / 3) * 2],
                  }),
                },
              ],
            },
          ]}
        />
      </View>
      <FlatList
        data={!user ? [] : items}
        renderItem={({ item }) => {
          if (item.type === "header") {
            return <Text style={styles.monthLabel}>{item.label}</Text>;
          }
          return renderBookingCard({ item: item.booking });
        }}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) }]}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        ListHeaderComponent={
          <>
            {!user ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Sign in to view bookings</Text>
                <Text style={styles.cardBody}>
                  Log in to see your upcoming reservations and past stays.
                </Text>
                <Pressable style={styles.primaryButton} onPress={() => navigation.navigate("Welcome")}>
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
                ) : visible.length === 0 ? (
                  <View style={styles.emptyState}>
                    <View style={styles.emptyIcon}>
                      <Ionicons 
                        name={displayTab === "upcoming" ? "calendar-outline" : displayTab === "active" ? "time-outline" : "checkmark-done-outline"} 
                        size={44} 
                        color={colors.textSoft} 
                      />
                    </View>
                    <Text style={styles.emptyTitle}>
                      {displayTab === "upcoming" ? "No upcoming bookings" : displayTab === "active" ? "No active bookings" : "No past bookings"}
                    </Text>
                    <Text style={styles.emptyBody}>
                      {displayTab === "upcoming"
                        ? "Find a parking space and your next trip will show up here."
                        : displayTab === "active"
                        ? "Bookings in progress will appear here."
                        : "Completed reservations will appear here after your stay."}
                    </Text>
                    {displayTab === "upcoming" ? (
                      <Pressable
                        style={styles.primaryButton}
                        onPress={() => navigation.navigate("Tabs", { screen: "Search" })}
                        android_ripple={null}
                      >
                        <Text style={styles.primaryButtonText}>Find parking</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </>
            )}
          </>
        }
        getItemLayout={getItemLayout}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={15}
        windowSize={10}
      />
      {showSuccess ? (
        <Pressable style={styles.successOverlay} onPress={() => setShowSuccess(false)}>
          <View style={styles.successCard}>
            <LottieView
              source={require("../assets/successfully.json")}
              autoPlay
              loop={false}
              style={styles.successAnimation}
            />
            <Text style={styles.successTitle}>Booking confirmed!</Text>
            <Text style={styles.successBody}>Your reservation is saved in Upcoming</Text>
          </View>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#F9FAFB",
    flex: 1,
  },
  gradientWrapper: {
    flex: 0,
  },
  header: {
    backgroundColor: "#111827",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    letterSpacing: 0.2,
  },
  mapCtaBanner: {
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    padding: 16,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  mapCtaContent: {
    flex: 1,
  },
  mapCtaTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  mapCtaBody: {
    color: colors.textMuted,
    fontSize: 13,
  },
  mapCtaButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
  },
  mapCtaButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingHorizontal: 20,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    position: "relative",
  },
  tabText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  tabTextActive: {
    color: colors.text,
    fontWeight: "700",
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: "33.33%",
    height: 2,
    backgroundColor: colors.accent,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  tabContent: {
    flexGrow: 1,
  },
  tabLoadingContainer: {
    paddingTop: 60,
    alignItems: "center",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  monthLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    marginTop: 4,
    marginBottom: 6,
  },
  skeletonList: {
    gap: 16,
  },
  skeletonCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 20,
    padding: 20,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
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
  emptyState: {
    alignItems: "center",
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 8,
  },
  emptyBody: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
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
    backgroundColor: colors.accent,
    borderRadius: 999,
    marginTop: 8,
    minHeight: 52,
    paddingHorizontal: 32,
    paddingVertical: 14,
    alignSelf: "stretch",
    justifyContent: "center",
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  successOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.35)",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  successCard: {
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    paddingHorizontal: 24,
    paddingVertical: 20,
    ...cardShadow,
    width: 240,
  },
  successAnimation: {
    height: 140,
    width: 140,
  },
  successTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "600",
    marginTop: 6,
  },
  successBody: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 4,
    textAlign: "center",
  },
});
