import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { useEffect, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { hostFlowColors } from "./hostFlowTheme";
import { colors } from "../../styles/theme";

/**
 * 16a splits the wizard into three phase segments rather than one bar per
 * step. Nine steps divide evenly: place, access, publish.
 */
const PHASES = 3;

type Props = {
  onBack: () => void;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  skipLabel?: string;
  onSkip?: () => void;
  /** Omit both to render the footer without progress above it. */
  current?: number;
  total?: number;
};

/**
 * One phase segment. 16a draws these filled or empty, but a static mock can't
 * show the in-between: filling proportionally within the phase means each of
 * the three steps inside it still moves something.
 */
function PhaseSegment({ fraction }: { fraction: number }) {
  const anim = useRef(new Animated.Value(fraction)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: fraction,
      duration: 240,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [anim, fraction]);

  const width = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={styles.segment}>
      <Animated.View style={[styles.segmentFill, { width }]} />
    </View>
  );
}

export function FlowFooter({
  onBack,
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  skipLabel,
  onSkip,
  current,
  total,
}: Props) {
  const insets = useSafeAreaInsets();
  const showProgress = typeof current === "number" && typeof total === "number" && total > 0;
  const perPhase = showProgress ? total / PHASES : 1;

  return (
    <View style={styles.wrap}>
      {showProgress ? (
        <View style={styles.progress}>
          {Array.from({ length: PHASES }, (_, i) => (
            <PhaseSegment
              key={i}
              fraction={Math.min(Math.max((current - i * perPhase) / perPhase, 0), 1)}
            />
          ))}
        </View>
      ) : null}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 8, 20) }]}>
        {skipLabel && onSkip ? (
          <Pressable style={styles.skipButton} onPress={onSkip}>
            <Text style={styles.skipButtonText}>{skipLabel}</Text>
          </Pressable>
        ) : null}
        <View style={styles.row}>
          {/* Back is an underlined word, not a button: it is the lesser of the
              two actions and should not compete with Next for weight. */}
          <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button">
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Pressable
            style={[styles.primaryButton, primaryDisabled && styles.primaryButtonDisabled]}
            onPress={onPrimary}
            disabled={primaryDisabled}
            accessibilityRole="button"
          >
            <Text style={[styles.primaryButtonText, primaryDisabled && styles.primaryButtonTextDisabled]}>
              {primaryLabel}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: hostFlowColors.cardBg },
  // Full-bleed, hard against the footer: in 16a the segments ARE the divider,
  // which is why the footer no longer carries a top rule.
  progress: {
    flexDirection: "row",
    gap: 4,
  },
  segment: {
    flex: 1,
    height: 3,
    borderRadius: 999,
    backgroundColor: hostFlowColors.border,
    overflow: "hidden",
  },
  // Ink, not green. Green is the forward action, so progress reads as
  // measurement rather than another call to act.
  segmentFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: hostFlowColors.text,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  backText: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 17,
    color: hostFlowColors.text,
    textDecorationLine: "underline",
  },

  // A dark rounded rect, not a green pill: 16a reserves the pill shape for the
  // header's escape hatches, so the forward action takes the squarer form.
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    borderRadius: 12,
    backgroundColor: hostFlowColors.text,
    paddingHorizontal: 32,
  },
  // Disabled is a different fill, not a dimmed one: opacity on ink read as a
  // grey button that still looked pressable.
  primaryButtonDisabled: { backgroundColor: hostFlowColors.disabledBg },
  primaryButtonText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 17,
    color: colors.textInverse,
  },
  primaryButtonTextDisabled: { color: hostFlowColors.disabledText },
  skipButton: {
    alignItems: "center",
    paddingVertical: 8,
  },
  skipButtonText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    color: hostFlowColors.textMuted,
  },
});
