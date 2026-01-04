import { useState } from "react";
import {
  KeyboardAvoidingView,
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
import { useAuth } from "../auth";
import { requestEmailVerification } from "../api";
import type { RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "SignIn">;

export function SignInScreen({ navigation }: Props) {
  const { login, register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
      await register(trimmed, password);
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
      await requestEmailVerification(trimmed);
      setNotice("Verification email sent (if the account exists).");
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
            <Pressable style={styles.primaryButton} onPress={handleLogin} disabled={submitting}>
              <Text style={styles.primaryButtonText}>{submitting ? "Signing in..." : "Sign in"}</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={handleRegister} disabled={submitting}>
              <Text style={styles.secondaryButtonText}>Create account</Text>
            </Pressable>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {notice ? <Text style={styles.notice}>{notice}</Text> : null}
            <Pressable style={styles.linkButton} onPress={handleResend} disabled={submitting}>
              <Text style={styles.linkButtonText}>Resend verification email</Text>
            </Pressable>
            <Pressable
              style={styles.ghostButton}
              onPress={() => navigation.replace("Search")}
            >
              <Text style={styles.ghostButtonText}>Back to search</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 18,
  },
  kicker: {
    color: "#2563eb",
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
    color: "#64748b",
    fontSize: 13,
    marginTop: 6,
    textAlign: "center",
  },
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  field: {
    marginBottom: 12,
  },
  label: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    borderColor: "#e2e8f0",
    borderRadius: 12,
    borderWidth: 1,
    color: "#0f172a",
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#2563eb",
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
    borderColor: "#e2e8f0",
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
  error: {
    color: "#b42318",
    fontSize: 12,
    marginTop: 12,
    textAlign: "center",
  },
  notice: {
    color: "#1d4ed8",
    fontSize: 12,
    marginTop: 10,
    textAlign: "center",
  },
  linkButton: {
    alignItems: "center",
    marginTop: 14,
  },
  linkButtonText: {
    color: "#2563eb",
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
});
