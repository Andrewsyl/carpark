import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MaterialIcons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { deleteAccount, requestEmailVerification } from "../api";
import { useAuth } from "../auth";
import type { RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Profile">;

export function ProfileScreen({ navigation }: Props) {
  const { user, token, logout } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const resendVerification = async () => {
    if (!user?.email) return;
    setSending(true);
    setMessage(null);
    setError(null);
    try {
      const url = await requestEmailVerification(user.email);
      setPreviewUrl(url);
      setMessage(
        url
          ? "Verification link ready. Open it to confirm your email."
          : "Verification email sent. Check your inbox."
      );
      setResendCooldown(30);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send verification email");
    } finally {
      setSending(false);
    }
  };

  const syncNotificationStatus = async () => {
    const settings = await Notifications.getPermissionsAsync();
    setNotificationsEnabled(settings.granted);
  };

  const handleToggleNotifications = async () => {
    if (notificationsEnabled) {
      Alert.alert(
        "Turn off notifications",
        "Notifications are managed in your device settings.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Open settings",
            onPress: () => {
              void Linking.openSettings();
            },
          },
        ]
      );
      return;
    }
    const result = await Notifications.requestPermissionsAsync();
    if (!result.granted) {
      Alert.alert(
        "Enable notifications",
        "Notifications are off. Open system settings to enable them.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Open settings",
            onPress: () => {
              void Linking.openSettings();
            },
          },
        ]
      );
      return;
    }
    await syncNotificationStatus();
  };

  useEffect(() => {
    void syncNotificationStatus();
  }, []);

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

  const showPlaceholder = (title: string) => {
    Alert.alert(title, "This section is coming soon.");
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
        {previewUrl ? (
          <Pressable style={styles.linkButton} onPress={() => Linking.openURL(previewUrl)}>
            <Text style={styles.linkButtonText}>Open verification link</Text>
          </Pressable>
        ) : null}

        <View style={styles.section}>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => navigation.navigate("History")}
          >
            <MaterialIcons name="history" size={24} color="#111827" />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>History</Text>
              <Text style={styles.rowSubtitle}>Past bookings</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => navigation.navigate("Favorites")}
          >
            <MaterialIcons name="favorite-border" size={24} color="#111827" />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Favourites</Text>
              <Text style={styles.rowSubtitle}>Saved spaces</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => navigation.navigate("Settings")}
          >
            <MaterialIcons name="settings" size={24} color="#111827" />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Settings</Text>
              <Text style={styles.rowSubtitle}>Preferences</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.section}>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => showPlaceholder("Personal information")}
          >
            <MaterialIcons name="person-outline" size={24} color="#111827" />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Personal information</Text>
              <Text style={styles.rowSubtitle}>{user.email}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => navigation.navigate("Payments")}
          >
            <MaterialIcons name="credit-card" size={24} color="#111827" />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Payment methods</Text>
              <Text style={styles.rowSubtitle}>Add cards or bank accounts</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={handleToggleNotifications}
          >
            <MaterialIcons name="notifications-none" size={24} color="#111827" />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Notifications</Text>
              <Text style={styles.rowSubtitle}>Trips, reminders, updates</Text>
            </View>
            <View
              style={[
                styles.toggleTrack,
                notificationsEnabled && styles.toggleTrackActive,
              ]}
            >
              <View
                style={[
                  styles.toggleKnob,
                  notificationsEnabled && styles.toggleKnobActive,
                ]}
              />
            </View>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => showPlaceholder("Login & security")}
          >
            <MaterialIcons name="lock-outline" size={24} color="#111827" />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Login & security</Text>
              <Text style={styles.rowSubtitle}>Password, 2FA, devices</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => showPlaceholder("Promo codes")}
          >
            <MaterialIcons name="local-offer" size={24} color="#111827" />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Promo codes</Text>
              <Text style={styles.rowSubtitle}>Apply discounts</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
          </Pressable>
          <View style={styles.row}>
            <MaterialIcons
              name={user.emailVerified ? "verified" : "mark-email-unread"}
              size={24}
              color="#111827"
            />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>
                {user.emailVerified ? "Email verified" : "Verify your email"}
              </Text>
              <Text style={styles.rowSubtitle}>
                {user.emailVerified ? "Your email is confirmed." : "Finish verification."}
              </Text>
            </View>
            {!user.emailVerified ? (
              <Pressable
                style={styles.inlineButton}
                onPress={resendVerification}
                disabled={sending || resendCooldown > 0}
              >
                <Text style={styles.inlineButtonText}>
                  {sending
                    ? "Sending..."
                    : resendCooldown > 0
                      ? `Retry in ${resendCooldown}s`
                      : "Resend"}
                </Text>
              </Pressable>
            ) : (
              <Text style={styles.inlineStatus}>Verified</Text>
            )}
          </View>
        </View>

        <Text style={styles.sectionHeader}>Hosting</Text>
        <View style={styles.section}>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => navigation.navigate("CreateListingFlow")}
          >
            <MaterialIcons name="add-business" size={24} color="#111827" />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>List your space</Text>
              <Text style={styles.rowSubtitle}>Earn from your parking spot</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => navigation.navigate("Listings")}
          >
            <MaterialIcons name="home-work" size={24} color="#111827" />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Manage spaces</Text>
              <Text style={styles.rowSubtitle}>Edit listings and availability</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => showPlaceholder("Space owner guide")}
          >
            <MaterialIcons name="menu-book" size={24} color="#111827" />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>View our space owner guide</Text>
              <Text style={styles.rowSubtitle}>Best practices and tips</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
          </Pressable>
        </View>

        <Text style={styles.sectionHeader}>Support</Text>
        <View style={styles.section}>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => showPlaceholder("Help centre")}
          >
            <MaterialIcons name="help-outline" size={24} color="#111827" />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Help centre</Text>
              <Text style={styles.rowSubtitle}>FAQs and guides</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => navigation.navigate("Support")}
          >
            <MaterialIcons name="support-agent" size={24} color="#111827" />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Contact support</Text>
              <Text style={styles.rowSubtitle}>Send a message to our team</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => navigation.navigate("Legal")}
          >
            <MaterialIcons name="info-outline" size={24} color="#111827" />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Terms & privacy</Text>
              <Text style={styles.rowSubtitle}>Legal and policies</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
          </Pressable>
        </View>

        <Text style={styles.sectionHeader}>Account</Text>
        <View style={styles.section}>
          {user?.role === "admin" ? (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => navigation.navigate("Admin")}
            >
              <MaterialIcons name="admin-panel-settings" size={24} color="#111827" />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Admin panel</Text>
                <Text style={styles.rowSubtitle}>Moderate users and listings</Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
            </Pressable>
          ) : null}
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={confirmDelete}
          >
            <MaterialIcons name="delete-outline" size={24} color="#b42318" />
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, styles.rowTitleDanger]}>Delete account</Text>
              <Text style={styles.rowSubtitle}>
                Remove your data and listings permanently.
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#fca5a5" />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => logout()}
          >
            <MaterialIcons name="logout" size={24} color="#111827" />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Sign out</Text>
              <Text style={styles.rowSubtitle}>Log out of this device</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
          </Pressable>
        </View>
      </ScrollView>
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
    marginBottom: 16,
  },
  kicker: {
    color: "#00d4aa",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    color: "#0f172a",
    fontSize: 34,
    fontWeight: "700",
    marginTop: 6,
  },
  subtitle: {
    color: "#6b7280",
    fontSize: 16,
    marginTop: 6,
  },
  notice: {
    backgroundColor: "#ecfdf7",
    borderColor: "#a7f3d0",
    borderRadius: 12,
    borderWidth: 1,
    color: "#047857",
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
  section: {
    backgroundColor: "#ffffff",
    borderColor: "#e5e7eb",
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 18,
    overflow: "hidden",
  },
  sectionLabel: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 24,
    textTransform: "uppercase",
  },
  sectionHeader: {
    color: "#0f172a",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 10,
    marginTop: 18,
  },
  row: {
    alignItems: "center",
    borderBottomColor: "#e5e7eb",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  rowPressed: {
    backgroundColor: "#f8fafc",
  },
  toggleTrack: {
    backgroundColor: "#e2e8f0",
    borderRadius: 999,
    height: 26,
    padding: 3,
    width: 48,
  },
  toggleTrackActive: {
    backgroundColor: "#00d4aa",
  },
  toggleKnob: {
    backgroundColor: "#ffffff",
    borderRadius: 999,
    height: 20,
    width: 20,
  },
  toggleKnobActive: {
    marginLeft: 22,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "600",
  },
  rowTitleDanger: {
    color: "#b42318",
  },
  rowSubtitle: {
    color: "#6b7280",
    fontSize: 14,
    marginTop: 2,
  },
  inlineButton: {
    borderColor: "#99f6e4",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  inlineButtonText: {
    color: "#0f766e",
    fontSize: 12,
    fontWeight: "700",
  },
  linkButton: {
    alignItems: "center",
    marginBottom: 12,
  },
  linkButtonText: {
    color: "#0f766e",
    fontSize: 12,
    fontWeight: "700",
  },
  inlineStatus: {
    color: "#059669",
    fontSize: 12,
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
    backgroundColor: "#00d4aa",
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
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "600",
  },
});
