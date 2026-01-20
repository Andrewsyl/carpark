import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path, Rect, Circle } from "react-native-svg";
import { useListingFlow } from "./context";
import { StepProgress } from "./StepProgress";
import { colors, radius, spacing, textStyles } from "../../styles/theme";

type FlowStackParamList = {
  ListingDetails: undefined;
  ListingAvailability: undefined;
};

type Props = NativeStackScreenProps<FlowStackParamList, "ListingDetails">;

const spaceTypes = ["Driveway", "Garage", "Car park", "Private road"];
const accessOptions = ["Gated", "Permit required", "EV charging", "CCTV", "Covered"];

const SpaceTypeIcon = ({ type, active }: { type: string; active: boolean }) => {
  const stroke = active ? colors.accent : colors.textSoft;
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
        <Text style={styles.subtitle}>Pick the closest match</Text>

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

        <Text style={styles.sectionTitle}>Features</Text>
        <Text style={styles.subtitle}>What does your space have?</Text>
        <View style={styles.chipGrid}>
          {accessOptions.map((option) => {
            const isSelected = draft.accessOptions.includes(option);
            return (
              <Pressable
                key={option}
                style={[styles.chip, isSelected && styles.chipActive]}
                onPress={() => toggleAccess(option)}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                  {option}
                </Text>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
                )}
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Access notes (optional)</Text>
        <Text style={styles.subtitle}>Gate code or special instructions</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Gate code is 2468"
          placeholderTextColor="#9ca3af"
          value={draft.accessCode}
          onChangeText={(value) =>
            setDraft((prev) => ({
              ...prev,
              accessCode: value,
            }))
          }
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          maxLength={150}
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
    backgroundColor: colors.appBg,
  },
  content: {
    padding: spacing.screenX,
    paddingBottom: 140,
    paddingTop: 0,
  },
  kicker: textStyles.kicker,
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "600",
    marginTop: 6,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 6,
    lineHeight: 20,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 2,
    flexBasis: "48%",
    padding: 14,
  },
  cardActive: {
    borderColor: colors.accent,
    backgroundColor: "#ffffff",
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
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  cardIconActive: {
    backgroundColor: "#e9fbf6",
  },
  cardTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
    marginTop: 24,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  chip: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
    borderRadius: 999,
    borderWidth: 1.5,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipActive: {
    backgroundColor: "#e9fbf6",
    borderColor: colors.accent,
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  chipTextActive: {
    color: colors.text,
    fontWeight: "600",
  },
  input: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1.5,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
    minHeight: 80,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
  },
  footer: {
    backgroundColor: colors.cardBg,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    padding: 16,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
  },
  primaryButtonDisabled: {
    backgroundColor: "#cbd5e1",
  },
  primaryButtonText: {
    color: colors.cardBg,
    fontSize: 16,
    fontWeight: "600",
  },
});
