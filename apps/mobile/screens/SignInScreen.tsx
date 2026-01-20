import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import { MaterialIcons } from "@expo/vector-icons";
import { useAuth } from "../auth";
import { requestEmailVerification } from "../api";
import { cardShadow, colors, radius, spacing, textStyles } from "../styles/theme";
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
            <Text style={styles.kicker}>Welcome back</Text>
            <Text style={styles.title}>Sign in</Text>
            <Text style={styles.subtitle}>Access your bookings and host dashboard.</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="you@example.com"
                placeholderTextColor="#94a3b8"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="••••••••"
                placeholderTextColor="#94a3b8"
              />
            </View>
            <Pressable
              style={styles.forgotRow}
              onPress={() => navigation.navigate("ResetPassword")}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>
            <Pressable
              style={styles.legalRow}
              onPress={() => setAcceptLegalChecked((value) => !value)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: acceptLegalChecked }}
            >
              <MaterialIcons
                name={acceptLegalChecked ? "check-box" : "check-box-outline-blank"}
                size={20}
                color={acceptLegalChecked ? "#00d4aa" : "#9ca3af"}
              />
              <Text style={styles.legalText}>
                I agree to the{" "}
                <Text style={styles.legalLink} onPress={() => navigation.navigate("Legal")}>
                  Terms & Privacy
                </Text>
                .
              </Text>
            </Pressable>
            <Pressable
              style={styles.primaryButton}
              onPress={handleLogin}
              disabled={submitting}
              testID="sign-in-button"
            >
              <Text style={styles.primaryButtonText}>{submitting ? "Signing in..." : "Sign in"}</Text>
            </Pressable>
            <Pressable
              style={[
                styles.secondaryButton,
                (!acceptLegalChecked || submitting) && styles.secondaryButtonDisabled,
              ]}
              onPress={handleRegister}
              disabled={submitting || !acceptLegalChecked}
            >
              <Text style={styles.secondaryButtonText}>Create account</Text>
            </Pressable>
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>
            <Pressable
              style={styles.oauthButton}
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
                  setError(
                    errorCode ? `${message} (${errorCode})` : message
                  );
                }
              }}
            >
              <Text style={styles.oauthButtonText}>Continue with Google</Text>
            </Pressable>
            <Text style={styles.legalNote}>
              By continuing, you agree to the{" "}
              <Text style={styles.legalLink} onPress={() => navigation.navigate("Legal")}>
                Terms & Privacy
              </Text>
              .
            </Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {notice ? <Text style={styles.notice}>{notice}</Text> : null}
            {previewUrl ? (
              <Pressable style={styles.linkButton} onPress={() => Linking.openURL(previewUrl)}>
                <Text style={styles.linkButtonText}>Open verification link</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={styles.linkButton}
              onPress={handleResend}
              disabled={submitting || resendCooldown > 0}
            >
              <Text style={styles.linkButtonText}>
                {resendCooldown > 0
                  ? `Resend available in ${resendCooldown}s`
                  : "Resend verification email"}
              </Text>
            </Pressable>
            <Pressable
              style={styles.ghostButton}
              onPress={() => navigation.replace("Search")}
            >
              <Ionicons name="arrow-back" size={24} color={colors.text} />
              <Text style={styles.ghostButtonText}>Search</Text>
            </Pressable>
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
    backgroundColor: colors.appBg,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.screenX,
    paddingBottom: 32,
    paddingTop: spacing.screenY,
  },
  header: {
    alignItems: "flex-start",
    marginBottom: spacing.gap,
  },
  kicker: textStyles.kicker,
  title: {
    ...textStyles.title,
    fontSize: 30,
    marginTop: 6,
  },
  subtitle: {
    ...textStyles.subtitle,
    marginTop: 6,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.card,
    ...cardShadow,
  },
  field: {
    marginBottom: 12,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  forgotRow: {
    alignItems: "flex-end",
    marginBottom: 12,
    marginTop: -4,
  },
  forgotText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    backgroundColor: "#f9fafb",
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.text,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 12,
    marginTop: 6,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
    paddingVertical: 12,
  },
  secondaryButtonDisabled: {
    opacity: 0.6,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  dividerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  legalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  legalText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  legalNote: {
    marginTop: 10,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  legalLink: {
    color: colors.accent,
    fontWeight: "600",
  },
  dividerLine: {
    backgroundColor: "#e5e7eb",
    flex: 1,
    height: 1,
  },
  dividerText: {
    color: "#9ca3af",
    fontSize: 12,
    fontWeight: "600",
  },
  oauthButton: {
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
    paddingVertical: 12,
  },
  oauthButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  error: {
    color: colors.danger,
    fontSize: 12,
    marginTop: 12,
    textAlign: "center",
  },
  notice: {
    color: colors.accent,
    fontSize: 12,
    marginTop: 10,
    textAlign: "center",
  },
  linkButton: {
    alignItems: "center",
    marginTop: 14,
  },
  linkButtonText: {
    color: "#00a889",
    fontSize: 12,
    fontWeight: "600",
  },
  ghostButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  ghostButtonText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
  },
  backCircle: {
    alignItems: "center",
    justifyContent: "center",
    height: 32,
    width: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBg,
  },
  backIcon: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 14,
    textAlign: "center",
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
