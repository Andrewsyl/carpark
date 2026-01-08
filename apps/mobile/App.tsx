import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Image, Platform, StyleSheet, View } from "react-native";
import * as Notifications from "expo-notifications";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { StripeProvider } from "@stripe/stripe-react-native";
import { AuthProvider } from "./auth";
import { AppLaunchContext } from "./appLaunch";
import { FavoritesProvider } from "./favorites";
import { HistoryScreen } from "./screens/HistoryScreen";
import { FavoritesScreen } from "./screens/FavoritesScreen";
import { BookingSummaryScreen } from "./screens/BookingSummaryScreen";
import { ListingScreen } from "./screens/ListingScreen";
import { ListingsScreen } from "./screens/ListingsScreen";
import { PaymentsScreen } from "./screens/PaymentsScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { BookingDetailScreen } from "./screens/BookingDetailScreen";
import { ReviewScreen } from "./screens/ReviewScreen";
import { SearchScreen } from "./screens/SearchScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { SignInScreen } from "./screens/SignInScreen";
import { ListingFlowScreen } from "./screens/ListingFlowScreen";
import { EditListingScreen } from "./screens/EditListingScreen";
import type { RootStackParamList } from "./types";

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
      <StripeProvider publishableKey={stripeKey}>
        <AuthProvider>
          <FavoritesProvider>
            <AppLaunchContext.Provider value={appLaunchValue}>
              <NavigationContainer>
                <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="Search" component={SearchScreen} />
                <Stack.Screen name="Listing" component={ListingScreen} />
                <Stack.Screen name="BookingSummary" component={BookingSummaryScreen} />
                  <Stack.Screen name="SignIn" component={SignInScreen} />
                  <Stack.Screen name="Profile" component={ProfileScreen} />
                <Stack.Screen name="History" component={HistoryScreen} />
                <Stack.Screen name="Favorites" component={FavoritesScreen} />
                <Stack.Screen name="Payments" component={PaymentsScreen} />
                <Stack.Screen name="Settings" component={SettingsScreen} />
                <Stack.Screen name="Listings" component={ListingsScreen} />
                <Stack.Screen name="BookingDetail" component={BookingDetailScreen} />
                <Stack.Screen name="Review" component={ReviewScreen} />
                <Stack.Screen name="CreateListingFlow" component={ListingFlowScreen} />
                  <Stack.Screen name="EditListing" component={EditListingScreen} />
                </Stack.Navigator>
              </NavigationContainer>
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
});
