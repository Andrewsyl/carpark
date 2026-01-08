import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useListingFlow } from "./context";
import { StepProgress } from "./StepProgress";

type FlowStackParamList = {
  ListingPhotos: undefined;
  ListingReview: undefined;
};

type Props = NativeStackScreenProps<FlowStackParamList, "ListingPhotos">;

export function ListingPhotosScreen({ navigation }: Props) {
  const { draft, setDraft } = useListingFlow();
  const hasPhoto = draft.photos.some((photo) => photo?.trim());

  const updatePhoto = (index: number, value: string) => {
    setDraft((prev) => {
      const next = [...prev.photos];
      next[index] = value;
      return { ...prev, photos: next };
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>Add photos (optional)</Text>
        <StepProgress current={6} total={7} />
        <Text style={styles.title}>Show off your space</Text>
        <Text style={styles.subtitle}>
          Photos help drivers trust your listing, but you can add them later.
        </Text>

        {[0, 1, 2].map((index) => (
          <View key={index} style={styles.field}>
            <Text style={styles.label}>Photo URL {index + 1}</Text>
            <TextInput
              style={styles.input}
              value={draft.photos[index] ?? ""}
              onChangeText={(value) => updatePhoto(index, value)}
              placeholder="https://..."
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
            />
          </View>
        ))}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable
          style={[styles.primaryButton, !hasPhoto && styles.primaryButtonDisabled]}
          onPress={() => navigation.navigate("ListingReview")}
          disabled={!hasPhoto}
        >
          <Text style={styles.primaryButtonText}>Continue</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate("ListingReview")}>
          <Text style={styles.secondaryButtonText}>Skip for now</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f7fb",
  },
  content: {
    padding: 18,
    paddingBottom: 160,
  },
  kicker: {
    color: "#00d4aa",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    color: "#0f172a",
    fontSize: 22,
    fontWeight: "700",
    marginTop: 6,
  },
  subtitle: {
    color: "#6b7280",
    fontSize: 13,
    marginTop: 6,
  },
  field: {
    marginTop: 16,
  },
  label: {
    color: "#475467",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  input: {
    borderColor: "#e5e7eb",
    borderRadius: 12,
    borderWidth: 1,
    color: "#0f172a",
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  footer: {
    backgroundColor: "#ffffff",
    borderTopColor: "#e5e7eb",
    borderTopWidth: 1,
    padding: 16,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#00d4aa",
    borderRadius: 14,
    paddingVertical: 14,
  },
  primaryButtonDisabled: {
    backgroundColor: "#cbd5e1",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryButton: {
    alignItems: "center",
    borderRadius: 14,
    marginTop: 10,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "600",
  },
});
