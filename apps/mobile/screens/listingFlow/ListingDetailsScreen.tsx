import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Building2,
  CircleParking,
  House,
  Minus,
  Plus,
  Signpost,
  Warehouse,
  type LucideIcon,
} from "lucide-react-native";
import hatchbackArt from "../../assets/vehicles/hatchback.png";
import saloonArt from "../../assets/vehicles/sedan.png";
import suvArt from "../../assets/vehicles/suv.png";
import vanArt from "../../assets/vehicles/van.png";
import { useListingFlow } from "./context";
import { FlowHeader } from "./FlowHeader";
import { ChoiceGrid, ChoiceRow, ChoiceSummary, ChoiceTile } from "./ChoiceTile";
import { StepQuestion, StepRule, StepSection } from "./StepQuestion";
import { hostFlowColors } from "./hostFlowTheme";
import { FlowFooter } from "./FlowFooter";

type FlowStackParamList = {
  ListingDetails: { fromReview?: boolean } | undefined;
  ListingFeatures: undefined;
  ListingReview: undefined;
};

type Props = NativeStackScreenProps<FlowStackParamList, "ListingDetails">;

const FG = hostFlowColors.text;
const MUTED = hostFlowColors.textMuted;
// No card shadow: the system separates with a rule and white space.

const spaceTypes = ["Private Driveway", "Garage", "Apartment / underground", "Car park", "Private road"];
// Bundled, not hotlinked. These were fetched from img.icons8.com at render time,
// which made a required step show four blank boxes whenever the host was offline
// and put a third-party request on their device. Same artwork, shipped with the
// app.
const vehicleSizeOptions = [
  { value: "small",  label: "Hatchback",  example: "Small & city cars",            image: hatchbackArt },
  { value: "medium", label: "Saloon",     example: "Saloons & family cars",        image: saloonArt },
  { value: "large",  label: "SUV / Jeep", example: "SUVs, jeeps & 4x4s",           image: suvArt },
  { value: "van",    label: "Van",        example: "Vans, minibuses & campervans", image: vanArt },
];

/** Which section of the step is open. Each one unlocks the next. */
type DetailStep = "type" | "count" | "vehicle";

const MIN_SPACE_COUNT = 1;
const MAX_SPACE_COUNT = 99;

function parseSpaceCount(value: string) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < MIN_SPACE_COUNT) return null;
  return Math.min(parsed, MAX_SPACE_COUNT);
}

// The tile draws its own glyph at 24/1.7 in ink, so this only picks which one.
function spaceTypeIcon(type: string): LucideIcon {
  switch (type) {
    case "Private Driveway":        return House;
    case "Garage":                  return Warehouse;
    case "Apartment / underground": return Building2;
    case "Car park":                return CircleParking;
    default:                        return Signpost;
  }
}

