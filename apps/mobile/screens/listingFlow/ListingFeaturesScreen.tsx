import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ScrollView, StyleSheet } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Accessibility,
  ArrowUpDown,
  BatteryCharging,
  Bike,
  Cctv,
  Clock,
  Fence,
  Lightbulb,
  Lock,
  Maximize2,
  Warehouse,
  type LucideIcon,
} from "lucide-react-native";
import { FlowHeader } from "./FlowHeader";
import { ChoicePill, ChoicePillGroup } from "./ChoiceTile";
import { StepQuestion, StepSection } from "./StepQuestion";
import { useListingFlow } from "./context";
import { hostFlowColors } from "./hostFlowTheme";
import { FlowFooter } from "./FlowFooter";

type FlowStackParamList = {
  ListingFeatures: { fromReview?: boolean } | undefined;
  ListingAccess: undefined;
  ListingReview: undefined;
};

type Props = NativeStackScreenProps<FlowStackParamList, "ListingFeatures">;

// No card shadow: the system separates with a rule and white space.

/** The glyph itself, not a rendered element: ChoiceTile owns its size and stroke. */
function featureIcon(name: string): LucideIcon {
  switch (name) {
    case "CCTV":               return Cctv;
    case "EV charging":        return BatteryCharging;
    case "Sheltered":          return Warehouse;
    case "Well lit":           return Lightbulb;
    case "Gated access":       return Fence;
    case "Single entry":       return Lock;
    case "Height-friendly":
    case "Height restricted":  return ArrowUpDown;
    case "Disabled access":    return Accessibility;
    case "24/7 access":        return Clock;
    case "Motorbike friendly": return Bike;
    case "Wide bay":           return Maximize2;
    default:                   return Warehouse;
  }
}

// One list, all of it on screen. These were split into five "favourites" behind
// a "More features" button, which hid six real options behind a tap on a step
// whose whole job is telling drivers what the space has.
const FEATURES = [
  "CCTV",
  "EV charging",
  "Sheltered",
  "Well lit",
  "Gated access",
  "Single entry",
  "Height restricted",
  "Disabled access",
  "24/7 access",
  "Motorbike friendly",
  "Wide bay",
];

export function ListingFeaturesScreen({ navigation, route }: Props) {
  const { draft, setDraft } = useListingFlow();
  const fromReview = route.params?.fromReview ?? false;
  const insets = useSafeAreaInsets();

  const toggleFeature = (option: string) => {
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

  const exitFlow = () => {
    const parent = navigation.getParent();
    if (parent?.canGoBack()) parent.goBack();
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <FlowHeader current={4} onClose={exitFlow} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 104 + Math.max(insets.bottom, 0) }]}
        showsVerticalScrollIndicator={false}
      >
        <StepQuestion
          title="Tell drivers what your space has to offer"
          hint="You can add more features after you publish your listing."
        />

        <StepSection title="Select everything your space has" />

        <ChoicePillGroup>
          {FEATURES.map((option) => (
            <ChoicePill
              key={option}
              icon={featureIcon(option)}
              label={option}
              selected={draft.accessOptions.includes(option)}
              onPress={() => toggleFeature(option)}
            />
          ))}
        </ChoicePillGroup>
      </ScrollView>

      <FlowFooter
        current={4}
        onBack={() => (fromReview ? navigation.navigate("ListingReview") : navigation.goBack())}
        primaryLabel={fromReview ? "Save changes" : "Continue"}
        onPrimary={() => navigation.navigate(fromReview ? "ListingReview" : "ListingAccess")}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: hostFlowColors.bg },

  content: {
    paddingHorizontal: 24,
    paddingTop: 28,
    gap: 14,
  },
});
