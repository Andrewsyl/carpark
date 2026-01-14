import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path, Rect } from "react-native-svg";
import { useListingFlow } from "./context";
import { StepProgress } from "./StepProgress";

type FlowStackParamList = {
  ListingDetails: undefined;
  ListingAvailability: undefined;
};

type Props = NativeStackScreenProps<FlowStackParamList, "ListingDetails">;

const spaceTypes = ["Driveway", "Garage", "Car park", "Private road"];
const accessOptions = ["Gated", "Permit required", "EV charging"];

const SpaceTypeIcon = ({ type, active }: { type: string; active: boolean }) => {
  const stroke = active ? "#00d4aa" : "#94a3b8";
  const fill = active ? "#e6f9f5" : "#f1f5f9";
  switch (type) {
    case "Driveway":
      return (
        <Svg width={26} height={26} viewBox="0 0 26 26">
          <Rect x={1} y={7} width={10} height={14} rx={2} stroke={stroke} strokeWidth={2} />
          <Path d="M13 22V4l8 4v14z" fill={fill} stroke={stroke} strokeWidth={2} />
        </Svg>
      );
    case "Garage":
      return (
        <Svg width={26} height={26} viewBox="0 0 26 26">
          <Path d="M3 12l10-7 10 7v9H3z" fill={fill} stroke={stroke} strokeWidth={2} />
          <Rect x={7} y={13} width={12} height={8} rx={2} stroke={stroke} strokeWidth={2} />
        </Svg>
      );
    case "Car park":
      return (
        <Svg width={26} height={26} viewBox="0 0 26 26">
          <Rect x={3} y={3} width={20} height={20} rx={4} fill={fill} stroke={stroke} strokeWidth={2} />
          <Path d="M10 18V8h4.5a3.5 3.5 0 0 1 0 7H10" stroke={stroke} strokeWidth={2} fill="none" />
        </Svg>
      );
    case "Private road":
    default:
      return (
        <Svg width={26} height={26} viewBox="0 0 26 26">
          <Path d="M8 3h10l4 20H4z" fill={fill} stroke={stroke} strokeWidth={2} />
          <Path d="M13 7v12" stroke={stroke} strokeWidth={2} />
        </Svg>
      );
  }
};

export function ListingDetailsScreen({ navigation }: Props) {
  const { draft, setDraft } = useListingFlow();

  const toggleAccess = (option: string) => {
    setDraft((prev) => {
      const exists = prev.accessOptions.includes(option);
      return {
        ...prev,
        accessOptions: exists
          ? prev.accessOptions.filter((item) => item !== option)
          : [...prev.accessOptions, option],
      };
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>Tell us about your space</Text>
        <StepProgress current={3} total={7} />
        <Text style={styles.title}>What type of space is it?</Text>
        <Text style={styles.subtitle}>Pick the closest match. You can edit later.</Text>

        <View style={styles.grid}>
          {spaceTypes.map((type) => (
            <Pressable
              key={type}
              style={[
                styles.card,
                draft.spaceType === type && styles.cardActive,
              ]}
              onPress={() => setDraft((prev) => ({ ...prev, spaceType: type }))}
            >
              <View style={styles.cardRow}>
                <View style={[styles.cardIcon, draft.spaceType === type && styles.cardIconActive]}>
                  <SpaceTypeIcon type={type} active={draft.spaceType === type} />
                </View>
                <Text style={styles.cardTitle}>{type}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Access options</Text>
        <Text style={styles.subtitle}>Select anything that applies.</Text>
        <View style={styles.grid}>
          {accessOptions.map((option) => (
            <Pressable
              key={option}
              style={[
                styles.card,
                draft.accessOptions.includes(option) && styles.cardActive,
              ]}
              onPress={() => toggleAccess(option)}
            >
              <Text style={styles.cardTitle}>{option}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Access code (optional)</Text>
        <Text style={styles.subtitle}>Share a gate or keypad code if needed.</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 2468"
          placeholderTextColor="#9ca3af"
          value={draft.accessCode}
          onChangeText={(value) =>
            setDraft((prev) => ({
              ...prev,
              accessCode: value,
            }))
          }
          autoCapitalize="characters"
          maxLength={40}
        />
      </ScrollView>
      <View style={styles.footer}>
        <Pressable
          style={[styles.primaryButton, !draft.spaceType && styles.primaryButtonDisabled]}
          onPress={() => navigation.navigate("ListingAvailability")}
          disabled={!draft.spaceType}
        >
          <Text style={styles.primaryButtonText}>Continue</Text>
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
    paddingBottom: 140,
    paddingTop: 0,
  },
  kicker: {
    color: "#00d4aa",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  title: {
    color: "#0f172a",
    fontSize: 22,
    fontWeight: "700",
    marginTop: 6,
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  subtitle: {
    color: "#6b7280",
    fontSize: 13,
    marginTop: 6,
    lineHeight: 20,
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 16,
  },
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#e5e7eb",
    borderRadius: 16,
    borderWidth: 2,
    flexBasis: "48%",
    padding: 16,
  },
  cardActive: {
    borderColor: "#00d4aa",
  },
  cardRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  cardIcon: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  cardIconActive: {
    backgroundColor: "#e6f9f5",
  },
  cardTitle: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "600",
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  sectionTitle: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginTop: 24,
    textTransform: "uppercase",
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  input: {
    backgroundColor: "#ffffff",
    borderColor: "#e5e7eb",
    borderRadius: 14,
    borderWidth: 1,
    color: "#0f172a",
    fontSize: 14,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
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
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
});
