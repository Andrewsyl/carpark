import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useListingFlow } from "./context";
import { StepProgress } from "./StepProgress";

type FlowStackParamList = {
  ListingPrice: undefined;
  ListingPhotos: undefined;
};

type Props = NativeStackScreenProps<FlowStackParamList, "ListingPrice">;

export function ListingPriceScreen({ navigation }: Props) {
  const { draft, setDraft } = useListingFlow();
  const recommendedPrice = 22;
  const nudgeRange = { low: 18, high: 26 };
  const [dailyPrice, setDailyPrice] = useState(() => {
    const parsed = Number.parseFloat(draft.pricePerDay);
    // Pre-filling a recommended price reduces decision friction.
    return Number.isFinite(parsed) ? parsed : recommendedPrice;
  });
  const [hourlyPrice, setHourlyPrice] = useState(() =>
    Number.isFinite(dailyPrice) ? Number((dailyPrice / 24).toFixed(2)) : 0
  );

  useEffect(() => {
    const parsed = Number.parseFloat(draft.pricePerDay);
    if (Number.isFinite(parsed)) {
      setDailyPrice(parsed);
      setHourlyPrice(Number((parsed / 24).toFixed(2)));
    }
  }, [draft.pricePerDay]);
  const monthlyEstimate = Math.round(dailyPrice * 14);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroRow}>
            <Text style={styles.kicker}>Set your price</Text>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>Step 5 of 7</Text>
            </View>
          </View>
          <StepProgress current={5} total={7} />
          <Text style={styles.title}>Set your rates</Text>
          <Text style={styles.subtitle}>
            Spaces nearby earn around €320/month. You can adjust anytime.
          </Text>
        </View>

        <View style={styles.priceCard}>
          <View style={styles.priceHeader}>
            <Text style={styles.priceLabel}>Rates</Text>
            <View style={styles.pricePill}>
              <Text style={styles.pricePillText}>€{Math.round(dailyPrice)} / day</Text>
            </View>
          </View>
          {/* Compact reassurance keeps the layout clean while reducing pricing anxiety. */}
          <Text style={styles.helperText}>Based on similar spaces nearby · Edit anytime</Text>

          <View style={styles.rateGrid}>
            <View style={styles.rateTile}>
              <Text style={styles.rateLabel}>Hourly</Text>
              <View style={styles.rateInput}>
                <Text style={styles.ratePrefix}>€</Text>
                <TextInput
                  style={styles.rateValue}
                  value={Number.isFinite(hourlyPrice) ? String(hourlyPrice) : ""}
                  keyboardType="decimal-pad"
                  onChangeText={(value) => {
                    const sanitized = value.replace(/[^0-9.]/g, "");
                    const parsed = Number.parseFloat(sanitized);
                    if (!Number.isFinite(parsed)) {
                      setHourlyPrice(0);
                      return;
                    }
                    const nextHourly = Number(parsed.toFixed(2));
                    const nextDaily = Number((nextHourly * 24).toFixed(2));
                    setHourlyPrice(nextHourly);
                    setDailyPrice(nextDaily);
                    setDraft((prev) => ({ ...prev, pricePerDay: String(nextDaily) }));
                  }}
                  placeholder="2.50"
                  placeholderTextColor="#98a2b3"
                />
              </View>
              <Text style={styles.rateHint}>Quick stays</Text>
            </View>
            <View style={[styles.rateTile, styles.rateTileActive]}>
              <Text style={styles.rateLabel}>Daily</Text>
              <View style={styles.rateInput}>
                <Text style={styles.ratePrefix}>€</Text>
                <TextInput
                  style={styles.rateValue}
                  value={Number.isFinite(dailyPrice) ? String(dailyPrice) : ""}
                  keyboardType="decimal-pad"
                  onChangeText={(value) => {
                    const sanitized = value.replace(/[^0-9.]/g, "");
                    const parsed = Number.parseFloat(sanitized);
                    if (!Number.isFinite(parsed)) {
                      setDailyPrice(0);
                      return;
                    }
                    const nextDaily = Number(parsed.toFixed(2));
                    setDailyPrice(nextDaily);
                    setHourlyPrice(Number((nextDaily / 24).toFixed(2)));
                    setDraft((prev) => ({ ...prev, pricePerDay: String(nextDaily) }));
                  }}
                  placeholder="22"
                  placeholderTextColor="#98a2b3"
                />
              </View>
              <Text style={styles.rateHint}>Best value</Text>
            </View>
          </View>

          {/* Range nudge gently steers toward competitive pricing. */}
          <View style={styles.insightRow}>
            <Text style={styles.nudgeText}>
              Most hosts choose €{nudgeRange.low}–€{nudgeRange.high}
            </Text>
            <View style={styles.insightPill}>
              <Text style={styles.insightLabel}>Monthly est.</Text>
              <Text style={styles.insightValue}>€{monthlyEstimate}</Text>
            </View>
          </View>

          <View style={styles.recommendRow}>
            <Text style={styles.recommendLabel}>Recommended</Text>
            <Text style={styles.recommendValue}>€{recommendedPrice}</Text>
          </View>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Pressable
          style={[
            styles.primaryButton,
            !draft.pricePerDay.trim() && styles.primaryButtonDisabled,
          ]}
          onPress={() => navigation.navigate("ListingPhotos")}
          disabled={!draft.pricePerDay.trim()}
        >
          <Text style={styles.primaryButtonText}>Set price</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  content: {
    padding: 24,
    paddingBottom: 160,
    paddingTop: 0,
  },
  hero: {
    gap: 8,
  },
  heroRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  heroBadge: {
    backgroundColor: "#111827",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  heroBadgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
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
    fontSize: 28,
    fontWeight: "700",
    marginTop: 8,
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  subtitle: {
    color: "#6b7280",
    fontSize: 15,
    marginTop: 8,
    lineHeight: 24,
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  priceCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    marginTop: 24,
    padding: 24,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  priceLabel: {
    color: "#475467",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  priceHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  pricePill: {
    backgroundColor: "#0f172a",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  pricePillText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  helperText: {
    color: "#475467",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 10,
    letterSpacing: 0.3,
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  rateGrid: {
    flexDirection: "row",
    gap: 16,
    marginTop: 20,
  },
  rateTile: {
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    flex: 1,
    padding: 16,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  rateTileActive: {
    backgroundColor: "#ecfdf5",
  },
  rateLabel: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  rateInput: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  ratePrefix: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "700",
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  rateValue: {
    color: "#0f172a",
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  rateHint: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 10,
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  insightRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  nudgeText: {
    color: "#6b7280",
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    marginRight: 12,
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  insightPill: {
    backgroundColor: "#0f172a",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  insightLabel: {
    color: "#9ca3af",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  insightValue: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  recommendRow: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  recommendLabel: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  recommendValue: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "700",
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  footer: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#00d4aa",
    borderRadius: 20,
    borderTopColor: "rgba(255, 255, 255, 0.4)",
    borderTopWidth: 1,
    paddingVertical: 18,
    shadowColor: "#ffffff",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 0,
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
