import { StyleSheet, Text, View } from "react-native";

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
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  percent: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "700",
  },
  bar: {
    backgroundColor: "#e2e8f0",
    borderRadius: 999,
    height: 6,
    marginTop: 8,
    overflow: "hidden",
  },
  barFill: {
    backgroundColor: "#2fa84f",
    borderRadius: 999,
    height: "100%",
  },
});
