import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { deleteAccount, requestEmailVerification } from "../api";
import { useAuth } from "../auth";
import type { RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Profile">;

export function ProfileScreen({ navigation }: Props) {
  const { user, token, logout } = useAuth();
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resendVerification = async () => {
    if (!user?.email) return;
    setSending(true);
    setMessage(null);
    setError(null);
    try {
      await requestEmailVerification(user.email);
      setMessage("Verification email sent. Check your inbox.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send verification email");
    } finally {
      setSending(false);
    }
  };

  const confirmDelete = () => {
    if (!token) {
      setError("Authentication required");
      return;
    }
    Alert.alert(
      "Delete account",
      "This will permanently remove your account, listings, and bookings.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            setError(null);
            try {
              await deleteAccount(token);
              await logout();
              navigation.navigate("Search");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not delete account");
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.emptyState}>
          <Text style={styles.title}>Account settings</Text>
          <Text style={styles.subtitle}>Sign in to manage your profile and security.</Text>
          <Pressable style={styles.primaryButton} onPress={() => navigation.navigate("SignIn")}>
            <Text style={styles.primaryButtonText}>Sign in</Text>
          </Pressable>
          <Pressable style={styles.ghostButton} onPress={() => navigation.navigate("Search")}>
            <Text style={styles.ghostButtonText}>Back to search</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Profile</Text>
          <Text style={styles.title}>Account settings</Text>
          <Text style={styles.subtitle}>Manage your account info, verification, and security.</Text>
        </View>

        {message ? <Text style={styles.notice}>{message}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Quick access</Text>
          <View style={styles.tileGrid}>
            <Pressable style={styles.tile} onPress={() => navigation.navigate("History")}>
              <View style={[styles.tileIcon, styles.tileIconPrimary]}>
                <Text style={styles.tileIconText}>⏱</Text>
              </View>
              <Text style={styles.tileTitle}>History</Text>
              <Text style={styles.tileSubtitle}>Past bookings</Text>
            </Pressable>
            <Pressable style={styles.tile} onPress={() => navigation.navigate("Settings")}>
              <View style={[styles.tileIcon, styles.tileIconNeutral]}>
                <Text style={styles.tileIconText}>⚙</Text>
              </View>
              <Text style={styles.tileTitle}>Settings</Text>
              <Text style={styles.tileSubtitle}>Preferences</Text>
            </Pressable>
            <Pressable style={styles.tile} onPress={() => navigation.navigate("Listings")}>
              <View style={[styles.tileIcon, styles.tileIconAccent]}>
                <Text style={styles.tileIconText}>🏠</Text>
              </View>
              <Text style={styles.tileTitle}>Listings</Text>
              <Text style={styles.tileSubtitle}>Manage spaces</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardKicker}>Account</Text>
              <Text style={styles.cardTitle}>User details</Text>
            </View>
            <View
              style={[
                styles.badge,
                user.emailVerified ? styles.badgeSuccess : styles.badgeWarning,
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  user.emailVerified ? styles.badgeTextSuccess : styles.badgeTextWarning,
                ]}
              >
                {user.emailVerified ? "Email verified" : "Verification needed"}
              </Text>
            </View>
          </View>
          <View style={styles.detailBlock}>
            <Text style={styles.detailLabel}>Email</Text>
            <Text style={styles.detailValue}>{user.email}</Text>
          </View>
          <View style={styles.detailBlock}>
            <Text style={styles.detailLabel}>Role</Text>
            <Text style={styles.detailValue}>{user.role ?? "driver"}</Text>
          </View>
          {!user.emailVerified ? (
            <Pressable style={styles.successButton} onPress={resendVerification} disabled={sending}>
              <Text style={styles.successButtonText}>{sending ? "Sending..." : "Resend verification"}</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.dangerKicker}>Danger zone</Text>
          <Text style={styles.cardTitle}>Delete account</Text>
          <Text style={styles.dangerText}>
            This will permanently remove your account, listings, and bookings. This action cannot be undone.
          </Text>
          <Pressable style={styles.dangerButton} onPress={confirmDelete} disabled={deleting}>
            <Text style={styles.dangerButtonText}>{deleting ? "Deleting..." : "Delete account"}</Text>
          </Pressable>
        </View>

        <Pressable style={styles.secondaryButton} onPress={() => logout()}>
          <Text style={styles.secondaryButtonText}>Sign out</Text>
        </Pressable>
      </ScrollView>
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
    marginBottom: 16,
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
  },
  notice: {
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
    borderRadius: 12,
    borderWidth: 1,
    color: "#1d4ed8",
    fontSize: 12,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  error: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderRadius: 12,
    borderWidth: 1,
    color: "#b42318",
    fontSize: 12,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 14,
    padding: 16,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  sectionTitle: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  tileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  tile: {
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
    borderRadius: 16,
    borderWidth: 1,
    flexBasis: "48%",
    padding: 14,
  },
  tileIcon: {
    alignItems: "center",
    borderRadius: 12,
    height: 36,
    justifyContent: "center",
    marginBottom: 10,
    width: 36,
  },
  tileIconPrimary: {
    backgroundColor: "#e0edff",
  },
  tileIconNeutral: {
    backgroundColor: "#e2e8f0",
  },
  tileIconAccent: {
    backgroundColor: "#dcfce7",
  },
  tileIconText: {
    fontSize: 16,
  },
  tileTitle: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "700",
  },
  tileSubtitle: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 4,
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cardKicker: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  cardTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 4,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeSuccess: {
    backgroundColor: "#ecfdf3",
  },
  badgeWarning: {
    backgroundColor: "#fffbeb",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  badgeTextSuccess: {
    color: "#027a48",
  },
  badgeTextWarning: {
    color: "#b45309",
  },
  detailBlock: {
    marginTop: 12,
  },
  detailLabel: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  detailValue: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 4,
  },
  successButton: {
    alignItems: "center",
    backgroundColor: "#16a34a",
    borderRadius: 12,
    marginTop: 14,
    paddingVertical: 10,
  },
  successButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  dangerKicker: {
    color: "#b42318",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  dangerText: {
    color: "#475569",
    fontSize: 12,
    marginTop: 8,
  },
  dangerButton: {
    alignItems: "center",
    borderColor: "#fecaca",
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
    paddingVertical: 10,
  },
  dangerButtonText: {
    color: "#b42318",
    fontSize: 12,
    fontWeight: "700",
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#e2e8f0",
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "700",
  },
  emptyState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#2563eb",
    borderRadius: 12,
    marginTop: 16,
    paddingVertical: 12,
    width: "100%",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  ghostButton: {
    alignItems: "center",
    marginTop: 12,
  },
  ghostButtonText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
  },
});
