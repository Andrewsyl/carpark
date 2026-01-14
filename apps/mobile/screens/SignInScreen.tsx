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
import type { RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "SignIn">;

export function SignInScreen({ navigation }: Props) {
  const { login, register, loginWithOAuth, acceptLegal, logout } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [acceptLegalChecked, setAcceptLegalChecked] = useState(false);
  const [oauthAcceptLegal, setOauthAcceptLegal] = useState(false);
  const [showOauthLegalPrompt, setShowOauthLegalPrompt] = useState(false);
  const [oauthLegalLoading, setOauthLegalLoading] = useState(false);
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

  const handleAcceptOAuthLegal = async () => {
    if (!oauthAcceptLegal) {
      setError("Please accept the Terms & Privacy to continue.");
      return;
    }
    setOauthLegalLoading(true);
    setError(null);
    try {
      await acceptLegal({ termsVersion: legalVersion, privacyVersion: legalVersion });
      setShowOauthLegalPrompt(false);
      setAuthSuccess("Signed in with Google");
      successTimerRef.current = setTimeout(() => {
        navigation.replace("Profile");
      }, 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save acceptance");
    } finally {
      setOauthLegalLoading(false);
    }
  };

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
      navigation.replace("Profile");
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
      navigation.replace("Profile");
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
            <Pressable style={styles.secondaryButton} onPress={handleRegister} disabled={submitting}>
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
                  const oauthUser = await loginWithOAuth("google", idToken);
                  if (!oauthUser.termsVersion || !oauthUser.privacyVersion) {
                    setShowOauthLegalPrompt(true);
                    setOauthAcceptLegal(false);
                    return;
                  }
                  setAuthSuccess("Signed in with Google");
                  successTimerRef.current = setTimeout(() => {
                    navigation.replace("Profile");
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
            {showOauthLegalPrompt ? (
              <View style={styles.oauthOverlay}>
                <View style={styles.oauthLegalCard}>
                  <Text style={styles.oauthLegalTitle}>One last step</Text>
                  <Text style={styles.oauthLegalBody}>
                    Please accept the Terms & Privacy to finish signing in.
                  </Text>
                  <Pressable
                    style={styles.legalRow}
                    onPress={() => setOauthAcceptLegal((value) => !value)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: oauthAcceptLegal }}
                  >
                    <MaterialIcons
                      name={oauthAcceptLegal ? "check-box" : "check-box-outline-blank"}
                      size={20}
                      color={oauthAcceptLegal ? "#00d4aa" : "#9ca3af"}
                    />
                    <Text style={styles.legalText}>
                      I agree to the{" "}
                      <Text style={styles.legalLink} onPress={() => navigation.navigate("Legal")}>
                        Terms & Privacy
                      </Text>
                      .
                    </Text>
                  </Pressable>
                  <View style={styles.oauthLegalActions}>
                    <Pressable
                      style={styles.secondaryButton}
                      onPress={async () => {
                        setShowOauthLegalPrompt(false);
                        setOauthAcceptLegal(false);
                        await logout();
                      }}
                      disabled={oauthLegalLoading}
                    >
                      <Text style={styles.secondaryButtonText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.primaryButton, !oauthAcceptLegal && styles.primaryButtonDisabled]}
                      onPress={handleAcceptOAuthLegal}
                      disabled={!oauthAcceptLegal || oauthLegalLoading}
                    >
                      <Text style={styles.primaryButtonText}>
                        {oauthLegalLoading ? "Saving..." : "Continue"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ) : null}
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
              <Text style={styles.ghostButtonText}>Back to search</Text>
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
    backgroundColor: "#f5f7fb",
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 24,
  },
  header: {
    alignItems: "flex-start",
    marginBottom: 18,
  },
  kicker: {
    color: "#00d4aa",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    color: "#0f172a",
    fontSize: 30,
    fontWeight: "800",
    marginTop: 6,
  },
  subtitle: {
    color: "#6b7280",
    fontSize: 14,
    marginTop: 6,
  },
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#e5e7eb",
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 2,
  },
  field: {
    marginBottom: 12,
  },
  label: {
    color: "#475467",
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
    color: "#00d4aa",
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    backgroundColor: "#f9fafb",
    borderColor: "#e5e7eb",
    borderRadius: 12,
    borderWidth: 1,
    color: "#0f172a",
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#00d4aa",
    borderRadius: 12,
    marginTop: 6,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#d0d5dd",
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "700",
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
    color: "#475569",
    fontSize: 13,
    lineHeight: 18,
  },
  legalNote: {
    marginTop: 10,
    color: "#64748b",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  oauthLegalCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 18,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    width: "100%",
    maxWidth: 420,
  },
  oauthOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    padding: 18,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 20,
  },
  oauthLegalTitle: {
    backgroundColor: "#f8fafc",
    borderColor: "#e5e7eb",
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 14,
    padding: 16,
  },
  oauthLegalTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
  },
  oauthLegalBody: {
    color: "#6b7280",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  oauthLegalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
  },
  legalLink: {
    color: "#00d4aa",
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
    backgroundColor: "#ffffff",
    borderColor: "#e5e7eb",
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
    paddingVertical: 12,
  },
  oauthButtonText: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
  },
  error: {
    color: "#b42318",
    fontSize: 12,
    marginTop: 12,
    textAlign: "center",
  },
  notice: {
    color: "#00a889",
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
    marginTop: 14,
  },
  ghostButtonText: {
    color: "#64748b",
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
    fontWeight: "700",
    marginBottom: 6,
  },
  successMessage: {
    color: "#475569",
    fontSize: 14,
    lineHeight: 20,
  },
});
