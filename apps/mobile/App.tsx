import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import {
  AppState,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Notifications from "expo-notifications";
import * as Linking from "expo-linking";
import { NavigationContainer, CommonActions, DefaultTheme, createNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Constants from "expo-constants";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { StripeProvider } from "@stripe/stripe-react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { enableFreeze, enableScreens } from "react-native-screens";
import { CalendarDays, Compass, Heart, UserRound } from "lucide-react-native";
import { AuthProvider, EXPO_PUSH_TOKEN_KEY, useAuth } from "./auth";
import { FavoritesProvider } from "./favorites";
import { HistoryScreen } from "./screens/HistoryScreen";
import { FavoritesScreen } from "./screens/FavoritesScreen";
import { BookingSummaryScreen } from "./screens/BookingSummaryScreen";
import { VehicleTypeScreen } from "./screens/VehicleTypeScreen";
import { ListingScreen } from "./screens/ListingScreen";
import { ListingsScreen } from "./screens/ListingsScreen";
import { HostBookingDetailScreen } from "./screens/HostBookingDetailScreen";
import { PaymentsScreen } from "./screens/PaymentsScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { PersonalInfoScreen } from "./screens/PersonalInfoScreen";
import { LoginSecurityScreen } from "./screens/LoginSecurityScreen";
import { LegalScreen } from "./screens/LegalScreen";
import { BookingDetailScreen } from "./screens/BookingDetailScreen";
import { ReviewScreen } from "./screens/ReviewScreen";
import { ListingReviewsScreen } from "./screens/ListingReviewsScreen";
import { SearchScreen } from "./screens/SearchScreen";
import { SignInScreen } from "./screens/SignInScreen";
import { RegisterScreen } from "./screens/RegisterScreen";
import { WelcomeScreen } from "./screens/WelcomeScreen";
import { ResetPasswordScreen } from "./screens/ResetPasswordScreen";
import { ListingFlowScreen } from "./screens/ListingFlowScreen";
import { EditListingScreen } from "./screens/EditListingScreen";
import { SupportScreen } from "./screens/SupportScreen";
import { AdminScreen } from "./screens/AdminScreen";
import { OnboardingPermissions } from "./screens/OnboardingPermissionsScreen";
import type { AuthStackParamList, RootStackParamList } from "./types";
import { getBooking, getMe, registerPushToken, verifyEmailToken } from "./api";
import { BottomTabButton } from "./components/BottomTabButton";
import { LoadingOverlay } from "./components/LoadingOverlay";
import { GlobalLoadingProvider, useGlobalLoading } from "./components/GlobalLoading";
import { GlobalToastProvider } from "./components/GlobalToast";
import { useGlobalToast } from "./components/GlobalToast";
import { PremiumSplash } from "./components/PremiumSplash";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { initSentry, wrapWithSentry } from "./sentry";
import {
  clearMobileE2EScenario,
  configureMobileE2EScenario,
  getMobileE2EState,
  mobileE2EEnabled,
} from "./e2e/testMode";
import { mobileEnv } from "./env";
import { resolveStripePublishableKey } from "./remoteConfig";
import { installGlobalErrorLogging, logWarn } from "./logger";
import { initPostHog } from "./posthog";
import { colors } from "./theme/colors";
import { colors as uiColors } from "./styles/theme";

const Stack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator();

// The login flow, presented as one modal card (the "Auth" root route). Welcome
// is the chooser; Sign in / Register / Reset password push horizontally within
// the same card. Deep entry points open a specific screen via
// navigation.navigate("Auth", { screen, params }).
function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Welcome" component={WelcomeScreen} />
      <AuthStack.Screen name="SignIn" component={SignInScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </AuthStack.Navigator>
  );
}
const navigationRef = createNavigationContainerRef<RootStackParamList>();

type BookingNotificationData = {
  type?: string;
  historyTab?: "upcoming" | "active" | "past";
  bookingId?: string;
};

enableScreens(true);
// Freezes off-screen screens (stops their React tree re-rendering) once
// they're covered by another screen — e.g. the map stops rendering while the
// listing page is on top of it, and vice versa on the way back. Paired with
// freezeOnBlur below on both navigators.
enableFreeze(true);
void SplashScreen.preventAutoHideAsync();
initSentry();
initPostHog();
installGlobalErrorLogging();

function App() {
  const [splashDone, setSplashDone] = useState(false);
  const [stripeKey, setStripeKey] = useState<string | null>(null);
  const [fontsLoaded] = useFonts({
    "PlusJakartaSans-Regular": require("./assets/fonts/PlusJakartaSans_400Regular.ttf"),
    "PlusJakartaSans-Medium": require("./assets/fonts/PlusJakartaSans_500Medium.ttf"),
    "PlusJakartaSans-SemiBold": require("./assets/fonts/PlusJakartaSans_600SemiBold.ttf"),
    "PlusJakartaSans-Bold": require("./assets/fonts/PlusJakartaSans_700Bold.ttf"),
    "PlusJakartaSans-ExtraBold": require("./assets/fonts/PlusJakartaSans_800ExtraBold.ttf"),
    "UKNumberPlate": require("./assets/fonts/UKNumberPlate.ttf"),
  });


  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === "android") {
      void Notifications.setNotificationChannelAsync("default", {
        name: "General",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
      // Older builds created booking-specific channels. Server pushes now use
      // the app default channel so all Android notifications use the same icon.
      void Promise.all(
        ["booking-reminders", "booking-reminders-v2"].map((id) =>
          Notifications.deleteNotificationChannelAsync(id).catch(() => undefined)
        )
      );
    }
    // Register the "Extend +" action shown on the server-sent "ends soon"
    // reminder (categoryId: "booking_ending"). Registered globally at startup
    // so the action is available whenever the push arrives.
    void Notifications.setNotificationCategoryAsync("booking_ending", [
      {
        identifier: "extend_booking",
        buttonTitle: "Extend +",
        options: { opensAppToForeground: true },
      },
    ]);
  }, []);

  // Hand the native OS splash off to the in-app PremiumSplash the moment JS can
  // draw, so the animated launch is what the user actually sees. The PremiumSplash
  // overlay is already mounted in this same render, so there's no flash of app UI.
  useEffect(() => {
    if (!fontsLoaded) return;
    const id = requestAnimationFrame(() => {
      void SplashScreen.hideAsync();
    });
    return () => cancelAnimationFrame(id);
  }, [fontsLoaded]);

  // Runs alongside font loading, not after it — resolveStripePublishableKey
  // always resolves (it falls back to the baked-in key on any failure), so
  // this never blocks startup longer than the timeout inside it.
  useEffect(() => {
    let active = true;
    void resolveStripePublishableKey().then((key) => {
      if (active) setStripeKey(key);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!fontsLoaded || !stripeKey) {
    return <View style={[styles.app, { backgroundColor: "#0A0F0D" }]} />;
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <View style={styles.app}>
          {/* merchantIdentifier must match the in-app-payments entitlement; without
              it the Payment Sheet silently hides Apple Pay. */}
          <StripeProvider
            publishableKey={stripeKey}
            merchantIdentifier="merchant.com.andrewsyl.carparking"
          >
            <AuthProvider>
              <FavoritesProvider>
                <GlobalLoadingProvider>
                  <GlobalToastProvider>
                    <AppShell />
                  </GlobalToastProvider>
                </GlobalLoadingProvider>
              </FavoritesProvider>
            </AuthProvider>
          </StripeProvider>
          {!splashDone ? <PremiumSplash onFinish={() => setSplashDone(true)} /> : null}
        </View>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

// wrapWithSentry is a passthrough when no DSN is configured; with one it adds
// touch/navigation breadcrumb instrumentation around the root component.
export default wrapWithSentry(App);

function GlobalLoadingOverlay() {
  const { loading } = useAuth();
  const { state } = useGlobalLoading();
  const visible = loading || state.visible;
  const message = loading ? "Signing in..." : state.message;
  return <LoadingOverlay visible={visible} message={message} />;
}

function AuthToastBridge() {
  const { user, loading } = useAuth();
  const { show } = useGlobalToast();
  const initialLoadDoneRef = useRef(false);
  const prevUserRef = useRef<typeof user>(undefined);

  useEffect(() => {
    if (loading) return;
    if (!initialLoadDoneRef.current) {
      initialLoadDoneRef.current = true;
      prevUserRef.current = user;
      return;
    }
    const prev = prevUserRef.current;
    prevUserRef.current = user;
    if (!prev && user) {
      const firstName = user.name?.trim().split(" ")[0];
      show(firstName ? `Welcome back, ${firstName}!` : "Welcome back!", {
        variant: "success",
        durationMs: 3500,
      });
    } else if (prev && !user) {
      show("You've been signed out", { variant: "info", durationMs: 3000 });
    }
  }, [user, loading, show]);

  return null;
}

function SplashController() {
  const { loading } = useAuth();
  useEffect(() => {
    if (!loading) void SplashScreen.hideAsync();
  }, [loading]);
  return null;
}

const ONBOARDING_KEY = "@carpark/onboarding_done";

function AppShell() {
  const { user, legalPromptRequired } = useAuth();
  const requiresLegal = !!user && (!user.termsVersion || !user.privacyVersion);
  const shouldShowLegalGate = requiresLegal && legalPromptRequired;
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingResolved, setOnboardingResolved] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((v) => {
        if (!v) setShowOnboarding(true);
      })
      .catch(() => {})
      .finally(() => setOnboardingResolved(true));
  }, []);

  const handleOnboardingComplete = () => {
    void AsyncStorage.setItem(ONBOARDING_KEY, "1");
    setShowOnboarding(false);
  };

  return (
    <>
      <SplashController />
      {onboardingResolved && !showOnboarding ? <AppNavigator /> : null}
      {showOnboarding ? (
        <OnboardingPermissions onComplete={handleOnboardingComplete} />
      ) : null}
      <AuthToastBridge />
      {shouldShowLegalGate ? <LegalGate /> : null}
      <GlobalLoadingOverlay />
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
    </>
  );
}

const TransparentTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: 'transparent' } };

