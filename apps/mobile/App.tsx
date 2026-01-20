import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Notifications from "expo-notifications";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";
import { StripeProvider } from "@stripe/stripe-react-native";
import { AuthProvider, useAuth } from "./auth";
import { AppLaunchContext } from "./appLaunch";
import { FavoritesProvider } from "./favorites";
import { HistoryScreen } from "./screens/HistoryScreen";
import { FavoritesScreen } from "./screens/FavoritesScreen";
import { BookingSummaryScreen } from "./screens/BookingSummaryScreen";
import { ListingScreen } from "./screens/ListingScreen";
import { ListingsScreen } from "./screens/ListingsScreen";
import { PaymentsScreen } from "./screens/PaymentsScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { LegalScreen } from "./screens/LegalScreen";
import { BookingDetailScreen } from "./screens/BookingDetailScreen";
import { ReviewScreen } from "./screens/ReviewScreen";
import { SearchScreen } from "./screens/SearchScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { SignInScreen } from "./screens/SignInScreen";
import { ResetPasswordScreen } from "./screens/ResetPasswordScreen";
import { ListingFlowScreen } from "./screens/ListingFlowScreen";
import { EditListingScreen } from "./screens/EditListingScreen";
import { SupportScreen } from "./screens/SupportScreen";
import { AdminScreen } from "./screens/AdminScreen";
import type { RootStackParamList } from "./types";
import { registerPushToken } from "./api";
import { Ionicons } from "@expo/vector-icons";
import { BottomTabButton } from "./components/BottomTabButton";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LottieView from "lottie-react-native";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

