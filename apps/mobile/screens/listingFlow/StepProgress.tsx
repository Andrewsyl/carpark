import { StyleSheet, Text, View } from "react-native";
import { colors, radius } from "../../styles/theme";

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
      <View style={styles.row}>
        <Text style={styles.label}>Step {current} of {total}</Text>
        <Text style={styles.percent}>{percent}%</Text>
      </View>
      <View style={styles.bar}>
        <View style={[styles.barFill, { width: `${percent}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.6,
  },
  percent: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: "600",
  },
  bar: {
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    height: 4,
    marginTop: 8,
    overflow: "hidden",
  },
  barFill: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    height: "100%",
  },
});