function AppNavigator() {
  const { token, setAuthUser, hydrateSession } = useAuth();
  const { showError, showSuccess } = useGlobalToast();

  // Keep the latest token reachable from the notification handlers below, which
  // are registered once (empty deps) and would otherwise capture a stale token.
  const tokenRef = useRef(token);
  tokenRef.current = token;

  useEffect(() => {
    // Booking-related notification types. Keep in sync with the `type` values
    // the server sends in apps/api/src/lib/notifications.ts and
    // sendBookingStatusPush.
    const bookingTypes = new Set([
      "booking_confirmed",
      "booking_canceled",
      "booking_reminder",
      "booking_start_soon",
      "booking_end_soon",
      "booking_extend_prompt",
      "review_reminder",
    ]);

    // Fallback when we can't resolve the specific booking (no id, no session, or
    // the fetch fails): land on the relevant History sub-tab as before.
    const openHistoryList = (data: BookingNotificationData) => {
      const initialTab =
        data.historyTab === "active" || data.historyTab === "past" ? data.historyTab : "upcoming";
      navigationRef.dispatch(
        CommonActions.navigate({
          name: "Tabs",
          params: {
            screen: "History",
            params: { initialTab, refreshToken: Date.now() },
          } as RootStackParamList["Tabs"],
        })
      );
    };

    // Deep-link a notification tap to the exact place that fulfils it:
    //  • review_reminder → the Review form for that booking
    //  • everything else → the booking's detail screen (access code, directions,
    //    extend flow). The "Extend +" action opens the extend picker directly.
    const openNotificationTarget = async (
      data: BookingNotificationData | Record<string, unknown> | null | undefined,
      opts: { autoExtend?: boolean } = {}
    ) => {
      if (!data || typeof data !== "object") return;
      if (typeof data.type !== "string" || !bookingTypes.has(data.type)) return;

      const bookingId = typeof data.bookingId === "string" ? data.bookingId : null;
      const authToken = tokenRef.current;

      if (bookingId && authToken) {
        try {
          const booking = await getBooking(authToken, bookingId);
          if (data.type === "review_reminder") {
            navigationRef.dispatch(
              CommonActions.navigate({ name: "Review", params: { booking } })
            );
          } else {
            navigationRef.dispatch(
              CommonActions.navigate({
                name: "BookingDetail",
                params: { booking, autoExtend: opts.autoExtend ?? false },
              })
            );
          }
          return;
        } catch {
          // Booking couldn't be fetched (offline, deleted, etc.) — fall back.
        }
      }
      openHistoryList(data);
    };

    // On cold start from a notification tap the navigator isn't ready yet when
    // this resolves — poll briefly instead of dropping the deep-link. Also wait
    // a short while for the session to hydrate so we can deep-link rather than
    // fall back to the list.
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const data = response.notification.request.content.data as BookingNotificationData;
      const isExtend = response.actionIdentifier === "extend_booking";
      let attempts = 0;
      const navigateWhenReady = () => {
        const waitingForToken = !tokenRef.current && attempts < 40;
        if (!navigationRef.isReady() || waitingForToken) {
          if (attempts < 100) {
            attempts += 1;
            setTimeout(navigateWhenReady, 50);
          }
          return;
        }
        void openNotificationTarget(data, { autoExtend: isExtend });
      };
      navigateWhenReady();
    });

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as BookingNotificationData;
      // "Extend +" action button on the ending-soon reminder opens the booking's
      // extend picker directly.
      const isExtend = response.actionIdentifier === "extend_booking";
      void openNotificationTarget(data, { autoExtend: isExtend });
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let active = true;
    // getInitialURL and the url listener can both deliver the same link at
    // startup, so dedupe — but only within a short window. A permanent set
    // would swallow a genuine re-tap of the same link (e.g. retrying a
    // verification link after being offline).
    const handledUrls = new Map<string, number>();
    const DEDUPE_WINDOW_MS = 5000;

    const handleUrl = async (url: string | null | undefined) => {
      if (!active || !url) return;
      const lastHandledAt = handledUrls.get(url);
      if (lastHandledAt && Date.now() - lastHandledAt < DEDUPE_WINDOW_MS) return;
      handledUrls.set(url, Date.now());
      const dispatchWhenReady = (action: ReturnType<typeof CommonActions.reset> | ReturnType<typeof CommonActions.navigate>) => {
        let attempts = 0;
        const run = () => {
          if (navigationRef.isReady()) {
            navigationRef.dispatch(action);
            return;
          }
          if (attempts < 100) {
            attempts += 1;
            setTimeout(run, 50);
          }
        };
        run();
      };
      const resetToTabs = (screen: "Search" | "History" | "Favorites" | "Profile" = "Search") => {
        dispatchWhenReady(
          CommonActions.reset({
            index: 0,
            routes: [{ name: "Tabs", params: { screen } }],
          })
        );
      };
      const parsed = Linking.parse(url);
      const pathCandidate =
        ("hostname" in parsed && typeof parsed.hostname === "string" && parsed.hostname) ||
        parsed.path ||
        "";
      const path = pathCandidate.replace(/^\/+/, "");
      const tokenParam = typeof parsed.queryParams?.token === "string" ? parsed.queryParams.token : null;
      const apiBaseParam =
        typeof parsed.queryParams?.apiBase === "string" ? parsed.queryParams.apiBase : undefined;
      if (path === "e2e") {
        if (!mobileE2EEnabled) return;
        const scenarioName =
          typeof parsed.queryParams?.scenario === "string" ? parsed.queryParams.scenario : "guest-smoke";
        const scenario =
          scenarioName === "reset"
            ? (clearMobileE2EScenario(), null)
            : configureMobileE2EScenario(scenarioName);
        await hydrateSession(scenario?.authSession ?? null);
        const navigateToScenario = () => {
          if (!navigationRef.isReady()) {
            setTimeout(navigateToScenario, 50);
            return;
          }
          const target = getMobileE2EState()?.route ?? {
            name: "Tabs" as const,
            params: { screen: "Search" as const },
          };
          navigationRef.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: target.name, params: target.params }],
            })
          );
          showSuccess(`Loaded ${scenario?.name ?? "guest-smoke"} mobile test scenario.`);
        };
        navigateToScenario();
        return;
      }
      if (path.startsWith("bookings/")) {
        const bookingId = path.slice("bookings/".length);
        if (!bookingId) return;
        if (!token) {
          showError("Sign in to view your booking.");
          dispatchWhenReady(
            CommonActions.navigate({
              name: "Auth",
              params: { screen: "Welcome" },
            })
          );
          return;
        }
        try {
          const booking = await getBooking(token, bookingId, apiBaseParam);
          dispatchWhenReady(
            CommonActions.navigate({
              name: "BookingDetail",
              params: { booking } as RootStackParamList["BookingDetail"],
            })
          );
        } catch {
          showError("Could not load booking.");
          resetToTabs("History");
        }
        return;
      }
      if (path === "reset-password") {
        if (!tokenParam) {
          showError("Reset link is missing its token.");
          dispatchWhenReady(
            CommonActions.navigate({
              name: "Auth",
              params: { screen: "ResetPassword" },
            })
          );
          return;
        }
        dispatchWhenReady(
          CommonActions.navigate({
            name: "Auth",
            params: {
              screen: "ResetPassword",
              params: {
                token: tokenParam,
                apiBase: apiBaseParam,
              },
            } as { screen: "ResetPassword"; params: AuthStackParamList["ResetPassword"] },
          })
        );
        return;
      }
      if (path !== "verify-email") return;
      if (!tokenParam) {
        showError("Verification link is missing its token.");
        resetToTabs("Profile");
        return;
      }
      try {
        await verifyEmailToken(tokenParam, apiBaseParam);
        if (token) {
          const profile = await getMe(token, apiBaseParam);
          await setAuthUser(profile.user);
        }
        showSuccess("Email verified. You can continue in the app.");
        dispatchWhenReady(
          CommonActions.navigate({
            name: "Tabs",
            params: {
              screen: "Profile",
            } as RootStackParamList["Tabs"],
          })
        );
      } catch (error) {
        showError(error instanceof Error ? error.message : "Email verification failed");
        resetToTabs("Profile");
      }
    };

    void Linking.getInitialURL().then((url) => {
      void handleUrl(url);
    });

    const subscription = Linking.addEventListener("url", ({ url }) => {
      void handleUrl(url);
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, [hydrateSession, setAuthUser, showError, showSuccess, token]);

  return (
    <>
      <NavigationContainer ref={navigationRef} theme={TransparentTheme}>
        <Stack.Navigator
          // Opaque default background so a presented modal ("Auth") has a solid
          // card to scale back — that scale-back is what gives the iOS stacked
          // overlay illusion. The map-backed Listing screen overrides this to
          // transparent below.
          screenOptions={{ headerShown: false, freezeOnBlur: true, contentStyle: { backgroundColor: uiColors.appBg } }}
          initialRouteName="Tabs"
        >
          <Stack.Screen name="Tabs" component={MainTabs} />
          <Stack.Screen
            name="Listing"
            component={ListingScreen}
            options={{ contentStyle: { backgroundColor: 'transparent' }, statusBarTranslucent: true }}
          />
          <Stack.Screen name="Listings" component={ListingsScreen} />
          {/* Slides up, not across: the review step is a decision you can back
              out of, and it carries its own close button rather than a back
              arrow. A push would read as "next page in a flow"; a modal reads
              as "confirm or dismiss", which is what it is. */}
          <Stack.Screen
            name="BookingSummary"
            component={BookingSummaryScreen}
            options={{ presentation: "modal", animation: "slide_from_bottom" }}
          />
          <Stack.Screen name="VehicleType" component={VehicleTypeScreen} />
          <Stack.Screen
            name="Auth"
            component={AuthNavigator}
            options={{ presentation: "modal" }}
          />
          <Stack.Screen name="Legal" component={LegalScreen} />
          <Stack.Screen name="History" component={HistoryScreen} />
          <Stack.Screen name="Favorites" component={FavoritesScreen} />
          <Stack.Screen name="Payments" component={PaymentsScreen} />
          <Stack.Screen name="PersonalInfo" component={PersonalInfoScreen} />
          <Stack.Screen name="LoginSecurity" component={LoginSecurityScreen} />
          <Stack.Screen name="BookingDetail" component={BookingDetailScreen} />
          <Stack.Screen name="HostBookingDetail" component={HostBookingDetailScreen} />
          <Stack.Screen name="Review" component={ReviewScreen} />
          <Stack.Screen name="ListingReviews" component={ListingReviewsScreen} />
          <Stack.Screen name="Support" component={SupportScreen} />
          <Stack.Screen name="Admin" component={AdminScreen} />
          <Stack.Screen name="CreateListingFlow" component={ListingFlowScreen} />
          <Stack.Screen name="EditListing" component={EditListingScreen} />
        </Stack.Navigator>
      </NavigationContainer>
      <PushRegistration />
    </>
  );
}

