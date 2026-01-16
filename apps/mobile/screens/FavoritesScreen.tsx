import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../auth";
import { useFavorites } from "../favorites";
import { cardShadow, colors, radius, spacing, textStyles } from "../styles/theme";
import type { RootStackParamList } from "../types";
import { Ionicons } from "@expo/vector-icons";

type Props = NativeStackScreenProps<RootStackParamList, "Favorites">;

export function FavoritesScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { favorites, loading, error } = useFavorites();

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
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Favourites</Text>
        <View style={styles.backButton} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <Text style={styles.muted}>Loading favourites…</Text> : null}
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
    backgroundColor: colors.appBg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.screenX,
    paddingTop: 8,
  },
  backButton: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 44,
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
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  content: {
    padding: spacing.screenX,
    gap: 12,
  },
  row: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
    ...cardShadow,
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
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  rowSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
  },
  helper: {
    color: colors.textSoft,
    fontSize: 12,
    marginTop: 6,
  },
  error: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderRadius: 12,
    borderWidth: 1,
    color: "#b42318",
    fontSize: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlign: "center",
  },
  muted: {
    color: colors.textSoft,
    fontSize: 12,
    textAlign: "center",
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.card,
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
