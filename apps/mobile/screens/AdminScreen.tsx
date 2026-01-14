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
          <Text style={styles.backLabel}>Back</Text>
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
    backgroundColor: "#f5f7fb",
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  backButton: {
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  backLabel: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "700",
  },
  topTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "700",
  },
  tabs: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  tabButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  tabButtonActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  tabText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "700",
  },
  tabTextActive: {
    color: "#ffffff",
  },
  content: {
    padding: 18,
    gap: 12,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 16,
  },
  cardTitle: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
  },
  cardMeta: {
    color: "#6b7280",
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
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionText: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "700",
  },
  error: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderRadius: 12,
    borderWidth: 1,
    color: "#b42318",
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlign: "center",
  },
  muted: {
    color: "#94a3b8",
    fontSize: 12,
    textAlign: "center",
  },
});