function MainTabs() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(8, insets.bottom);
  const baseTabBarStyle = {
    position: "absolute" as const,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
    borderTopWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
    paddingTop: 4,
    paddingBottom: bottomPadding,
    height: 58 + bottomPadding,
  };

  const renderTabIcon = (
    focused: boolean,
    color: string,
    Icon: typeof Compass | typeof CalendarDays | typeof Heart | typeof UserRound
  ) => (
    <View style={[styles.navIconShell, focused && styles.navIconShellActive]}>
      <Icon
        size={focused ? 18 : 20}
        color={focused ? "#FFFFFF" : color}
        strokeWidth={focused ? 2.3 : 2}
      />
    </View>
  );

  return (
    <Tab.Navigator
      // Keep inactive tabs' native views ATTACHED (detach=false) so the Google
      // map never re-initializes on return, but FREEZE their JS trees off-screen
      // (freezeOnBlur=true) so the map's render churn doesn't compete with the
      // screen you switched to. Perf log proved detach=false + freeze off left
      // the map re-rendering while on Bookings — this pairing stops that while
      // still avoiding a native map rebuild on the way back.
      detachInactiveScreens={false}
      screenOptions={{
        headerShown: false,
        // Pre-mount every tab at startup (behind the splash) instead of on first
        // visit. The first tap on Bookings used to pay a cold mount (~260ms shell
        // + content fill) — with lazy:false + each screen's own deferred-content
        // pattern, no tab is ever cold when the user reaches it.
        lazy: false,
        // Light screens (Bookings/Saved/Profile) stay warm so switching to them
        // is instant — no thaw. Only the heavy map screen sets freezeOnBlur below,
        // because it's the one whose background render churn needs stopping.
        freezeOnBlur: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: "#0a8050",
        tabBarInactiveTintColor: "#98A2AD",
        tabBarStyle: baseTabBarStyle,
        tabBarBackground: () => <View style={styles.tabBarChrome} />,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarItemStyle: styles.tabBarItem,
        tabBarButton: (props) => <BottomTabButton {...props} />,
      }}
    >
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={({ route }) => ({
          // Only the map screen freezes off-screen: its render churn is heavy and
          // must not compete with the tab you switch to. The other tabs stay warm.
          freezeOnBlur: true,
          tabBarStyle: {
            ...baseTabBarStyle,
            display: (route.params as { hideTabBar?: boolean } | undefined)?.hideTabBar ? "none" : "flex",
          },
          tabBarLabel: "Discover",
          tabBarIcon: ({ focused, color }) => renderTabIcon(focused, color, Compass),
        })}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarLabel: "Bookings",
          tabBarIcon: ({ focused, color }) => renderTabIcon(focused, color, CalendarDays),
        }}
      />
      <Tab.Screen
        name="Favorites"
        component={FavoritesScreen}
        options={{
          tabBarLabel: "Saved",
          tabBarIcon: ({ focused, color }) => renderTabIcon(focused, color, Heart),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: "Profile",
          tabBarIcon: ({ focused, color }) => renderTabIcon(focused, color, UserRound),
        }}
      />
    </Tab.Navigator>
  );
}

