import { useCallback, useEffect, useRef, useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CommonActions, useFocusEffect } from "@react-navigation/native";
import { Animated, BackHandler, Easing, FlatList, InteractionManager, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { listMyBookings, type BookingSummary } from "../api";
import { useAuth } from "../auth";
import { cardShadow, colors, radius, spacing, textStyles } from "../styles/theme";
import { BookingCard } from "../components/BookingCard";
import { Spinner } from "../components/Spinner";
import type { RootStackParamList } from "../types";
import { Ionicons } from "@expo/vector-icons";

type Props = NativeStackScreenProps<RootStackParamList, "History">;

export function HistoryScreen({ navigation, route }: Props) {
  const { token, user } = useAuth();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [displayTab, setDisplayTab] = useState<"upcoming" | "past">("upcoming");
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
    (booking) => new Date(booking.endTime) >= now && booking.status !== "canceled"
  );
  const past = bookings.filter((booking) => new Date(booking.endTime) < now);
  const visible = displayTab === "upcoming" ? upcoming : past;

  const renderBookingCard = useCallback(({ item: booking }: { item: BookingSummary }) => {
    const start = new Date(booking.startTime);
    const end = new Date(booking.endTime);
    const isRefunded = booking.refundStatus === "succeeded";
    const isCompleted = displayTab === "past" && booking.status === "confirmed";
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
        booking={booking}
        statusLabel={statusLabel}
        statusTone={statusTone}
        dateLabel={dateLabel}
        timeLabel={timeLabel}
        onPress={() => navigation.navigate("BookingDetail", { booking })}
      />
    );
  }, [navigation, displayTab]);

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: 220, // Approximate card height + gap
    offset: 220 * index,
    index,
  }), []);

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
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Your Trips</Text>
            <Text style={styles.title}>Bookings</Text>
          </View>
        </View>
        {user && (
          <Text style={styles.subtitle}>
            {upcoming.length} upcoming · {past.length} completed
          </Text>
        )}
      </View>
      {successVisible ? (
        <View style={styles.successBanner}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={24} color="#047857" />
          </View>
          <View style={styles.successContent}>
            <Text style={styles.successTitle}>Booking confirmed!</Text>
            <Text style={styles.successBody}>Your reservation is saved in Upcoming</Text>
          </View>
        </View>
      ) : null}
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
                    inputRange: [0, 1],
                    outputRange: [0, segmentWidth.current / 2],
                  }),
                },
              ],
            },
          ]}
        />
      </View>
      <FlatList
        data={!user ? [] : visible}
        renderItem={renderBookingCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        ListHeaderComponent={
          <>
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
                ) : visible.length === 0 ? (
                  <View style={styles.emptyState}>
                    <View style={styles.emptyIcon}>
                      <Ionicons 
                        name={displayTab === "upcoming" ? "calendar-outline" : "checkmark-done-outline"} 
                        size={44} 
                        color={colors.textSoft} 
                      />
                    </View>
                    <Text style={styles.emptyTitle}>
                      {displayTab === "upcoming" ? "No upcoming bookings" : "No past bookings"}
                    </Text>
                    <Text style={styles.emptyBody}>
                      {displayTab === "upcoming"
                        ? "Find a parking space and your next trip will show up here."
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.appBg,
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: colors.cardBg,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  greeting: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.textMuted,
    marginBottom: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: "500",
    marginTop: 4,
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ecfdf5",
    borderRadius: 16,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    padding: 16,
    gap: 12,
  },
  successIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#d1fae5",
    alignItems: "center",
    justifyContent: "center",
  },
  successContent: {
    flex: 1,
  },
  successTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 2,
  },
  successBody: {
    color: colors.textMuted,
    fontSize: 13,
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
    fontWeight: "700",
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
    fontWeight: "700",
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
    paddingVertical: 16,
    position: "relative",
  },
  tabText: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: "600",
  },
  tabTextActive: {
    color: colors.text,
    fontWeight: "700",
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: "50%",
    height: 3,
    backgroundColor: colors.accent,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
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
    fontWeight: "700",
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
    fontWeight: "700",
  },
});
