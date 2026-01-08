import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

export function SettingsScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
        <Text style={styles.topTitle}>Settings</Text>
        <View style={styles.backButton} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Preferences</Text>
          <Text style={styles.cardBody}>
            Configure notifications, privacy, and payment preferences here.
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Support</Text>
          <Text style={styles.cardBody}>Need help? Contact support@carparking.app.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#f5f7fb",
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
    gap: 12,
  },
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#e5e7eb",
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
    color: "#6b7280",
    fontSize: 13,
    marginTop: 6,
  },
});