function LegalGate() {
  const { user, acceptLegal, logout, legalPromptRequired } = useAuth();
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const legalVersion = "2026-01-10";
  const requiresLegal = !!user && (!user.termsVersion || !user.privacyVersion);
  const shouldShowLegalGate = requiresLegal && legalPromptRequired;

  if (!shouldShowLegalGate) return null;

  const handleContinue = async () => {
    if (!accepted) {
      setError("Please accept the Terms & Privacy to continue.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await acceptLegal({ termsVersion: legalVersion, privacyVersion: legalVersion });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save acceptance");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.legalOverlay} pointerEvents="auto">
      <View style={styles.legalCard}>
        <Text style={styles.legalTitle}>Terms & Privacy</Text>
        <Text style={styles.legalBody}>
          Please accept the Terms & Privacy to continue using the app.
        </Text>
        <Pressable
          style={styles.legalRow}
          onPress={() => setAccepted((value) => !value)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: accepted }}
        >
          <View style={[styles.legalCheckbox, accepted && styles.legalCheckboxChecked]}>
            {accepted ? <View style={styles.legalCheckboxInner} /> : null}
          </View>
          <Text style={styles.legalText}>I agree to the Terms & Privacy.</Text>
        </Pressable>
        {error ? <Text style={styles.legalError}>{error}</Text> : null}
        <View style={styles.legalActions}>
          <Pressable style={styles.legalSecondary} onPress={logout} disabled={saving}>
            <Text style={styles.legalSecondaryText}>Sign out</Text>
          </Pressable>
          <Pressable
            style={[styles.legalPrimary, !accepted && styles.legalPrimaryDisabled]}
            onPress={handleContinue}
            disabled={!accepted || saving}
          >
            <Text style={styles.legalPrimaryText}>{saving ? "Saving..." : "Continue"}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function PushRegistration() {
  const { token, user } = useAuth();
  const lastTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!token || !user) {
      // Signed out (or mid account-switch on a shared device): forget the
      // registered token. The Expo push token is stable per device, so without
      // this the guard below would skip re-registering the next user and they'd
      // receive no notifications until an app restart.
      lastTokenRef.current = null;
      return;
    }
    let active = true;

    const register = async () => {
      const permissions = await Notifications.getPermissionsAsync();
      if (!permissions.granted) {
        const request = await Notifications.requestPermissionsAsync();
        if (!request.granted) {
          console.warn("Push registration skipped: permissions not granted");
          return;
        }
      }
      const projectId =
        Constants.easConfig?.projectId ??
        (Constants.expoConfig as any)?.extra?.eas?.projectId ??
        mobileEnv.easProjectId;
      if (__DEV__ && !projectId) {
        console.warn("Push registration: missing EAS projectId (Expo token may be null)");
      }
      const expoTokenResult = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
      );
      const expoToken = expoTokenResult.data;
      if (!expoToken || !active) {
        console.warn("Push registration skipped: no Expo token");
        return;
      }
      if (lastTokenRef.current === expoToken) return;
      await registerPushToken({
        token,
        expoToken,
        platform: Platform.OS,
        deviceId: Constants.deviceId ?? Constants.deviceName ?? undefined,
      });
      // Persisted so logout can unregister this device (see auth.tsx).
      await AsyncStorage.setItem(EXPO_PUSH_TOKEN_KEY, expoToken);
      if (__DEV__) {
        console.log("Push registration: token stored");
      }
      lastTokenRef.current = expoToken;
    };

    void register().catch((err) => {
      logWarn("Push registration failed", { message: err instanceof Error ? err.message : String(err) });
    });
    // Re-attempt on foreground: if the user enables notifications in OS
    // Settings after denying, the earlier attempt bailed before storing a
    // token, and nothing else re-runs registration until restart/re-login.
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      void register().catch((err) => {
        logWarn("Push registration failed", { message: err instanceof Error ? err.message : String(err) });
      });
    });
    return () => {
      active = false;
      appStateSubscription.remove();
    };
  }, [token, user]);

  return null;
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: "#FCFCFB",
  },
  tabBarChrome: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#edf0f2",
    shadowColor: "#15232b",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.035,
    shadowRadius: 8,
    elevation: 6,
  },
  tabBarItem: {
    paddingTop: 0,
  },
  tabBarLabel: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 11,
    lineHeight: 14,
    marginTop: 1,
    letterSpacing: -0.1,
  },
  navIconShell: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  navIconShellActive: {
    backgroundColor: "#0a8050",
    shadowColor: "#0a8050",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  legalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 16,
  },
  legalBody: {
    color: colors.text.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  legalCard: {
    backgroundColor: colors.surface,
    borderColor: "#D1D5DB",
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    width: "100%",
  },
  legalCheckbox: {
    alignItems: "center",
    borderColor: colors.brand.tealSoft,
    borderRadius: 6,
    borderWidth: 1,
    height: 20,
    justifyContent: "center",
    marginRight: 10,
    width: 20,
  },
  legalCheckboxChecked: {
    backgroundColor: colors.brand.teal,
    borderColor: colors.brand.teal,
  },
  legalCheckboxInner: {
    backgroundColor: colors.surface,
    borderRadius: 2,
    height: 6,
    width: 6,
  },
  legalError: {
    color: colors.error.strong,
    fontSize: 12,
    marginTop: 10,
  },
  legalOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: colors.overlay.strong,
    justifyContent: "center",
    paddingHorizontal: 24,
    zIndex: 1000,
  },
  legalPrimary: {
    backgroundColor: colors.brand.teal,
    borderRadius: 12,
    marginLeft: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  legalPrimaryDisabled: {
    opacity: 0.5,
  },
  legalPrimaryText: {
    color: colors.text.inverse,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0,
  },
  legalRow: {
    alignItems: "center",
    flexDirection: "row",
    marginTop: 14,
  },
  legalSecondary: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  legalSecondaryText: {
    color: colors.text.slate,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0,
  },
  legalText: {
    color: colors.text.dark,
    fontSize: 13,
    fontWeight: "500",
  },
  legalTitle: {
    color: colors.text.dark,
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
});
