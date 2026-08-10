import { StyleSheet, Text, View } from "react-native";
import { radius } from "../../styles/theme";
import { hostFlowColors } from "./hostFlowTheme";

type Props = {
  current: number;
  total: number;
};

export function StepProgress({ current, total }: Props) {
  const safeTotal = total > 0 ? total : 1;
  const progress = Math.min(Math.max(current / safeTotal, 0), 1);
  const percent = Math.round(progress * 100);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Step {current} of {total}</Text>
      <View style={styles.bar}>
        <View style={[styles.barFill, { width: `${percent}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 6,
  },
  label: {
    color: hostFlowColors.textSoft,
    fontSize: 13,
    fontFamily: "PlusJakartaSans-SemiBold",
    letterSpacing: 0.2,
    marginBottom: 6,
  },
  bar: {
    backgroundColor: hostFlowColors.border,
    borderRadius: radius.pill,
    height: 4,
    overflow: "hidden",
  },
  barFill: {
    backgroundColor: hostFlowColors.accent,
    borderRadius: radius.pill,
    height: "100%",
  },
});
