import { useEffect, useRef, useState } from "react";
import { Animated, Image, Platform, StyleSheet, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "./auth";
import { HistoryScreen } from "./screens/HistoryScreen";
import { ListingScreen } from "./screens/ListingScreen";
import { ListingsScreen } from "./screens/ListingsScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { SearchScreen } from "./screens/SearchScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { SignInScreen } from "./screens/SignInScreen";
import { ListingFlowScreen } from "./screens/ListingFlowScreen";
import { EditListingScreen } from "./screens/EditListingScreen";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [splashVisible, setSplashVisible] = useState(Platform.OS === "android");
  const splashOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!splashVisible) return;
    const timer = setTimeout(() => {
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setSplashVisible(false);
      });
    }, 1650);
    return () => clearTimeout(timer);
  }, [splashOpacity, splashVisible]);

  return (
    <View style={styles.app}>
      <AuthProvider>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Search" component={SearchScreen} />
            <Stack.Screen name="Listing" component={ListingScreen} />
            <Stack.Screen name="SignIn" component={SignInScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="History" component={HistoryScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="Listings" component={ListingsScreen} />
            <Stack.Screen name="CreateListingFlow" component={ListingFlowScreen} />
            <Stack.Screen name="EditListing" component={EditListingScreen} />
          </Stack.Navigator>
        </NavigationContainer>
        <StatusBar style="dark" translucent backgroundColor="transparent" />
      </AuthProvider>
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
