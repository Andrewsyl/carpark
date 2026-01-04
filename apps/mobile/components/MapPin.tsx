import { StyleSheet, Text, View } from "react-native";

export function MapPin({
  label,
  selected = false,
  onLayout,
}: {
  label?: string;
  selected?: boolean;
  onLayout?: () => void;
}) {
  return (
    <View style={styles.container} pointerEvents="box-none" onLayout={onLayout}>
      <View style={styles.hitArea} pointerEvents="none" />
      <View style={styles.pinWrapper} pointerEvents="none">
        <View style={[styles.pinCircle, selected && styles.pinCircleActive, selected && styles.pinCircleSelected]}>
          {label ? (
            <Text style={[styles.pinLabel, selected && styles.pinLabelActive]}>{label}</Text>
          ) : null}
        </View>
        <View style={[styles.pinTail, selected && styles.pinTailActive]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    position: "relative",
  },
  hitArea: {
    height: 60,
    left: -12,
    position: "absolute",
    top: -12,
    width: 60,
  },
  pinWrapper: {
    alignItems: "center",
  },
  pinCircle: {
    alignItems: "center",
    backgroundColor: "#ff385c",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 4,
  },
  pinCircleActive: {
    backgroundColor: "#0f172a",
  },
  pinCircleSelected: {
    transform: [{ scale: 1.05 }],
  },
  pinLabel: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  pinLabelActive: {
    color: "#ffffff",
  },
  pinTail: {
    borderLeftColor: "transparent",
    borderLeftWidth: 8,
    borderRightColor: "transparent",
    borderRightWidth: 8,
    borderTopColor: "#ff385c",
    borderTopWidth: 12,
    height: 0,
    marginTop: -4,
    width: 0,
  },
  pinTailActive: {
    borderTopColor: "#0f172a",
  },
});
