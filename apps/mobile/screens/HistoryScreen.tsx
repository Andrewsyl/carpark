import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { SquircleBtn } from "../components/SquircleBtn";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CommonActions, useFocusEffect } from "@react-navigation/native";
import { Animated, BackHandler, Easing, FlatList, Image, InteractionManager, PanResponder, Platform, Pressable, StatusBar, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { listMyBookings, type BookingSummary } from "../api";
import { useAuth } from "../auth";
import { useToastOnMessage } from "../components/GlobalToast";
import { useGlobalLoading } from "../components/GlobalLoading";
import { BookingCard } from "../components/BookingCard";
import type { RootStackParamList } from "../types";
import { CalendarDays, ChevronDown, Map } from "lucide-react-native";
import { formatDateLabel, formatTimeLabel } from "../utils/dateFormat";
import { colors, cardShadow, radius } from "../styles/theme";

type Props = NativeStackScreenProps<RootStackParamList, "History">;

// Sourced from styles/theme.ts (see docs/PARKING_DESIGN_BIBLE.md §0) — kept as
// local aliases so the styles below don't need touching one by one.
const ACCENT  = colors.primary;
const FG      = colors.text;
const MUTED   = colors.textMuted;
const SUBTLE  = colors.textSoft;
const LINE    = colors.divider;
const BG      = colors.pageBg;

const CARD_SHADOW = cardShadow;

// Small hand-drawn "spark" mark for the booking-confirmed moment — a single
// fixed SVG path, no animation. Scoped to this screen for now.
function SparkDoodle({ size = 30, color = "#FFFFFF", opacity = 1 }: { size?: number; color?: string; opacity?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none" opacity={opacity}>
      <Path
        d="M32 4C32 20 30 30 14 32C30 34 32 44 32 60C32 44 34 34 50 32C34 30 32 20 32 4Z"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Stale-while-revalidate cache for the driver's bookings, held for the app
// session and keyed by user id. Re-entering the tab paints the last list
// instantly while a silent fetch refreshes in the background, so there's no
// cold-load blank on every visit. Keyed by user so a different account never
// sees the previous one's cached bookings.
let cachedBookings: BookingSummary[] | null = null;
let cachedBookingsUserId: string | null = null;
let lastBookingsFetch = 0;

type PaneTab = "upcoming" | "active" | "past";

type PaneItem =
  | { type: "header"; id: string; label: string }
  | { type: "booking"; id: string; booking: BookingSummary };

// Stable identity for the signed-out/unrevealed case so memoized panes don't
// see a fresh [] every render.
const EMPTY_PANE_ITEMS: PaneItem[] = [];

function PaneSkeletonList() {
  return (
    <View style={styles.skeletonList}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.skeletonCard}>
          <View style={styles.skeletonTop}>
            <View style={styles.skeletonImage} />
            <View style={styles.skeletonInfo}>
              <View style={styles.skeletonTitleRow}>
                <View style={styles.skeletonTitle} />
                <View style={styles.skeletonPrice} />
              </View>
              <View style={styles.skeletonAddress} />
              <View style={styles.skeletonMeta} />
            </View>
          </View>
          <View style={styles.skeletonStrip} />
        </View>
      ))}
    </View>
  );
}

