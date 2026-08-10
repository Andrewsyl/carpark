import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { CalendarDays, CalendarRange, Clock } from "lucide-react-native";
import { ChoiceOptionRow } from "./ChoiceTile";
import { useListingFlow } from "./context";
import { applyServiceFee } from "../../utils/pricing";
import { suggestPrices } from "../../utils/priceSuggestions";
import { FlowHeader } from "./FlowHeader";
import { StepQuestion, StepSection } from "./StepQuestion";
import { FlowFooter } from "./FlowFooter";
import { hostFlowColors } from "./hostFlowTheme";
import { colors } from "../../styles/theme";

type FlowStackParamList = {
  ListingPrice: { fromReview?: boolean } | undefined;
  ListingReview: undefined;
};

type Props = NativeStackScreenProps<FlowStackParamList, "ListingPrice">;

const FG = hostFlowColors.text;
const MUTED = hostFlowColors.textMuted;
// No card shadow: the system separates with a rule and white space.

// Daily rate ≈ 6 hours of parking — used to auto-derive an hourly rate from
// the host's daily rate until they edit hourly themselves.
const HOURS_PER_DAY_RATIO = 6;

const PRICING_MODES = [
  {
    key: "hourly_daily",
    label: "Hourly & daily",
    sub: "Short stays — drivers book your space by the hour or day.",
    icon: Clock,
  },
  {
    key: "monthly",
    label: "Monthly",
    sub: "Long-term parking — drivers enquire to arrange a monthly space.",
    icon: CalendarDays,
  },
  {
    key: "both",
    label: "Both",
    sub: "Offer short stays and monthly parking from the one listing.",
    icon: CalendarRange,
  },
] as const;

function round2(v: number) { return Math.round(v * 100) / 100; }
function fmt(v: number) { return round2(v).toFixed(2); }
function parse(v: string) {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) && n > 0 ? round2(n) : null;
}
function sanitize(v: string) {
  const s = v.replace(",", ".").replace(/[^\d.]/g, "");
  const [w, ...rest] = s.split(".");
  return rest.length > 0 ? `${w}.${rest.join("").slice(0, 2)}` : w;
}

type FieldRowProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  helper?: string | null;
  warning?: boolean;
  suggested?: boolean;
  isLast?: boolean;
};

function FieldRow({ label, value, onChange, helper, warning, suggested, isLast }: FieldRowProps) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  return (
    <View style={[fieldStyles.wrap, !isLast && fieldStyles.border]}>
      <View style={fieldStyles.inputGroup}>
        <View style={fieldStyles.labelWrap}>
          <Text style={fieldStyles.label}>{label}</Text>
          {suggested ? (
            <View style={fieldStyles.suggestedPill}>
              <Text style={fieldStyles.suggestedPillText}>Suggested</Text>
            </View>
          ) : null}
        </View>
        {/* Boxed chip so the rate reads as an editable field, not static text;
            the whole chip focuses the input. */}
        <Pressable
          style={[fieldStyles.inputChip, focused && fieldStyles.inputChipFocused]}
          onPress={() => inputRef.current?.focus()}
        >
          <Text style={fieldStyles.euro}>€</Text>
          <TextInput
            ref={inputRef}
            style={fieldStyles.input}
            value={value}
            onChangeText={(v) => onChange(sanitize(v))}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              const v = parse(value);
              if (v) onChange(fmt(v));
            }}
            keyboardType={Platform.OS === "ios" ? "decimal-pad" : "numeric"}
            placeholder="0.00"
            placeholderTextColor={colors.textDisabled}
            selectTextOnFocus
          />
        </Pressable>
      </View>
      {helper ? (
        <Text style={[fieldStyles.helper, warning && fieldStyles.helperWarn]}>{helper}</Text>
      ) : null}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  border: {
    borderBottomWidth: 1,
    borderBottomColor: hostFlowColors.border,
  },
  inputGroup: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  labelWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  label: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    color: FG,
    flexShrink: 1,
  },
  suggestedPill: {
    backgroundColor: hostFlowColors.accentSoft,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  suggestedPillText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 10,
    color: hostFlowColors.accent,
    letterSpacing: 0.3,
  },
  inputChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: hostFlowColors.cardBgMuted,
    borderWidth: 1.5,
    borderColor: hostFlowColors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inputChipFocused: {
    borderColor: hostFlowColors.accent,
    backgroundColor: hostFlowColors.cardBg,
  },
  euro: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 16,
    color: hostFlowColors.textMuted,
  },
  input: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 18,
    color: FG,
    textAlign: "right",
    minWidth: 64,
    padding: 0,
    includeFontPadding: false,
  },
  helper: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12,
    color: hostFlowColors.textSoft,
    marginTop: 4,
  },
  helperWarn: {
    // Dark amber for text (amber #f59e0b on white is only ~2.2:1 and fails AA at
    // this 12px size); the amber token stays for dots/borders elsewhere.
    color: colors.status.pending.text,
  },
});

