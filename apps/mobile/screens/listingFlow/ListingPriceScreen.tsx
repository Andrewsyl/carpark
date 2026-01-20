import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useListingFlow } from "./context";
import { StepProgress } from "./StepProgress";
import { colors, radius, spacing, textStyles } from "../../styles/theme";

type FlowStackParamList = {
  ListingPrice: undefined;
  ListingPhotos: undefined;
};

type Props = NativeStackScreenProps<FlowStackParamList, "ListingPrice">;

export function ListingPriceScreen({ navigation }: Props) {
  const { draft, setDraft } = useListingFlow();
  const recommendedPrice = 22;
  const [dailyPrice, setDailyPrice] = useState(() => {
    const parsed = Number.parseFloat(draft.pricePerDay);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : recommendedPrice;
  });

  useEffect(() => {
    const parsed = Number.parseFloat(draft.pricePerDay);
    if (Number.isFinite(parsed) && parsed > 0) {
      setDailyPrice(parsed);
    }
  }, [draft.pricePerDay]);

  useEffect(() => {
    if (dailyPrice > 0) {
      setDraft((prev) => ({ ...prev, pricePerDay: String(dailyPrice) }));
    }
  }, [dailyPrice, setDraft]);

  const monthlyEstimate = Math.round(dailyPrice * 20);

  const handlePriceChange = (value: string) => {
    const sanitized = value.replace(/[^0-9.]/g, "");
    const parsed = Number.parseFloat(sanitized);
    if (!Number.isFinite(parsed)) {
      setDailyPrice(0);
      return;
    }
    const nextDaily = Number(parsed.toFixed(2));
    setDailyPrice(nextDaily);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>Set your price</Text>
        <StepProgress current={5} total={7} />
        <Text style={styles.title}>How much will you charge?</Text>
        <Text style={styles.subtitle}>
          You can always change this later
        </Text>

        <View style={styles.priceInputCard}>
          <Text style={styles.inputLabel}>Daily rate</Text>
          <View style={styles.priceInputRow}>
            <Text style={styles.currencySymbol}>€</Text>
            <TextInput
              style={styles.priceInput}
              value={dailyPrice > 0 ? String(dailyPrice) : ""}
              keyboardType="decimal-pad"
              onChangeText={handlePriceChange}
              placeholder="22"
              placeholderTextColor="#cbd5e1"
            />
            <Text style={styles.perDayText}>per day</Text>
          </View>
        </View>

        <View style={styles.estimateCard}>
          <View style={styles.estimateRow}>
            <Ionicons name="calendar-outline" size={20} color={colors.accent} />
            <Text style={styles.estimateLabel}>Monthly estimate</Text>
          </View>
          <Text style={styles.estimateValue}>€{monthlyEstimate}</Text>
          <Text style={styles.estimateHint}>Based on ~20 days booked per month</Text>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoIconCircle}>
            <Ionicons name="information" size={20} color={colors.accent} />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Recommended: €{recommendedPrice}/day</Text>
            <Text style={styles.infoText}>
              Similar spaces nearby earn around €{Math.round(recommendedPrice * 20)}/month
            </Text>
          </View>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Pressable
          style={[
            styles.primaryButton,
            dailyPrice === 0 && styles.primaryButtonDisabled,
          ]}
          onPress={() => navigation.navigate("ListingPhotos")}
          disabled={dailyPrice === 0}
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
  priceInputCard: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 24,
    padding: 20,
  },
  inputLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 14,
  },
  priceInputRow: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
    borderRadius: 14,
    borderWidth: 2,
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  currencySymbol: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "600",
    marginRight: 8,
  },
  priceInput: {
    color: colors.text,
    flex: 1,
    fontSize: 36,
    fontWeight: "600",
    padding: 0,
  },
  perDayText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
  estimateCard: {
    backgroundColor: "#e9fbf6",
    borderColor: "#b8efe3",
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 16,
    padding: 18,
  },
  estimateRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  estimateLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  estimateValue: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "600",
  },
  estimateHint: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  infoCard: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    marginTop: 16,
    padding: 16,
  },
  infoIconCircle: {
    alignItems: "center",
    backgroundColor: "#e9fbf6",
    borderRadius: 999,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  infoContent: {
    flex: 1,
    gap: 4,
  },
  infoTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  infoText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
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
