import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { listHostListings } from "../api";
import { useAuth } from "../auth";
import type { ListingSummary, RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Listings">;

export function ListingsScreen({ navigation }: Props) {
  const { token, user } = useAuth();
  const [listings, setListings] = useState<ListingSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadListings = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listHostListings(token);
      setListings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load listings");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void loadListings();
    }, [loadListings])
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable
          style={styles.backButton}
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate("Search");
            }
          }}
        >
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
        <Text style={styles.topTitle}>Your listings</Text>
        <Pressable
          style={styles.actionButton}
          onPress={() => navigation.navigate("CreateListingFlow")}
        >
          <Text style={styles.actionText}>Add</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {!user ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign in to host</Text>
            <Text style={styles.cardBody}>
              Log in to manage listings and start earning from your space.
            </Text>
            <Pressable style={styles.primaryButton} onPress={() => navigation.navigate("SignIn")}>
              <Text style={styles.primaryButtonText}>Sign in</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {loading && listings.length === 0 ? (
              <Text style={styles.muted}>Loading listings…</Text>
            ) : null}
            {listings.length === 0 && !loading ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>No listings yet</Text>
                <Text style={styles.cardBody}>
                  Create a listing to start earning from your parking space.
                </Text>
                <Pressable
                  style={styles.primaryButton}
                  onPress={() => navigation.navigate("CreateListingFlow")}
                >
                  <Text style={styles.primaryButtonText}>List a space</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.list}>
                {listings.map((listing) => (
                  <Pressable
                    key={listing.id}
                    style={styles.listCard}
                  onPress={() =>
                    navigation.navigate("CreateListingFlow", { listingId: listing.id })
                  }
                >
                    {listing.image_urls?.[0] ? (
                      <Image source={{ uri: listing.image_urls[0] }} style={styles.listImage} />
                    ) : (
                      <View style={styles.listPlaceholder}>
                        <Text style={styles.listPlaceholderText}>No image</Text>
                      </View>
                    )}
                    <View style={styles.listBody}>
                      <Text style={styles.listTitle} numberOfLines={1}>
                        {listing.title}
                      </Text>
                      <Text style={styles.listMeta} numberOfLines={1}>
                        {listing.address}
                      </Text>
                      <Text style={styles.listMeta}>€{listing.price_per_day} / day</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#f8fafc",
    flex: 1,
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
  actionButton: {
    alignItems: "center",
    borderRadius: 10,
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
  content: {
    padding: 18,
  },
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  cardTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "700",
  },
  cardBody: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 6,
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
  muted: {
    color: "#64748b",
    fontSize: 12,
    marginBottom: 10,
  },
  list: {
    gap: 12,
  },
  listCard: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 12,
  },
  listImage: {
    borderRadius: 12,
    height: 72,
    width: 96,
  },
  listPlaceholder: {
    alignItems: "center",
    backgroundColor: "#e5e7eb",
    borderRadius: 12,
    height: 72,
    justifyContent: "center",
    width: 96,
  },
  listPlaceholderText: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "600",
  },
  listBody: {
    flex: 1,
    gap: 4,
  },
  listTitle: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "700",
  },
  listMeta: {
    color: "#64748b",
    fontSize: 12,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#2fa84f",
    borderRadius: 12,
    marginTop: 14,
    paddingVertical: 10,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  actionText: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "700",
  },
});
