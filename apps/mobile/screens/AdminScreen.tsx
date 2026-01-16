import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  adminListListings,
  adminListUsers,
  adminUpdateListing,
  adminUpdateUser,
  type AdminListing,
  type AdminUser,
} from "../api";
import { useAuth } from "../auth";
import type { RootStackParamList } from "../types";
import { cardShadow, colors, radius, spacing } from "../styles/theme";
import { Ionicons } from "@expo/vector-icons";

type Props = NativeStackScreenProps<RootStackParamList, "Admin">;

export function AdminScreen({ navigation }: Props) {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<"users" | "listings">("users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [listings, setListings] = useState<AdminListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await adminListUsers(token);
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load users");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadListings = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await adminListListings(token);
      setListings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load listings");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const handleTab = (tab: "users" | "listings") => {
    setActiveTab(tab);
    if (tab === "users") {
      void loadUsers();
    } else {
      void loadListings();
    }
  };

  const updateUserStatus = (user: AdminUser) => {
    if (!token) return;
    const nextStatus = user.status === "active" ? "suspended" : "active";
    Alert.alert("Update user", `Set status to ${nextStatus}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: async () => {
          try {
            const result = await adminUpdateUser(token, user.id, { status: nextStatus, reason: "Admin action" });
            setUsers((prev) => prev.map((item) => (item.id === user.id ? result.user : item)));
          } catch (err) {
            setError(err instanceof Error ? err.message : "User update failed");
          }
        },
      },
    ]);
  };

  const toggleAdminRole = (user: AdminUser) => {
    if (!token) return;
    const nextRole = user.role === "admin" ? "host" : "admin";
    Alert.alert("Update role", `Set role to ${nextRole}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: async () => {
          try {
            const result = await adminUpdateUser(token, user.id, { role: nextRole, reason: "Admin action" });
            setUsers((prev) => prev.map((item) => (item.id === user.id ? result.user : item)));
          } catch (err) {
            setError(err instanceof Error ? err.message : "Role update failed");
          }
        },
      },
    ]);
  };

  const updateListing = (listing: AdminListing, status: AdminListing["status"]) => {
    if (!token) return;
    Alert.alert("Update listing", `Set status to ${status}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: async () => {
          try {
            const result = await adminUpdateListing(token, listing.id, {
              status,
              moderationReason: status === "rejected" ? "Not compliant" : undefined,
              reason: "Admin action",
            });
            setListings((prev) =>
              prev.map((item) => (item.id === listing.id ? { ...item, ...result.listing } : item))
            );
          } catch (err) {
            setError(err instanceof Error ? err.message : "Listing update failed");
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Admin</Text>
        <View style={styles.backButton} />
      </View>
      <View style={styles.tabs}>
        <Pressable
          style={[styles.tabButton, activeTab === "users" && styles.tabButtonActive]}
          onPress={() => handleTab("users")}
        >
          <Text style={[styles.tabText, activeTab === "users" && styles.tabTextActive]}>Users</Text>
        </Pressable>
        <Pressable
          style={[styles.tabButton, activeTab === "listings" && styles.tabButtonActive]}
          onPress={() => handleTab("listings")}
        >
          <Text style={[styles.tabText, activeTab === "listings" && styles.tabTextActive]}>Listings</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <Text style={styles.muted}>Loading…</Text> : null}
        {activeTab === "users" ? (
          users.length === 0 && !loading ? (
            <Text style={styles.muted}>No users found.</Text>
          ) : (
            users.map((user) => (
              <View key={user.id} style={styles.card}>
                <Text style={styles.cardTitle}>{user.email}</Text>
                <Text style={styles.cardMeta}>
                  Role: {user.role} · Status: {user.status}
                </Text>
                <View style={styles.actionRow}>
                  <Pressable style={styles.actionButton} onPress={() => updateUserStatus(user)}>
                    <Text style={styles.actionText}>
                      {user.status === "active" ? "Suspend" : "Activate"}
                    </Text>
                  </Pressable>
                  <Pressable style={styles.actionButton} onPress={() => toggleAdminRole(user)}>
                    <Text style={styles.actionText}>
                      {user.role === "admin" ? "Remove admin" : "Make admin"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))
          )
        ) : listings.length === 0 && !loading ? (
          <Text style={styles.muted}>No listings found.</Text>
        ) : (
          listings.map((listing) => (
            <View key={listing.id} style={styles.card}>
              <Text style={styles.cardTitle}>{listing.title}</Text>
              <Text style={styles.cardMeta}>{listing.address}</Text>
              <Text style={styles.cardMeta}>Status: {listing.status}</Text>
              <View style={styles.actionRow}>
                <Pressable style={styles.actionButton} onPress={() => updateListing(listing, "approved")}>
                  <Text style={styles.actionText}>Approve</Text>
                </Pressable>
                <Pressable style={styles.actionButton} onPress={() => updateListing(listing, "rejected")}>
                  <Text style={styles.actionText}>Reject</Text>
                </Pressable>
                <Pressable style={styles.actionButton} onPress={() => updateListing(listing, "disabled")}>
                  <Text style={styles.actionText}>Disable</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.appBg,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.screenX,
    paddingTop: 8,
  },
  backButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
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
    fontWeight: "700",
  },
  topTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  tabs: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: spacing.screenX,
    paddingTop: 12,
  },
  tabButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: colors.cardBg,
  },
  tabButtonActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  tabText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  tabTextActive: {
    color: colors.cardBg,
  },
  content: {
    padding: spacing.screenX,
    gap: 12,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.card,
    ...cardShadow,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  cardMeta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 6,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },
  actionButton: {
    backgroundColor: colors.appBg,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
  },
  error: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderRadius: 12,
    borderWidth: 1,
    color: colors.danger,
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlign: "center",
  },
  muted: {
    color: colors.textSoft,
    fontSize: 12,
    textAlign: "center",
  },
});
