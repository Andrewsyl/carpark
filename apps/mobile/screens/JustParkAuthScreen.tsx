import { useEffect, useState } from "react";
import {
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../auth";
import type { RootStackParamList } from "../types";

type InputFieldProps = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  placeholder: string;
  secureTextEntry?: boolean;
};

function InputField({ icon, placeholder, secureTextEntry }: InputFieldProps) {
  return (
    <View style={styles.inputWrapper}>
      <MaterialCommunityIcons name={icon} size={20} color="#6b8b86" />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#9aa5a1"
        secureTextEntry={secureTextEntry}
      />
    </View>
  );
}

export function JustParkAuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const { loginWithOAuth } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID ?? "";
  useEffect(() => {
    GoogleSignin.configure({
      webClientId: googleWebClientId || undefined,
    });
  }, [googleWebClientId]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.screen}>
        <View style={styles.headerSection}>
          <Text style={styles.headerTitle}>Hello!</Text>
          <Text style={styles.headerSubtitle}>Welcome to ParkingApp</Text>
        </View>

        <Image source={require("../assets/whitecar2.png")} style={styles.carImage} />

        <View style={styles.formSection}>
          <Text style={styles.formTitle}>{isLogin ? "Login" : "Sign Up"}</Text>

          {!isLogin ? <InputField icon="account" placeholder="Full name" /> : null}
          <InputField icon="email-outline" placeholder="Email address" />
          <InputField icon="lock-outline" placeholder="Password" secureTextEntry />
          {!isLogin ? (
            <InputField icon="lock-check-outline" placeholder="Confirm password" secureTextEntry />
          ) : null}

          {isLogin ? (
            <TouchableOpacity style={styles.forgotRow}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>
              {isLogin ? "Login" : "Create Account"}
            </Text>
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Or login with</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.socialRow}>
            <TouchableOpacity style={styles.socialButton}>
              <MaterialCommunityIcons name="facebook" size={22} color="#247881" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.socialButton}
              onPress={async () => {
                setAuthError(null);
                try {
                  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
                  const userInfo = await GoogleSignin.signIn();
                  const tokens = await GoogleSignin.getTokens();
                  const idToken = userInfo.idToken ?? tokens.idToken;
                  if (!idToken) {
                    throw new Error("Missing Google idToken");
                  }
                  await loginWithOAuth("google", idToken);
                  navigation.replace("Tabs", { screen: "Search" });
                } catch (err) {
                  const errorCode =
                    err && typeof err === "object" && "code" in err ? String(err.code) : "";
                  if (errorCode === statusCodes.SIGN_IN_CANCELLED) {
                    return;
                  }
                  const message = err instanceof Error ? err.message : "Google sign-in failed";
                  setAuthError(errorCode ? `${message} (${errorCode})` : message);
                }
              }}
            >
              <MaterialCommunityIcons name="google" size={22} color="#247881" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialButton}>
              <MaterialCommunityIcons name="apple" size={22} color="#247881" />
            </TouchableOpacity>
          </View>
          {authError ? <Text style={styles.errorText}>{authError}</Text> : null}

          <TouchableOpacity style={styles.footerToggle} onPress={() => setIsLogin(!isLogin)}>
            <Text style={styles.footerText}>
              {isLogin ? "Don't have account? " : "Already have account? "}
              <Text style={styles.footerLink}>{isLogin ? "Sign Up" : "Login"}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#247881",
  },
  screen: {
    flex: 1,
    position: "relative",
  },
  headerSection: {
    flex: 0.25,
    justifyContent: "flex-end",
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 34,
    fontWeight: "700",
  },
  headerSubtitle: {
    color: "#e5f1ef",
    fontSize: 16,
    marginTop: 6,
  },
  carImage: {
    width: 280,
    height: 150,
    position: "absolute",
    right: -40,
    top: "16%",
    zIndex: 10,
    resizeMode: "contain",
    backgroundColor: "transparent",
    transform: [{ scaleX: -1 }],
  },
  formSection: {
    flex: 0.75,
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    padding: 20,
    paddingTop: 30,
  },
  formTitle: {
    color: "#247881",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 18,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F4F3",
    borderRadius: 25,
    height: 55,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  input: {
    flex: 1,
    marginLeft: 10,
    color: "#123c37",
    fontSize: 15,
  },
  forgotRow: {
    alignItems: "flex-end",
    marginTop: -4,
    marginBottom: 18,
  },
  forgotText: {
    color: "#247881",
    fontSize: 13,
    fontWeight: "600",
  },
  primaryButton: {
    backgroundColor: "#247881",
    borderRadius: 30,
    height: 55,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 22,
    marginBottom: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#d6e0dd",
  },
  dividerText: {
    color: "#7b8c89",
    fontSize: 12,
    marginHorizontal: 10,
  },
  socialRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 18,
  },
  socialButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#F1F4F3",
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    color: "#b42318",
    fontSize: 12,
    marginBottom: 8,
    textAlign: "center",
  },
  footerToggle: {
    alignItems: "center",
    marginTop: 8,
  },
  footerText: {
    color: "#5b6f6c",
    fontSize: 13,
  },
  footerLink: {
    color: "#247881",
    fontWeight: "700",
  },
});