// One pager pane (FlatList + header states), memoized so the tab-switch-time
// re-renders of HistoryScreen (focus effects, silent revalidation, clock tick)
// skip reconciling all three lists when their props are unchanged. This is what
// keeps switching to this tab cheap — measured, the triple-list re-render was
// the bulk of the switch cost.
const HistoryPane = memo(function HistoryPane({
  paneTab,
  data,
  width,
  bottomPad,
  signedIn,
  showSkeleton,
  showEmpty,
  hasMorePast,
  onLoadMore,
  onSignIn,
  onFindParking,
  renderBooking,
}: {
  paneTab: PaneTab;
  data: PaneItem[];
  width: number;
  bottomPad: number;
  signedIn: boolean;
  showSkeleton: boolean;
  showEmpty: boolean;
  hasMorePast: boolean;
  onLoadMore: () => void;
  onSignIn: () => void;
  onFindParking: () => void;
  renderBooking: (booking: BookingSummary, paneTab: PaneTab) => ReactElement;
}) {
  return (
    <View style={{ width }}>
      <FlatList
        data={data}
        renderItem={({ item }) => {
          if (item.type === "header") {
            return <Text style={styles.monthLabel}>{item.label}</Text>;
          }
          return renderBooking(item.booking, paneTab);
        }}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
        // 16 between cards, per the design — the extra 2 is what stops a
        // list of bordered cards reading as one ruled block.
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        ListFooterComponent={
          paneTab === "past" && hasMorePast ? (
            <Pressable style={styles.loadMoreButton} onPress={onLoadMore}>
              <Text style={styles.loadMoreText}>Load more</Text>
              <ChevronDown size={14} color={ACCENT} strokeWidth={2.2} />
            </Pressable>
          ) : null
        }
        ListHeaderComponent={
          <>
            {!signedIn ? (
              <View style={styles.signInCard}>
                <View style={styles.signInIconWrap}>
                  <CalendarDays size={28} color={ACCENT} strokeWidth={2} />
                </View>
                <Text style={styles.signInTitle}>Sign in to view bookings</Text>
                <Text style={styles.signInBody}>
                  Log in to see your upcoming reservations and past stays.
                </Text>
                <SquircleBtn label="Sign in" onPress={onSignIn} fullWidth />
              </View>
            ) : (
              <>
                {showSkeleton ? (
                  <PaneSkeletonList />
                ) : showEmpty ? (
                  <View style={styles.emptyState}>
                    <Image
                      source={
                        paneTab === "active"
                          ? require("../assets/illustrations/calendar-bro.png")
                          : paneTab === "upcoming"
                          ? require("../assets/illustrations/calendar-amico.png")
                          : require("../assets/illustrations/calendar-pana.png")
                      }
                      style={styles.emptyImage}
                      resizeMode="contain"
                      fadeDuration={0}
                    />
                    <Text style={styles.emptyTitle}>
                      {paneTab === "upcoming"
                        ? "no bookings yet."
                        : paneTab === "active"
                        ? "nothing active right now."
                        : "no history yet."}
                    </Text>
                    <Text style={styles.emptyBody}>
                      {paneTab === "upcoming"
                        ? "Find a parking space and your next trip will show up here."
                        : paneTab === "active"
                        ? "Bookings in progress will appear here."
                        : "Completed reservations will appear here after your stay."}
                    </Text>
                    {paneTab === "upcoming" ? (
                      <SquircleBtn label="Find parking" onPress={onFindParking} fullWidth />
                    ) : null}
                  </View>
                ) : null}
              </>
            )}
          </>
        }
        removeClippedSubviews={false}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={15}
        windowSize={10}
      />
    </View>
  );
});

