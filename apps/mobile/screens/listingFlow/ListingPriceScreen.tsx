import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Slider from "@react-native-community/slider";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { useListingFlow } from "./context";
import { StepProgress } from "./StepProgress";

type FlowStackParamList = {
  ListingPrice: undefined;
  ListingPhotos: undefined;
};

type Props = NativeStackScreenProps<FlowStackParamList, "ListingPrice">;

const TierIcon = ({ tone }: { tone: "low" | "mid" | "high" }) => {
  const stroke = "#0f172a";
  const fill = tone === "low" ? "#e0f2fe" : tone === "mid" ? "#fef3c7" : "#dcfce7";
  const accent = tone === "low" ? "#38bdf8" : tone === "mid" ? "#f59e0b" : "#22c55e";
  return (
    <Svg width={28} height={28} viewBox="0 0 28 28">
      <Rect x={4} y={8} width={20} height={12} rx={2.5} fill={fill} stroke={stroke} strokeWidth={1.6} />
      <Circle cx={14} cy={14} r={4} fill={accent} stroke={stroke} strokeWidth={1.6} />
      <Path d="M14 11.5v5" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M12.2 12.8c0.4-0.6 3.2-0.6 3.6 0" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M12.2 15.2c0.4 0.6 3.2 0.6 3.6 0" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M6 21h16" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" />
      {tone !== "low" ? (
        <Rect x={7} y={4} width={14} height={5} rx={2} fill={fill} stroke={stroke} strokeWidth={1.6} />
      ) : null}
      {tone === "high" ? (
        <Rect x={9} y={1} width={10} height={4} rx={2} fill={fill} stroke={stroke} strokeWidth={1.6} />
      ) : null}
    </Svg>
  );
};

export function ListingPriceScreen({ navigation }: Props) {
  const { draft, setDraft } = useListingFlow();
  const presets = useState([10, 15, 20, 25, 30, 40])[0];
  const [priceValue, setPriceValue] = useState(() => {
    const parsed = Number.parseFloat(draft.pricePerDay);
    return Number.isFinite(parsed) ? parsed : 22;
  });
  const nearestPreset = (value: number) => {
    let closest = presets[0];
    let closestDiff = Math.abs(value - closest);
    for (let i = 1; i < presets.length; i += 1) {
      const diff = Math.abs(value - presets[i]);
      if (diff < closestDiff) {
        closestDiff = diff;
        closest = presets[i];
      }
    }
    return closest;
  };

  useEffect(() => {
    const parsed = Number.parseFloat(draft.pricePerDay);
    if (Number.isFinite(parsed)) {
      setPriceValue(parsed);
    }
  }, [draft.pricePerDay]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>Set your price</Text>
        <StepProgress current={5} total={7} />
        <Text style={styles.title}>Choose a daily rate</Text>
        <Text style={styles.subtitle}>
          Spaces nearby earn around €320/month. You can adjust anytime.
        </Text>

        <View style={styles.priceCard}>
          <View style={styles.priceHeader}>
            <Text style={styles.priceLabel}>Price per day</Text>
            <View style={styles.pricePill}>
              <Text style={styles.pricePillText}>€{Math.round(priceValue)}</Text>
            </View>
          </View>
          <Slider
            style={styles.priceSlider}
            minimumValue={presets[0]}
            maximumValue={presets[presets.length - 1]}
            step={1}
            minimumTrackTintColor="#00d4aa"
            maximumTrackTintColor="#e5e7eb"
            thumbTintColor="#0f172a"
            value={priceValue}
            onValueChange={(value) => {
              const next = nearestPreset(value);
              setPriceValue(next);
              setDraft((prev) => ({ ...prev, pricePerDay: String(next) }));
            }}
          />
          <View style={styles.priceRangeRow}>
            <Text style={styles.priceRangeText}>€5</Text>
            <Text style={styles.priceRangeText}>€120</Text>
          </View>
          <View style={styles.tierRow}>
            <Pressable
              style={styles.tierCard}
              onPress={() => {
                const next = presets[0];
                setPriceValue(next);
                setDraft((prev) => ({ ...prev, pricePerDay: String(next) }));
              }}
            >
              <TierIcon tone="low" />
              <Text style={styles.tierTitle}>Budget</Text>
              <Text style={styles.tierValue}>€{presets[0]}</Text>
            </Pressable>
            <Pressable
              style={styles.tierCard}
              onPress={() => {
                const next = presets[3];
                setPriceValue(next);
                setDraft((prev) => ({ ...prev, pricePerDay: String(next) }));
              }}
            >
              <TierIcon tone="mid" />
              <Text style={styles.tierTitle}>Balanced</Text>
              <Text style={styles.tierValue}>€{presets[3]}</Text>
            </Pressable>
            <Pressable
              style={styles.tierCard}
              onPress={() => {
                const next = presets[presets.length - 1];
                setPriceValue(next);
                setDraft((prev) => ({ ...prev, pricePerDay: String(next) }));
              }}
            >
              <TierIcon tone="high" />
              <Text style={styles.tierTitle}>Premium</Text>
              <Text style={styles.tierValue}>€{presets[presets.length - 1]}</Text>
            </Pressable>
          </View>
          <Text style={styles.suggested}>Suggested price: €22</Text>
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
    backgroundColor: "#f5f7fb",
  },
  content: {
    padding: 18,
    paddingBottom: 140,
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
  priceCard: {
    backgroundColor: "#ffffff",
    borderColor: "#e5e7eb",
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 16,
    padding: 16,
  },
  priceLabel: {
    color: "#475467",
    fontSize: 12,
    fontWeight: "700",
  },
  priceHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  pricePill: {
    backgroundColor: "#eef2f7",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pricePillText: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "700",
  },
  priceSlider: {
    marginTop: 12,
  },
  priceRangeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  priceRangeText: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "600",
  },
  tierRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  tierCard: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderColor: "#e5e7eb",
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 10,
  },
  tierTitle: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6,
  },
  tierValue: {
    color: "#6b7280",
    fontSize: 11,
    marginTop: 2,
  },
  suggested: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 10,
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
});
