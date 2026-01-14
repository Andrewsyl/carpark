import { useState } from "react";
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
import { requestPasswordReset, resetPassword } from "../api";
import type { RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "ResetPassword">;

export function ResetPasswordScreen({ navigation }: Props) {
  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const extractToken = (url: string) => {
    const match = url.match(/token=([^&]+)/);
    return match?.[1] ?? "";
  };

  const handleRequest = async () => {
    const trimmed = email.trim();
    if (!trimmed.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const result = await requestPasswordReset(trimmed);
      setPreviewUrl(result.previewUrl ?? null);
      setNotice(
        result.previewUrl
          ? "Reset link ready. Open it or paste the token below."
          : "If an account exists, we sent a reset link."
      );
      setStep("reset");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset request failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async () => {
    if (token.trim().length < 10) {
      setError("Paste the reset token from your email.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await resetPassword(token.trim(), password);
      setNotice("Password updated. You can sign in now.");
      navigation.replace("SignIn");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
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
            <Text style={styles.kicker}>Account</Text>
            <Text style={styles.title}>Reset password</Text>
            <Text style={styles.subtitle}>
              We will send a secure link to update your password.
            </Text>
          </View>

          <View style={styles.card}>
            {step === "request" ? (
              <>
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
                <Pressable style={styles.primaryButton} onPress={handleRequest} disabled={submitting}>
                  <Text style={styles.primaryButtonText}>
                    {submitting ? "Sending..." : "Send reset link"}
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                {previewUrl ? (
                  <View style={styles.previewRow}>
                    <Pressable
                      style={styles.linkButton}
                      onPress={() => Linking.openURL(previewUrl)}
                    >
                      <Text style={styles.linkButtonText}>Open reset link</Text>
                    </Pressable>
                    <Pressable
                      style={styles.secondaryButton}
                      onPress={() => setToken(extractToken(previewUrl))}
                    >
                      <Text style={styles.secondaryButtonText}>Use token</Text>
                    </Pressable>
                  </View>
                ) : null}
                <View style={styles.field}>
                  <Text style={styles.label}>Reset token</Text>
                  <TextInput
                    style={styles.input}
                    value={token}
                    onChangeText={setToken}
                    autoCapitalize="none"
                    placeholder="Paste the token from your email"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>New password</Text>
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    placeholder="••••••••"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Confirm password</Text>
                  <TextInput
                    style={styles.input}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    placeholder="••••••••"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
                <Pressable style={styles.primaryButton} onPress={handleReset} disabled={submitting}>
                  <Text style={styles.primaryButtonText}>
                    {submitting ? "Updating..." : "Update password"}
                  </Text>
                </Pressable>
              </>
            )}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          </View>

          <Pressable style={styles.ghostButton} onPress={() => navigation.goBack()}>
            <Text style={styles.ghostButtonText}>Back</Text>
          </Pressable>
        </ScrollView>
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
    fontSize: 28,
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
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 18,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 2,
  },
  field: {
    marginBottom: 14,
  },
  label: {
    color: "#475467",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#f9fafb",
    borderColor: "#e5e7eb",
    borderRadius: 12,
    borderWidth: 1,
    color: "#0f172a",
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  previewRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  linkButton: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: "#0f172a",
    paddingVertical: 12,
    alignItems: "center",
  },
  linkButtonText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  primaryButton: {
    backgroundColor: "#00d4aa",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#0f172a",
    fontWeight: "600",
  },
  ghostButton: {
    alignItems: "center",
    marginTop: 20,
  },
  ghostButtonText: {
    color: "#0f172a",
    fontWeight: "600",
  },
  error: {
    color: "#ef4444",
    fontSize: 13,
    marginTop: 12,
  },
  notice: {
    color: "#16a34a",
    fontSize: 13,
    marginTop: 12,
  },
});
