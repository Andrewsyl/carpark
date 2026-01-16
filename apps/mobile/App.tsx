import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import * as Notifications from "expo-notifications";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
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

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [splashVisible, setSplashVisible] = useState(Platform.OS === "android");
  const [launchComplete, setLaunchComplete] = useState(true);
  const splashOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!splashVisible) return;
    const timer = setTimeout(() => {
      splashOpacity.setValue(1);
      setSplashVisible(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [splashOpacity, splashVisible]);

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
                <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="Search" component={SearchScreen} />
                <Stack.Screen name="Listing" component={ListingScreen} />
                <Stack.Screen name="BookingSummary" component={BookingSummaryScreen} />
                <Stack.Screen name="SignIn" component={SignInScreen} />
                <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
                  <Stack.Screen name="Profile" component={ProfileScreen} />
                  <Stack.Screen name="Legal" component={LegalScreen} />
                <Stack.Screen name="History" component={HistoryScreen} />
                <Stack.Screen name="Favorites" component={FavoritesScreen} />
                <Stack.Screen name="Payments" component={PaymentsScreen} />
                <Stack.Screen name="Settings" component={SettingsScreen} />
                <Stack.Screen name="Listings" component={ListingsScreen} />
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
      {splashVisible ? (
        <Animated.View style={[styles.splashOverlay, { opacity: splashOpacity }]}>
          <Image source={require("./assets/splash.png")} style={styles.splashImage} />
        </Animated.View>
      ) : null}
    </View>
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
  splashImage: {
    height: "60%",
    width: "60%",
    resizeMode: "contain",
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
    fontWeight: "700",
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
    fontWeight: "600",
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
    fontWeight: "700",
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
    fontWeight: "700",
  },
});
