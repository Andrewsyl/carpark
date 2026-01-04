import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useListingFlow } from "./context";
import { StepProgress } from "./StepProgress";

type FlowStackParamList = {
  ListingAvailability: undefined;
  ListingPrice: undefined;
};

type Props = NativeStackScreenProps<FlowStackParamList, "ListingAvailability">;

export function ListingAvailabilityScreen({ navigation }: Props) {
  const { draft, setDraft } = useListingFlow();
  const detail = draft.availability.detail.trim();
  const canContinue =
    draft.availability.mode === "daily" ||
    (draft.availability.mode === "dates" && detail.length > 0) ||
    (draft.availability.mode === "recurring" && detail.length > 0);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>Availability</Text>
        <StepProgress current={4} total={7} />
        <Text style={styles.title}>When is your space available?</Text>
        <Text style={styles.subtitle}>Most hosts start with every day.</Text>

        <Pressable
          style={[
            styles.optionCard,
            draft.availability.mode === "daily" && styles.optionCardActive,
          ]}
          onPress={() =>
            setDraft((prev) => ({
              ...prev,
              availability: { mode: "daily", detail: "Available every day" },
            }))
          }
        >
          <Text style={styles.optionTitle}>Available every day</Text>
          <Text style={styles.optionBody}>You can change this later.</Text>
        </Pressable>

        <Pressable
          style={[
            styles.optionCard,
            draft.availability.mode === "dates" && styles.optionCardActive,
          ]}
          onPress={() =>
            setDraft((prev) => ({
              ...prev,
              availability: { mode: "dates", detail: prev.availability.detail },
            }))
          }
        >
          <Text style={styles.optionTitle}>Specific dates</Text>
          <Text style={styles.optionBody}>Set a date range.</Text>
        </Pressable>
        {draft.availability.mode === "dates" ? (
          <View style={styles.inlineRow}>
            <TextInput
              style={styles.input}
              placeholder="Start date"
              placeholderTextColor="#94a3b8"
              value={draft.availability.detail}
              onChangeText={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  availability: { ...prev.availability, detail: value },
                }))
              }
            />
            <TextInput
              style={styles.input}
              placeholder="End date"
              placeholderTextColor="#94a3b8"
            />
          </View>
        ) : null}

        <Pressable
          style={[
            styles.optionCard,
            draft.availability.mode === "recurring" && styles.optionCardActive,
          ]}
          onPress={() =>
            setDraft((prev) => ({
              ...prev,
              availability: { mode: "recurring", detail: prev.availability.detail },
            }))
          }
        >
          <Text style={styles.optionTitle}>Recurring schedule</Text>
          <Text style={styles.optionBody}>Choose days and times.</Text>
        </Pressable>
        {draft.availability.mode === "recurring" ? (
          <TextInput
            style={styles.input}
            placeholder="e.g. Weekdays 8am-6pm"
            placeholderTextColor="#94a3b8"
            value={draft.availability.detail}
            onChangeText={(value) =>
              setDraft((prev) => ({
                ...prev,
                availability: { ...prev.availability, detail: value },
              }))
            }
          />
        ) : null}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable
          style={[styles.primaryButton, !canContinue && styles.primaryButtonDisabled]}
          onPress={() => navigation.navigate("ListingPrice")}
          disabled={!canContinue}
        >
          <Text style={styles.primaryButtonText}>Save availability</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  content: {
    padding: 18,
    paddingBottom: 140,
  },
  kicker: {
    color: "#2563eb",
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
    color: "#64748b",
    fontSize: 13,
    marginTop: 6,
  },
  optionCard: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 12,
    padding: 16,
  },
  optionCardActive: {
    borderColor: "#2fa84f",
    borderWidth: 2,
  },
  optionTitle: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "700",
  },
  optionBody: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 6,
  },
  inlineRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
  },
  input: {
    borderColor: "#e2e8f0",
    borderRadius: 12,
    borderWidth: 1,
    color: "#0f172a",
    flex: 1,
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
  },
  footer: {
    backgroundColor: "#f8fafc",
    borderTopColor: "#e2e8f0",
    borderTopWidth: 1,
    padding: 16,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#2fa84f",
    borderRadius: 14,
    paddingVertical: 14,
  },
  primaryButtonDisabled: {
    backgroundColor: "#cbd5f5",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
});
