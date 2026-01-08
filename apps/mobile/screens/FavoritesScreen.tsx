import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../auth";
import { useFavorites } from "../favorites";
import type { RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Favorites">;

export function FavoritesScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { favorites } = useFavorites();

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.emptyState}>
          <Text style={styles.title}>Favourites</Text>
          <Text style={styles.subtitle}>Sign in to view your saved spaces.</Text>
          <Pressable style={styles.primaryButton} onPress={() => navigation.navigate("SignIn")}>
            <Text style={styles.primaryButtonText}>Sign in</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Favourites</Text>
        <View style={styles.backButton} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {favorites.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.subtitle}>No favourites yet.</Text>
            <Text style={styles.helper}>Tap the heart on a listing to save it.</Text>
          </View>
        ) : (
          favorites.map((item) => (
            <Pressable
              key={item.id}
              style={styles.row}
              onPress={() =>
                navigation.navigate("Listing", {
                  id: item.id,
                  from: new Date().toISOString(),
                  to: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
                })
              }
            >
              <View style={styles.icon} />
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowSubtitle}>{item.address}</Text>
              </View>
            </Pressable>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  backButton: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 44,
    paddingVertical: 6,
  },
  backText: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "700",
  },
  title: {
    color: "#0f172a",
    fontSize: 20,
    fontWeight: "800",
  },
  content: {
    padding: 20,
    gap: 12,
  },
  row: {
    backgroundColor: "#ffffff",
    borderColor: "#e5e7eb",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  icon: {
    backgroundColor: "#e6f9f5",
    borderRadius: 18,
    height: 36,
    width: 36,
  },
  rowCopy: {
    flex: 1,
  },
  rowTitle: {
    color: "#1a1f2e",
    fontSize: 16,
    fontWeight: "600",
  },
  rowSubtitle: {
    color: "#6b7280",
    fontSize: 13,
    marginTop: 2,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
  },
  subtitle: {
    color: "#6b7280",
    fontSize: 14,
    textAlign: "center",
  },
  helper: {
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 6,
  },
  primaryButton: {
    backgroundColor: "#00d4aa",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 14,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
});