export function HistoryScreen({ navigation, route }: Props) {
  const { token, user } = useAuth();
  const { reset: resetGlobalLoading } = useGlobalLoading();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const screenWidthRef = useRef(screenWidth);
  useEffect(() => { screenWidthRef.current = screenWidth; }, [screenWidth]);
  const [tab, setTab] = useState<"upcoming" | "active" | "past">("upcoming");
  const [displayTab, setDisplayTab] = useState<"upcoming" | "active" | "past">("upcoming");
  const cacheValid = cachedBookings !== null && cachedBookingsUserId === (user?.id ?? null);
  const [bookings, setBookings] = useState<BookingSummary[]>(cacheValid ? cachedBookings! : []);
  const [isSwitchingTab, setIsSwitchingTab] = useState(false);
  const [tabSwitchingTo, setTabSwitchingTo] = useState<"upcoming" | "active" | "past">("upcoming");
  const [pastVisibleCount, setPastVisibleCount] = useState(20);
  const [loading, setLoading] = useState(!cacheValid);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successTab, setSuccessTab] = useState<"upcoming" | "active" | "past">("upcoming");
  const [newBookingId, setNewBookingId] = useState<string | null>(null);
  const pendingNewBookingId = useRef<string | null>(null);
  const [mapCtaVisible, setMapCtaVisible] = useState(false);
  const [ratingByBookingId, setRatingByBookingId] = useState<Record<string, number>>({});
  const tabAnim = useRef(new Animated.Value(1)).current;
  const segmentAnim = useRef(new Animated.Value(0)).current;
  const tabWidth = (screenWidth - 40) / 3;
  const newBookingSlideAnim = useRef(new Animated.Value(50)).current;
  const newBookingOpacityAnim = useRef(new Animated.Value(0)).current;
  const lastTabIndexRef = useRef(0);
  const skipNextFocusReload = useRef(false);
  const hideSuccessCallback = useRef<(() => void) | null>(null);
  const [revealBookings, setRevealBookings] = useState(true);
  const [bookingTransitioning, setBookingTransitioning] = useState(false);
  const [loadingSkeletonVisible, setLoadingSkeletonVisible] = useState(false);
  // Paint a lightweight skeleton on first mount and defer the heavy 3-pane
  // FlatList pager until after the tab transition settles. Measured: mounting
  // the pager synchronously cost ~260ms before the switch showed. Once ready it
  // stays ready (the tab is kept warm), so return visits render content directly.
  const [heavyReady, setHeavyReady] = useState(false);

  const TABS = ["upcoming", "active", "past"] as const;
  const dragOffsetAnim = useRef(new Animated.Value(0)).current;
  const currentTabIndexRef = useRef(0);
  const swipeHandledRef = useRef(false);

  const snapToTab = (idx: number) => {
    Animated.spring(segmentAnim, {
      toValue: idx,
      tension: 260,
      friction: 28,
      useNativeDriver: true,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
      onPanResponderGrant: () => {
        segmentAnim.stopAnimation();
        dragOffsetAnim.setValue(0);
      },
      onPanResponderMove: (_, gesture) => {
        dragOffsetAnim.setValue(gesture.dx);
      },
      onPanResponderRelease: (_, gesture) => {
        const idx = currentTabIndexRef.current;
        const sw = screenWidthRef.current;
        const posThreshold = sw * 0.25;
        const velThreshold = 0.4;

        let next = idx;
        if ((gesture.dx < -posThreshold || gesture.vx < -velThreshold) && idx < TABS.length - 1) next = idx + 1;
        else if ((gesture.dx > posThreshold || gesture.vx > velThreshold) && idx > 0) next = idx - 1;

        // Move segmentAnim to the apparent visual position so the snap starts from here
        segmentAnim.setValue(idx - gesture.dx / sw);
        dragOffsetAnim.setValue(0);

        if (next !== idx) {
          swipeHandledRef.current = true;
          currentTabIndexRef.current = next;
          snapToTab(next);
          setTab(TABS[next]);
        } else {
          snapToTab(idx);
        }
      },
      onPanResponderTerminate: () => {
        const idx = currentTabIndexRef.current;
        dragOffsetAnim.setValue(0);
        snapToTab(idx);
      },
    })
  ).current;

  useToastOnMessage(error, { variant: "danger" });

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle("dark-content");
      if (Platform.OS === "android") {
        StatusBar.setBackgroundColor(BG);
      }
      return () => {
        StatusBar.setBarStyle("dark-content");
        if (Platform.OS === "android") {
          StatusBar.setBackgroundColor(BG);
        }
      };
    }, [])
  );

  const loadBookings = useCallback(async (options?: { silent?: boolean }): Promise<BookingSummary[]> => {
    if (!token || !user) {
      setBookings([]);
      cachedBookings = null;
      cachedBookingsUserId = null;
      setError(null);
      if (!options?.silent) {
        setLoading(false);
      }
      return [];
    }
    // When the cache already holds this user's bookings, revalidate silently so
    // the cached list stays on screen instead of flashing a skeleton on re-entry.
    const silent = options?.silent ?? (cachedBookings !== null && cachedBookingsUserId === user.id);
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const data = await listMyBookings(token);
      const list = data.driverBookings ?? [];
      // Skip the state update when the refetch returns identical data — the
      // common case for the silent focus revalidation. Keeping the old array
      // identity lets the memoized panes skip re-rendering on tab entry.
      const prev = cachedBookingsUserId === user.id ? cachedBookings : null;
      const unchanged =
        prev !== null && prev.length === list.length && JSON.stringify(prev) === JSON.stringify(list);
      cachedBookingsUserId = user.id;
      if (unchanged) return prev;
      cachedBookings = list;
      setBookings(list);
      return list;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load bookings");
      return [];
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [token, user]);

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

  // Mount the heavy pager only after the tab-switch interaction finishes, so the
  // first paint (skeleton) is instant. runAfterInteractions fires right after the
  // transition, not on a timer, so there's no artificial delay.
  useEffect(() => {
    if (heavyReady) return;
    const handle = InteractionManager.runAfterInteractions(() => setHeavyReady(true));
    return () => handle.cancel();
  }, [heavyReady]);

  // Show the skeleton immediately while loading. A layout-mirroring placeholder
  // is honest feedback; the previous 200ms delay left the screen blank on entry
  // and read as a hang before content (or the empty state) appeared.
  useEffect(() => {
    setLoadingSkeletonVisible(loading);
  }, [loading]);

  useEffect(() => {
    if (user) return;
    setBookings([]);
    setLoading(false);
    setError(null);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (skipNextFocusReload.current) {
        skipNextFocusReload.current = false;
        return;
      }
      const now = Date.now();
      if (now - lastBookingsFetch < 15_000) return;
      lastBookingsFetch = now;
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
    resetGlobalLoading();
    let cancelled = false;
    const targetTab = (route.params?.initialTab ?? "upcoming") as
      | "upcoming"
      | "active"
      | "past";
    setSuccessTab(targetTab);
    setTab(targetTab);
    setDisplayTab(targetTab);
    setIsSwitchingTab(false);
    setTabSwitchingTo(targetTab);
    segmentAnim.setValue(targetTab === "upcoming" ? 0 : targetTab === "active" ? 1 : 2);
    lastTabIndexRef.current = targetTab === "upcoming" ? 0 : targetTab === "active" ? 1 : 2;
    setRevealBookings(false);
    setBookingTransitioning(true);
    setLoading(false);
    setError(null);

    newBookingSlideAnim.setValue(50);
    newBookingOpacityAnim.setValue(0);
    const previousBookingIds = new Set(bookings.map((b) => b.id));
    skipNextFocusReload.current = true;
    const startTime = Date.now();
    void loadBookings({ silent: true }).then((newBookings) => {
      if (cancelled) return;
      resetGlobalLoading();
      const list = newBookings ?? [];
      let nextBooking = list.find((b) => !previousBookingIds.has(b.id));
      if (!nextBooking && list.length > 0) {
        nextBooking = [...list].sort(
          (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
        )[0];
      }
      pendingNewBookingId.current = nextBooking?.id ?? null;

      const elapsed = Date.now() - startTime;
      const minOverlayMs = 400;
      const delay = Math.max(0, minOverlayMs - elapsed);

      setTimeout(() => {
        if (cancelled) return;
        hideSuccessCallback.current = () => {
          if (cancelled) return;
          setShowSuccess(false);
          setRevealBookings(true);
          setBookingTransitioning(false);
          const idToAnimate = pendingNewBookingId.current;
          if (idToAnimate) {
            setNewBookingId(idToAnimate);
            requestAnimationFrame(() => {
              Animated.parallel([
                Animated.spring(newBookingSlideAnim, {
                  toValue: 0,
                  useNativeDriver: true,
                  tension: 50,
                  friction: 8,
                }),
                Animated.timing(newBookingOpacityAnim, {
                  toValue: 1,
                  duration: 350,
                  useNativeDriver: true,
                }),
              ]).start(() => setNewBookingId(null));
            });
          }
        };
        setShowSuccess(true);
      }, delay);
    });

    navigation.setParams({ showSuccess: undefined, refreshToken: undefined, initialTab: undefined });
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-advance the success panel after a fixed dwell — no animation to key
  // off now that the checkmark is a static doodle rather than a Lottie clip.
  useEffect(() => {
    if (!showSuccess) return;
    const timer = setTimeout(() => {
      hideSuccessCallback.current?.();
      hideSuccessCallback.current = null;
    }, 1400);
    return () => clearTimeout(timer);
  }, [showSuccess]);

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
    const currentIndex = tab === "upcoming" ? 0 : tab === "active" ? 1 : 2;
    lastTabIndexRef.current = currentIndex;
    currentTabIndexRef.current = currentIndex;
    tabAnim.setValue(0);
    Animated.timing(tabAnim, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [tab, tabAnim]);

  useEffect(() => {
    const target = tab === "upcoming" ? 0 : tab === "active" ? 1 : 2;
    setIsSwitchingTab(true);
    setTabSwitchingTo(tab);

    if (swipeHandledRef.current) {
      swipeHandledRef.current = false;
      setDisplayTab(tab);
      setIsSwitchingTab(false);
      return;
    }

    Animated.timing(segmentAnim, {
      toValue: target,
      duration: 250,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: true,
    }).start();

    const handle = InteractionManager.runAfterInteractions(() => {
      setDisplayTab(tab);
      setIsSwitchingTab(false);
    });

    return () => handle.cancel();
  }, [segmentAnim, tab]);

  useEffect(() => {
    if (!route.params?.refreshToken) return;
    void loadBookings();
    navigation.setParams({ refreshToken: undefined });
  }, [loadBookings, navigation, route.params?.refreshToken]);

  // Re-bucket every minute so bookings move between Upcoming/Active/Past while
  // the screen stays open.
  const [nowMs, setNowMs] = useState(() => Date.now());
  // Re-bucket only while focused (and refresh on focus) so the timer isn't
  // firing on a backgrounded tab.
  useFocusEffect(
    useCallback(() => {
      // Bail when the clock barely moved: an unconditional setNowMs re-rendered
      // the whole screen (all three panes) on every tab entry.
      setNowMs((prev) => (Date.now() - prev > 30_000 ? Date.now() : prev));
      const interval = setInterval(() => setNowMs(Date.now()), 60_000);
      return () => clearInterval(interval);
    }, [])
  );
  // Bucket at minute resolution so re-renders reuse the same arrays — stable
  // identities are what let the memoized panes skip re-rendering.
  const nowMinute = Math.floor(nowMs / 60_000);
  const { upcoming, active, past } = useMemo(() => {
    const now = new Date(nowMinute * 60_000);
    return {
      upcoming: bookings.filter(
        (booking) => new Date(booking.startTime) > now && booking.status !== "canceled"
      ),
      active: bookings.filter(
        (booking) =>
          new Date(booking.startTime) <= now && new Date(booking.endTime) >= now && booking.status !== "canceled"
      ),
      past: bookings.filter(
        (booking) => booking.status === "canceled" || new Date(booking.endTime) < now
      ),
    };
  }, [bookings, nowMinute]);
  const visiblePast = useMemo(() => past.slice(0, pastVisibleCount), [past, pastVisibleCount]);
  const hasMorePast = past.length > pastVisibleCount;

  const paneItemsByTab = useMemo(() => {
    const build = (data: BookingSummary[]): PaneItem[] => {
      const result: PaneItem[] = [];
      let lastLabel = "";
      const formatMonth = (value: string) =>
        new Date(value).toLocaleString("en-US", { month: "long", year: "numeric" }).toUpperCase();
      data.forEach((booking) => {
        const label = formatMonth(booking.startTime);
        if (label !== lastLabel) {
          result.push({ type: "header", id: `header-${label}`, label });
          lastLabel = label;
        }
        result.push({ type: "booking", id: booking.id, booking });
      });
      return result;
    };
    return { upcoming: build(upcoming), active: build(active), past: build(visiblePast) };
  }, [upcoming, active, visiblePast]);

  const handleLoadMorePast = useCallback(() => setPastVisibleCount((prev) => prev + 20), []);
  const handleSignIn = useCallback(() => navigation.navigate("Auth", { screen: "Welcome" }), [navigation]);
  const handleFindParking = useCallback(
    () => navigation.navigate("Tabs", { screen: "Search" }),
    [navigation]
  );

  useEffect(() => {
    if (displayTab !== "past") return;
    if (pastVisibleCount < 20) {
      setPastVisibleCount(20);
    }
  }, [displayTab, pastVisibleCount]);

  const renderBookingCard = useCallback((
    booking: BookingSummary, paneTab: PaneTab
  ) => {
    const start = new Date(booking.startTime);
    const end = new Date(booking.endTime);
    const isRefunded = booking.refundStatus === "succeeded";
    const isCompleted = paneTab === "past" && booking.status === "confirmed";
    const isActive = paneTab === "active" && booking.status === "confirmed";
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
  }, [navigation, newBookingId, newBookingOpacityAnim, newBookingSlideAnim, ratingByBookingId]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>My Bookings</Text>
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
            <Map size={14} color="#ffffff" strokeWidth={2.2} />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.tabBar}>
        {(["upcoming", "active", "past"] as const).map((t) => (
          <Pressable
            key={t}
            style={styles.tab}
            onPress={() => setTab(t)}
            android_ripple={null}
          >
            <View style={styles.tabLabelRow}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === "upcoming" ? "Upcoming" : t === "active" ? "Active" : "Past"}
              </Text>
              {((t === "upcoming" && upcoming.length > 0) || (t === "active" && active.length > 0)) ? (
                <View style={styles.tabDot} />
              ) : null}
            </View>
          </Pressable>
        ))}
        <Animated.View
          style={[
            styles.tabIndicator,
            { width: tabWidth },
            {
              transform: [
                {
                  translateX: segmentAnim.interpolate({
                    inputRange: [0, 1, 2],
                    outputRange: [20, 20 + tabWidth, 20 + tabWidth * 2],
                  }),
                },
              ],
            },
          ]}
        />
      </View>

      <View style={styles.contentWrapper} {...panResponder.panHandlers}>
        {!heavyReady ? (
          <View style={styles.content}>
            <PaneSkeletonList />
          </View>
        ) : (
        <Animated.View
          style={{
            flex: 1,
            flexDirection: "row",
            width: screenWidth * 3,
            transform: [
              {
                translateX: Animated.add(
                  segmentAnim.interpolate({
                    inputRange: [-1, 0, 1, 2, 3],
                    outputRange: [screenWidth, 0, -screenWidth, -screenWidth * 2, -screenWidth * 3],
                  }),
                  dragOffsetAnim
                ) as unknown as Animated.AnimatedInterpolation<number>,
              },
            ],
          }}
        >
          {(["upcoming", "active", "past"] as const).map((paneTab) => {
            const paneData =
              paneTab === "upcoming" ? upcoming : paneTab === "active" ? active : visiblePast;
            const showPaneSkeleton =
              ((loading && loadingSkeletonVisible) || (isSwitchingTab && paneTab === tabSwitchingTo)) &&
              !bookingTransitioning;
            const showPaneEmpty =
              !loading && !showPaneSkeleton && paneData.length === 0;

            return (
              <HistoryPane
                key={paneTab}
                paneTab={paneTab}
                data={!user || !revealBookings ? EMPTY_PANE_ITEMS : paneItemsByTab[paneTab]}
                width={screenWidth}
                bottomPad={Math.max(insets.bottom + 96, 120)}
                signedIn={!!user}
                showSkeleton={showPaneSkeleton}
                showEmpty={showPaneEmpty}
                hasMorePast={hasMorePast}
                onLoadMore={handleLoadMorePast}
                onSignIn={handleSignIn}
                onFindParking={handleFindParking}
                renderBooking={renderBookingCard}
              />
            );
          })}
        </Animated.View>
        )}
      </View>

      {showSuccess ? (
        <Pressable style={styles.successOverlay} onPress={() => setShowSuccess(false)}>
          <View style={styles.successCard}>
            <View style={styles.successDoodle} pointerEvents="none">
              <SparkDoodle size={30} color="rgba(255,255,255,0.35)" />
            </View>
            <SparkDoodle size={40} color="#FFFFFF" />
            <Text style={styles.successKicker}>nice one</Text>
            <Text style={styles.successTitle}>you're parked.</Text>
            <Text style={styles.successBody}>
              Saved in {successTab === "active" ? "Active" : successTab === "past" ? "Past" : "Upcoming"}.
            </Text>
          </View>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: BG,
    flex: 1,
  },
  contentWrapper: {
    flex: 1,
    backgroundColor: BG,
  },

  // ── Header ───────────────────────────────────────────────────
  header: {
    backgroundColor: BG,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
  },
  // Large ink title matching the Favourites header (TGTG-style reference,
  // user-approved 2026-07-09).
  title: {
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 30,
    lineHeight: 36,
    color: FG,
    letterSpacing: -0.8,
  },

  // ── Map CTA banner ───────────────────────────────────────────
  mapCtaBanner: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: radius.cardSmall,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    ...CARD_SHADOW,
  },
  mapCtaContent: { flex: 1 },
  mapCtaTitle: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    lineHeight: 20,
    color: FG,
    marginBottom: 2,
  },
  mapCtaBody: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    lineHeight: 18,
    color: MUTED,
  },
  mapCtaButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 6,
  },
  mapCtaButtonText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    color: "#ffffff",
  },

  // ── Tab bar ──────────────────────────────────────────────────
  tabBar: {
    flexDirection: "row",
    backgroundColor: BG,
    paddingHorizontal: 20,
    paddingTop: 6,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
  },
  tabLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tabText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    color: SUBTLE,
    fontSize: 14,
    letterSpacing: 0.1,
  },
  // Bold as well as green: colour alone left the selected tab reading the
  // same weight as the two beside it.
  tabTextActive: {
    color: ACCENT,
    fontFamily: "PlusJakartaSans-Bold",
  },
  tabDot: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: ACCENT,
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: "33.33%",
    height: 2,
    backgroundColor: ACCENT,
    borderRadius: radius.pill,
  },

  // ── Content ──────────────────────────────────────────────────
  content: {
    paddingHorizontal: 20,
    paddingTop: 0,
  },
  monthLabel: {
    fontFamily: "PlusJakartaSans-Bold",
    color: SUBTLE,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 16,
    marginBottom: 8,
  },

  // ── Skeleton ─────────────────────────────────────────────────
  skeletonList: { gap: 14 },
  skeletonCard: {
    backgroundColor: "#ffffff",
    borderRadius: radius.cardSmall,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    ...CARD_SHADOW,
  },
  skeletonTop: {
    flexDirection: "row",
    padding: 14,
    gap: 12,
  },
  skeletonImage: {
    width: 82,
    height: 82,
    borderRadius: 12,
    backgroundColor: LINE,
  },
  skeletonInfo: {
    flex: 1,
    gap: 8,
    justifyContent: "center",
  },
  skeletonTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  skeletonTitle: {
    flex: 1,
    height: 14,
    borderRadius: 6,
    backgroundColor: LINE,
  },
  skeletonPrice: {
    width: 40,
    height: 14,
    borderRadius: 6,
    backgroundColor: LINE,
  },
  skeletonAddress: {
    height: 11,
    borderRadius: 6,
    backgroundColor: LINE,
    width: "65%",
  },
  skeletonMeta: {
    height: 11,
    borderRadius: 6,
    backgroundColor: LINE,
    width: "45%",
  },
  skeletonStrip: {
    height: 52,
    backgroundColor: BG,
    borderTopWidth: 1,
    borderTopColor: LINE,
  },

  // ── Sign-in card ─────────────────────────────────────────────
  signInCard: {
    backgroundColor: "#ffffff",
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    alignItems: "center",
    ...CARD_SHADOW,
  },
  signInIconWrap: {
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    backgroundColor: "#F0FDF8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  signInTitle: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 18,
    lineHeight: 24,
    color: FG,
    marginBottom: 6,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  signInBody: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 15,
    lineHeight: 22,
    color: MUTED,
    textAlign: "center",
    marginBottom: 18,
  },

  // ── Load more ────────────────────────────────────────────────
  loadMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 12,
    paddingVertical: 14,
    ...CARD_SHADOW,
  },
  loadMoreText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    color: ACCENT,
  },

  // ── Empty state ──────────────────────────────────────────────
  emptyState: {
    alignItems: "center",
    paddingTop: 40,
    paddingHorizontal: 24,
  },
  emptyImage: {
    width: 164,
    height: 164,
    marginBottom: 6,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: "#F0FDF8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 21,
    lineHeight: 27,
    color: FG,
    marginBottom: 8,
    textAlign: "center",
    letterSpacing: -0.4,
  },
  emptyBody: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 16,
    lineHeight: 23,
    color: MUTED,
    textAlign: "center",
    marginBottom: 22,
  },

  // ── Success overlay ──────────────────────────────────────────
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
    alignItems: "flex-start",
    backgroundColor: ACCENT,
    borderRadius: radius.card,
    paddingHorizontal: 28,
    paddingVertical: 28,
    width: 300,
    overflow: "hidden",
    position: "relative",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  successDoodle: {
    position: "absolute",
    top: 12,
    right: 12,
  },
  successKicker: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 13,
    lineHeight: 18,
    color: "#F5B73B",
    marginTop: 10,
    textTransform: "lowercase",
  },
  successTitle: {
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 28,
    lineHeight: 32,
    color: "#ffffff",
    marginTop: 2,
    letterSpacing: -0.6,
  },
  successBody: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255,255,255,0.8)",
    marginTop: 8,
  },
});