export default function App() {
  const [showStartupAnim, setShowStartupAnim] = useState(true);
  const [launchComplete, setLaunchComplete] = useState(true);
  const splashOpacity = useRef(new Animated.Value(1)).current;
  const carOpacity = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const animationFinishedRef = useRef(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(carOpacity, {
        toValue: 1,
        duration: 520,
        delay: 140,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [carOpacity, splashOpacity]);

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    void Notifications.requestPermissionsAsync();
    if (Platform.OS === "android") {
      void Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
  }, []);

  const appLaunchValue = useMemo(
    () => ({
      launchComplete,
      setLaunchComplete,
    }),
    [launchComplete]
  );


  const stripeKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

  return (
    <View style={styles.app}>
      <StripeProvider publishableKey={stripeKey} urlScheme="carparking">
        <AuthProvider>
          <FavoritesProvider>
            <AppLaunchContext.Provider value={appLaunchValue}>
              <NavigationContainer>
                <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Tabs">
                  <Stack.Screen name="Tabs" component={MainTabs} />
                  <Stack.Screen name="Listing" component={ListingScreen} />
                  <Stack.Screen name="Listings" component={ListingsScreen} />
                  <Stack.Screen name="BookingSummary" component={BookingSummaryScreen} />
                  <Stack.Screen name="SignIn" component={SignInScreen} />
                  <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
                  <Stack.Screen name="Legal" component={LegalScreen} />
                  <Stack.Screen name="History" component={HistoryScreen} />
                  <Stack.Screen name="Favorites" component={FavoritesScreen} />
                  <Stack.Screen name="Payments" component={PaymentsScreen} />
                  <Stack.Screen name="Settings" component={SettingsScreen} />
                  <Stack.Screen name="BookingDetail" component={BookingDetailScreen} />
                  <Stack.Screen name="Review" component={ReviewScreen} />
                  <Stack.Screen name="Support" component={SupportScreen} />
                  <Stack.Screen name="Admin" component={AdminScreen} />
                  <Stack.Screen name="CreateListingFlow" component={ListingFlowScreen} />
                  <Stack.Screen name="EditListing" component={EditListingScreen} />
                </Stack.Navigator>
              </NavigationContainer>
              <PushRegistration />
              <LegalGate />
              <StatusBar style="dark" translucent backgroundColor="transparent" />
            </AppLaunchContext.Provider>
          </FavoritesProvider>
        </AuthProvider>
      </StripeProvider>
      {showStartupAnim ? (
        <Animated.View style={[styles.splashOverlay, { opacity: overlayOpacity }]}>
          <Animated.View style={[styles.startupLayer, { opacity: splashOpacity }]}>
            <LottieView
              source={require("./assets/car.json")}
              autoPlay={false}
              loop={false}
              progress={0}
              style={styles.carAnimation}
            />
          </Animated.View>
          <Animated.View style={[styles.startupLayer, { opacity: carOpacity }]}>
            <LottieView
              source={require("./assets/car.json")}
              autoPlay
              loop={false}
              style={styles.carAnimation}
              onAnimationFinish={() => {
                if (animationFinishedRef.current) return;
                animationFinishedRef.current = true;
                Animated.timing(overlayOpacity, {
                  toValue: 0,
                  duration: 280,
                  easing: Easing.out(Easing.cubic),
                  useNativeDriver: true,
                }).start(() => setShowStartupAnim(false));
              }}
            />
          </Animated.View>
        </Animated.View>
      ) : null}
    </View>
  );
}

function MainTabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#047857",
        tabBarInactiveTintColor: "#9ca3af",
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopWidth: 0,
          height: 60 + insets.bottom,
          paddingBottom: Math.max(6, insets.bottom),
          paddingTop: 8,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.04,
          shadowRadius: 8,
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "500",
          marginTop: 4,
          letterSpacing: 0,
        },
        tabBarButton: (props) => <BottomTabButton {...props} />,
        tabBarItemStyle: {
          paddingVertical: 0,
          paddingTop: 0,
        },
      }}
    >
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{
          tabBarLabel: "Search",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search" size={size ?? 22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarLabel: "Bookings",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar" size={size ?? 22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: "Account",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size ?? 22} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function LegalGate() {
  const { user, acceptLegal, logout } = useAuth();
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const legalVersion = "2026-01-10";
  const requiresLegal = !!user && (!user.termsVersion || !user.privacyVersion);

  if (!requiresLegal) return null;

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
    if (!token || !user) return;
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
        (Constants.expoConfig as any)?.extra?.eas?.projectId;
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
      if (__DEV__) {
        console.log("Push registration: token stored");
      }
      lastTokenRef.current = expoToken;
    };

    void register().catch((error) => {
      console.warn("Push registration failed", error);
    });
    return () => {
      active = false;
    };
  }, [token, user?.id]);

  return null;
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
  },
  splashOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: "#F8F1E7",
    justifyContent: "center",
    zIndex: 999,
  },
  startupLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  carAnimation: {
    height: 220,
    width: 220,
  },
  legalOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    paddingHorizontal: 24,
    zIndex: 1000,
  },
  legalCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    width: "100%",
  },
  legalTitle: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  legalBody: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 8,
    lineHeight: 18,
  },
  legalRow: {
    alignItems: "center",
    flexDirection: "row",
    marginTop: 14,
  },
  legalCheckbox: {
    borderColor: "#cbd5f5",
    borderRadius: 6,
    borderWidth: 1,
    height: 20,
    marginRight: 10,
    width: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  legalCheckboxChecked: {
    borderColor: "#00d4aa",
    backgroundColor: "#00d4aa",
  },
  legalCheckboxInner: {
    backgroundColor: "#ffffff",
    borderRadius: 2,
    height: 6,
    width: 6,
  },
  legalText: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "500",
  },
  legalError: {
    color: "#dc2626",
    fontSize: 12,
    marginTop: 10,
  },
  legalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 16,
  },
  legalSecondary: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  legalSecondaryText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0,
  },
  legalPrimary: {
    backgroundColor: "#00d4aa",
    borderRadius: 12,
    marginLeft: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  legalPrimaryDisabled: {
    opacity: 0.5,
  },
  legalPrimaryText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0,
  },
});