export function ListingDetailsScreen({ navigation, route }: Props) {
  const { draft, setDraft } = useListingFlow();
  const fromReview = route.params?.fromReview ?? false;
  const insets = useSafeAreaInsets();
  // Resuming a part-finished draft opens at the first unanswered question
  // rather than back at the top.
  const [openStep, setOpenStep] = useState<DetailStep>(() => {
    if (!draft.spaceType) return "type";
    if (!draft.spaceCount) return "count";
    return "vehicle";
  });
  // Starts at 0 (unselected) so the host actively picks a count instead of
  // silently accepting a defaulted 1.
  const [spaceCountInput, setSpaceCountInput] = useState<number>(
    () => parseSpaceCount(draft.spaceCount) ?? 0
  );
  const canContinue = Boolean(draft.spaceType) && Boolean(draft.spaceCount) && Boolean(draft.vehicleSize);
  const confirmedSpaceCount = parseSpaceCount(draft.spaceCount);
  const hasConfirmedCount = confirmedSpaceCount !== null && confirmedSpaceCount > 0;

  useEffect(() => {
    if (confirmedSpaceCount !== null && confirmedSpaceCount > 0) {
      setSpaceCountInput(confirmedSpaceCount);
    } else if (!draft.spaceType) {
      setSpaceCountInput(0);
    }
  }, [confirmedSpaceCount, draft.spaceType]);

  const adjustSpaceCount = (delta: number) => {
    const next = Math.min(MAX_SPACE_COUNT, Math.max(0, spaceCountInput + delta));
    setSpaceCountInput(next);
    setDraft((current) => ({ ...current, spaceCount: next > 0 ? String(next) : "", capacity: next > 0 ? next : 1 }));
    setOpenStep(next > 0 ? "vehicle" : "count");
  };

  const chooseSpaceType = (type: string) => {
    setDraft((prev) => ({ ...prev, spaceType: type }));
    // Collapse to the summary row and hand the step to the next question. The
    // host can reopen it from "Change".
    setOpenStep(hasConfirmedCount ? "vehicle" : "count");
  };

  // The type grid is open until it is answered; after that it is a one-line
  // summary the host can reopen. Count follows type, vehicle follows count.
  const typeOpen = !draft.spaceType || openStep === "type";
  const showCount = Boolean(draft.spaceType) && !typeOpen;
  const showVehicle = showCount && hasConfirmedCount;

  const exitFlow = () => {
    const parent = navigation.getParent();
    if (parent?.canGoBack()) parent.goBack();
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <FlowHeader current={3} onClose={exitFlow} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 104 + Math.max(insets.bottom, 0) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* One question at a time. Answering a section collapses it to a
            one-line summary and reveals the next, so the step never presents
            three unanswered questions at once. Every answered section stays
            reopenable from "Change" — disclosure hides what is settled, it
            does not lock it. */}
        <StepQuestion
          title="Which of these best describes your space?"
          hint="Pick the option that matches it most closely."
        />

        {typeOpen ? (
          <View style={styles.gridWrap}>
            <ChoiceGrid>
              {spaceTypes.map((type) => (
                <ChoiceTile
                  key={type}
                  icon={spaceTypeIcon(type)}
                  label={type}
                  selected={draft.spaceType === type}
                  onPress={() => chooseSpaceType(type)}
                />
              ))}
            </ChoiceGrid>
            {draft.spaceType === "Private road" ? (
              <Text style={styles.typeNote}>
                Only list a private road you own or have the owner&apos;s permission to rent.
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.summaryWrap}>
            <ChoiceSummary
              label={draft.spaceType}
              onPress={() => setOpenStep("type")}
              accessibilityLabel={`Space type: ${draft.spaceType}. Change`}
            />
          </View>
        )}

        {showCount ? (
          <>
            <StepRule />

            <View style={styles.counterRowWrap}>
              <View style={styles.counterCopy}>
                <StepSection title="Spaces" hint="How many can be booked at once" />
              </View>
              <View style={styles.counterControls}>
                <Pressable
                  style={[styles.counterButton, spaceCountInput <= 1 && styles.counterButtonDisabled]}
                  onPress={() => adjustSpaceCount(-1)}
                  disabled={spaceCountInput <= 1}
                  accessibilityRole="button"
                  accessibilityLabel="Fewer spaces"
                >
                  <Minus size={16} color={MUTED} strokeWidth={2} />
                </Pressable>
                <Text style={styles.counterValueText}>{spaceCountInput}</Text>
                <Pressable
                  style={[
                    styles.counterButton,
                    styles.counterButtonActive,
                    spaceCountInput >= MAX_SPACE_COUNT && styles.counterButtonDisabled,
                  ]}
                  onPress={() => adjustSpaceCount(1)}
                  disabled={spaceCountInput >= MAX_SPACE_COUNT}
                  accessibilityRole="button"
                  accessibilityLabel="More spaces"
                >
                  <Plus size={16} color={FG} strokeWidth={2} />
                </Pressable>
              </View>
            </View>
          </>
        ) : null}

        {showVehicle ? (
          <>
            <StepRule />

            <StepSection title="Largest vehicle that fits" />
            <View style={styles.vehicleList}>
              {vehicleSizeOptions.map((option) => (
                <ChoiceRow
                  key={option.value}
                  title={option.label}
                  hint={option.example}
                  selected={draft.vehicleSize === option.value}
                  onPress={() => setDraft((prev) => ({ ...prev, vehicleSize: option.value }))}
                  trailing={
                    <Image
                      source={option.image}
                      style={styles.vehicleArtImage}
                      resizeMode="contain"
                    />
                  }
                />
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>

      <FlowFooter
        current={3}
        onBack={() => (fromReview ? navigation.navigate("ListingReview") : navigation.goBack())}
        primaryLabel={fromReview ? "Save changes" : "Continue"}
        onPrimary={() => navigation.navigate(fromReview ? "ListingReview" : "ListingFeatures")}
        primaryDisabled={!canContinue}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // No inset of its own — the 24px gutter belongs to the step's content.
  gridWrap: { paddingTop: 10 },
  typeNote: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 15,
    lineHeight: 21,
    color: hostFlowColors.textMuted,
    marginTop: 12,
  },

  counterRowWrap: { flexDirection: "row", alignItems: "center", gap: 16 },
  counterCopy: { flex: 1, minWidth: 0 },
  counterControls: {
    flexDirection: "row", alignItems: "center", gap: 14,
    flexShrink: 0, paddingRight: 24,
  },
  // 38px circles: outlined grey when it steps down, ink when it steps up.
  counterButton: {
    width: 38, height: 38, borderRadius: 999,
    borderWidth: 1, borderColor: hostFlowColors.border,
    alignItems: "center", justifyContent: "center",
  },
  counterButtonActive: { borderColor: hostFlowColors.text },
  counterButtonDisabled: { opacity: 0.4 },
  counterValueText: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 17,
    color: hostFlowColors.text, minWidth: 16, textAlign: "center",
  },

  vehicleList: { paddingTop: 8, gap: 12 },
  vehicleArtImage: { width: 64, height: 40, flexShrink: 0 },
  summaryWrap: { paddingTop: 10 },

  container: {
    backgroundColor: hostFlowColors.bg,
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 28,
    gap: 14,
  },
});