export function ListingPriceScreen({ navigation, route }: Props) {
  const { draft, setDraft, listingId } = useListingFlow();
  const fromReview = route.params?.fromReview ?? false;
  const insets = useSafeAreaInsets();
  // May be undefined for a new listing until the host picks — that's what makes
  // the screen ask rather than default them into a mode.
  const pricingMode = draft.pricingMode;

  // Location-aware starting rates from the zone table (fetched at boot via
  // remoteConfig, baked-in fallback offline). Location and features are set on
  // earlier steps, so they can't change while this screen is mounted — compute
  // once. A saved draft's / existing listing's own prices always win below.
  const suggestion = useMemo(
    () =>
      suggestPrices({
        latitude: draft.location.latitude,
        longitude: draft.location.longitude,
        features: draft.accessOptions,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [hourly,  setHourly]  = useState(fmt(parse(draft.pricePerHour)  ?? suggestion.hourly));
  const [daily,   setDaily]   = useState(fmt(parse(draft.pricePerDay)   ?? suggestion.daily));
  const [monthly, setMonthly] = useState(fmt(parse(draft.pricePerMonth) ?? suggestion.monthly));

  // Mark a rate as only a starting suggestion until the host edits it — a nudge
  // that they can (and should) set their own price, without adding a hard gate.
  // New listings only; an existing listing's saved prices are real choices.
  const [touched, setTouched] = useState<{ hourly?: boolean; daily?: boolean; monthly?: boolean }>({});
  const isSuggested = (field: "hourly" | "daily" | "monthly", value: string, def: number) =>
    !listingId && !touched[field] && parse(value) === def;
  const withTouch =
    (field: "hourly" | "daily" | "monthly", setter: (v: string) => void) => (v: string) => {
      if (!touched[field]) setTouched((t) => ({ ...t, [field]: true }));
      setter(v);
    };

  // Most hosts think in a daily price, not an hourly one — so until they edit
  // the hourly field themselves, derive it from the daily rate (6h of parking
  // per day) and say so. Editing hourly stops the derive.
  const onDailyChange = (v: string) => {
    withTouch("daily", setDaily)(v);
    if (!touched.hourly && !listingId) {
      const d = parse(v);
      if (d) setHourly(fmt(round2(d / HOURS_PER_DAY_RATIO)));
    }
  };
  const hourlyAutoDerived = !listingId && !touched.hourly && !!touched.daily;

  const hourlyVal = parse(hourly) ?? 0;
  const dailyVal  = parse(daily)  ?? 0;

  const dailyRatio = useMemo(() => {
    if (hourlyVal <= 0 || dailyVal <= 0) return null;
    return round2(dailyVal / hourlyVal);
  }, [dailyVal, hourlyVal]);

  const dailyHelper = useMemo(() => {
    if (!dailyRatio) return null;
    if (dailyRatio > 24) return `Your daily rate is ${dailyRatio}× this — drivers would pay less booking by the hour`;
    return `Your daily rate ≈ ${dailyRatio}× this hourly rate`;
  }, [dailyRatio]);

  const showHourlyDaily = pricingMode === "hourly_daily" || pricingMode === "both";
  const showMonthly     = pricingMode === "monthly"      || pricingMode === "both";

  // Driver-facing preview uses the same cent-level fee rounding as the API
  // (utils/pricing mirrors calculateListingChargeCents), so the numbers shown
  // here are exactly what drivers will see. Monthly is enquiry-based, so no
  // driver price is claimed for it.
  const driverPreview = useMemo(() => {
    if (!showHourlyDaily) return null;
    const parts: string[] = [];
    if (hourlyVal > 0) parts.push(`€${fmt(applyServiceFee(hourlyVal))}/hr`);
    if (dailyVal > 0) parts.push(`€${fmt(applyServiceFee(dailyVal))}/day`);
    return parts.length ? parts.join(" · ") : null;
  }, [dailyVal, hourlyVal, showHourlyDaily]);

  useEffect(() => {
    setDraft((p) => ({ ...p, pricePerHour: hourly, pricePerDay: daily, pricePerMonth: monthly }));
  }, [daily, hourly, monthly, setDraft]);

  const exitFlow = () => {
    const parent = navigation.getParent();
    if (parent?.canGoBack()) parent.goBack();
  };

  const lastField = showMonthly ? "monthly" : showHourlyDaily ? "daily" : "hourly";

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <FlowHeader current={8} onClose={exitFlow} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: 104 + Math.max(insets.bottom, 0) }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {/* Header card */}
          <StepQuestion
            title={pricingMode ? "Set your rates" : "How do you want to rent your space?"}
          hint={"You can change this any time."}
/>

          {/* Pricing type card — the host explicitly chooses before any rate
              fields appear, rather than being dropped into a default mode. */}
          <View style={styles.section}>
            <StepSection title="Rental type" />
            <View style={styles.optionsWrap}>
              {PRICING_MODES.map((mode) => (
                <ChoiceOptionRow
                  key={mode.key}
                  badgeIcon={mode.icon}
                  title={mode.label}
                  hint={mode.sub}
                  selected={pricingMode === mode.key}
                  onPress={() => setDraft((p) => ({ ...p, pricingMode: mode.key }))}
                  single
                />
              ))}
            </View>
          </View>

          {/* Rates card — only once a rental type is chosen */}
          {pricingMode ? (
          <View style={styles.section}>
            <View style={styles.cardHeaderWrap}>
              <Text style={styles.cardHeaderTitle}>Rates</Text>
              {!listingId ? (
                <Text style={styles.suggestNote}>
                  Prefilled with typical rates for your area — change them anytime.
                </Text>
              ) : null}
            </View>
            {showHourlyDaily ? (
              <>
                <FieldRow
                  label="Daily"
                  value={daily}
                  onChange={onDailyChange}
                  suggested={isSuggested("daily", daily, suggestion.daily)}
                  isLast={false}
                />
                <FieldRow
                  label="Hourly"
                  value={hourly}
                  onChange={withTouch("hourly", setHourly)}
                  helper={
                    hourlyAutoDerived
                      ? "Auto-set from your daily rate — edit to override"
                      : dailyHelper
                  }
                  warning={!hourlyAutoDerived && !!dailyRatio && dailyRatio > 24}
                  suggested={isSuggested("hourly", hourly, suggestion.hourly)}
                  isLast={lastField === "daily" || lastField === "hourly"}
                />
              </>
            ) : null}
            {showMonthly ? (
              <FieldRow
                label="Monthly"
                value={monthly}
                onChange={withTouch("monthly", setMonthly)}
                suggested={isSuggested("monthly", monthly, suggestion.monthly)}
                isLast
              />
            ) : null}
          </View>
          ) : null}

          {/* The design closes this step with one centred muted line rather than
              a tinted callout, which is also what keeps green off a page whose
              only green should be the forward action. */}
          {showHourlyDaily ? (
            <Text style={styles.footnote}>
              You keep everything you set — the 8% service fee is added on top for
              the driver.
              {driverPreview ? ` Drivers will see ${driverPreview}.` : ""}
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <FlowFooter
        current={8}
        total={9}
        onBack={() => (fromReview ? navigation.navigate("ListingReview") : navigation.goBack())}
        primaryLabel={fromReview ? "Save changes" : "Continue"}
        primaryDisabled={!pricingMode}
        onPrimary={() => navigation.navigate("ListingReview")}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: hostFlowColors.bg },
  flex: { flex: 1 },
  content: {
    paddingHorizontal: 24,
    paddingTop: 28,
    gap: 14,
  },

  section: { paddingTop: 24 },
  // Rates header: title + suggestion note share the bordered block.
  cardHeaderWrap: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 3,
    borderBottomWidth: 1,
    borderBottomColor: hostFlowColors.border,
  },
  cardHeaderTitle: {
    color: FG,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 15,
    letterSpacing: -0.3,
  },
  suggestNote: {
    color: hostFlowColors.textSoft,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12,
    lineHeight: 17,
  },

  /** The rows carry their own fill and radius; this only spaces them. */
  optionsWrap: { gap: 12, paddingTop: 12 },

  // The design's closing line: centred, muted, no tile.
  footnote: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    lineHeight: 20,
    color: MUTED,
    textAlign: "center",
    marginTop: 16,
  },
});
