import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import { MaterialIcons } from "@expo/vector-icons";
import { useAuth } from "../auth";
import { requestEmailVerification } from "../api";
import type { RootStackParamList } from "../types";
import { Ionicons } from "@expo/vector-icons";

type Props = NativeStackScreenProps<RootStackParamList, "SignIn">;

export function SignInScreen({ navigation }: Props) {
  const { login, register, loginWithOAuth, logout } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [acceptLegalChecked, setAcceptLegalChecked] = useState(false);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID ?? "";
  const legalVersion = "2026-01-10";


  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: googleWebClientId || undefined,
    });
  }, [googleWebClientId]);

  const handleLogin = async () => {
    const trimmed = email.trim();
    if (!trimmed.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await login(trimmed, password);
      navigation.replace("Tabs", { screen: "Search" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async () => {
    const trimmed = email.trim();
    if (!acceptLegalChecked) {
      setError("Please accept the Terms & Privacy to create an account.");
      return;
    }
    if (!trimmed.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const url = await register(trimmed, password, {
        termsVersion: legalVersion,
        privacyVersion: legalVersion,
      });
      setPreviewUrl(url);
      setNotice(
        url
          ? "Account created. Verify your email to continue."
          : "Account created. Check your email to verify."
      );
      navigation.replace("Tabs", { screen: "Search" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setNotice("Enter your email to resend verification.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const url = await requestEmailVerification(trimmed);
      setPreviewUrl(url);
      setNotice(
        url
          ? "Verification link ready. Open it to confirm your email."
          : "Verification email sent (if the account exists)."
      );
      setResendCooldown(30);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send verification email");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="chevron-back" size={24} color="#4A9EFF" />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign In</Text>
            <Text style={styles.cardSubtitle}>Access your bookings and host dashboard.</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="you@example.com"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="••••••••"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <TouchableOpacity
              style={styles.forgotRow}
              onPress={() => navigation.navigate("ResetPassword")}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setAcceptLegalChecked((value) => !value)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: acceptLegalChecked }}
            >
              <MaterialIcons
                name={acceptLegalChecked ? "check-box" : "check-box-outline-blank"}
                size={20}
                color={acceptLegalChecked ? "#4A9EFF" : "#9CA3AF"}
              />
              <Text style={styles.checkboxText}>
                I agree to the{" "}
                <Text style={styles.link} onPress={() => navigation.navigate("Legal")}>
                  Terms & Privacy
                </Text>
                .
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.signInButton}
              onPress={handleLogin}
              disabled={submitting}
              testID="sign-in-button"
            >
              <Text style={styles.buttonText}>{submitting ? "Signing in..." : "Sign In"}</Text>
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.secondaryButton,
                (!acceptLegalChecked || submitting) && styles.secondaryButtonDisabled,
              ]}
              onPress={handleRegister}
              disabled={submitting || !acceptLegalChecked}
            >
              <Text style={styles.secondaryButtonText}>Create account</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or sign in with</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.socialButton}
              onPress={async () => {
                setError(null);
                setNotice(null);
                setAuthSuccess(null);
                try {
                  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
                  const userInfo = await GoogleSignin.signIn();
                  const tokens = await GoogleSignin.getTokens();
                  const idToken = userInfo.idToken ?? tokens.idToken;
                  if (!idToken) {
                    throw new Error("Missing Google idToken");
                  }
                  await loginWithOAuth("google", idToken);
                  setAuthSuccess("Signed in with Google");
                  successTimerRef.current = setTimeout(() => {
                    navigation.replace("Tabs", { screen: "Search" });
                  }, 900);
                } catch (err) {
                  const errorCode =
                    err && typeof err === "object" && "code" in err ? String(err.code) : "";
                  if (errorCode === statusCodes.SIGN_IN_CANCELLED) {
                    return;
                  }
                  const message = err instanceof Error ? err.message : "Google sign-in failed";
                  console.warn("Google sign-in failed", err);
                  setError(errorCode ? `${message} (${errorCode})` : message);
                }
              }}
            >
              <Ionicons name="logo-google" size={20} color="#DB4437" />
              <Text style={styles.socialText}>Google</Text>
            </TouchableOpacity>

            <Text style={styles.legalNote}>
              By continuing, you agree to the{" "}
              <Text style={styles.link} onPress={() => navigation.navigate("Legal")}>
                Terms & Privacy
              </Text>
              .
            </Text>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}
            {previewUrl ? (
              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => Linking.openURL(previewUrl)}
              >
                <Text style={styles.linkButtonText}>Open verification link</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={styles.linkButton}
              onPress={handleResend}
              disabled={submitting || resendCooldown > 0}
            >
              <Text style={styles.linkButtonText}>
                {resendCooldown > 0
                  ? `Resend available in ${resendCooldown}s`
                  : "Resend verification email"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {authSuccess ? (
          <View style={styles.successOverlay}>
            <View style={styles.successCard}>
              <Text style={styles.successTitle}>Success</Text>
              <Text style={styles.successMessage}>{authSuccess}</Text>
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  content: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  header: {
    padding: 20,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  backText: {
    fontSize: 16,
    color: "#4A9EFF",
  },
  card: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  cardTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    color: "#9CA3AF",
    marginBottom: 8,
    fontWeight: "500",
  },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingVertical: 12,
    fontSize: 16,
    color: "#1A1A1A",
  },
  forgotRow: {
    alignItems: "flex-end",
    marginBottom: 12,
    marginTop: -8,
  },
  forgotText: {
    color: "#4A9EFF",
    fontSize: 13,
    fontWeight: "600",
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
    marginBottom: 24,
  },
  checkboxText: {
    flex: 1,
    fontSize: 13,
    color: "#6B7280",
  },
  link: {
    color: "#4A9EFF",
    fontWeight: "500",
  },
  signInButton: {
    backgroundColor: "#4A9EFF",
    borderRadius: 28,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginBottom: 16,
    shadowColor: "#4A9EFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#E5E7EB",
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
  },
  secondaryButtonDisabled: {
    opacity: 0.6,
  },
  secondaryButtonText: {
    color: "#1A1A1A",
    fontSize: 14,
    fontWeight: "600",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    marginTop: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5E7EB",
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 13,
    color: "#9CA3AF",
  },
  socialButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingVertical: 14,
  },
  socialText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#4A4A4A",
  },
  legalNote: {
    marginTop: 12,
    color: "#6B7280",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  errorText: {
    color: "#b42318",
    fontSize: 13,
    marginTop: 12,
    textAlign: "center",
  },
  noticeText: {
    color: "#4A9EFF",
    fontSize: 12,
    marginTop: 8,
    textAlign: "center",
  },
  linkButton: {
    alignItems: "center",
    marginTop: 12,
  },
  linkButtonText: {
    color: "#4A9EFF",
    fontSize: 12,
    fontWeight: "600",
  },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.18)",
    justifyContent: "center",
    padding: 24,
  },
  successCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingVertical: 20,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 6,
    width: "100%",
    maxWidth: 320,
  },
  successTitle: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 6,
  },
  successMessage: {
    color: "#475569",
    fontSize: 14,
    lineHeight: 20,
  },
});
