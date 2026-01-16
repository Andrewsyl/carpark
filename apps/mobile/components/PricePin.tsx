import { StyleSheet, Text, View } from "react-native";
import Svg, { Polygon } from "react-native-svg";

export function PricePin({ label, selected }: { label?: string; selected?: boolean }) {
  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.hitArea} />
      <View style={styles.pinWrapper}>
        <View style={[styles.bubbleBase, styles.bubble, selected && styles.bubbleSelected]}>
          <Text style={[styles.priceText, selected && styles.priceTextSelected]}>
            {label ?? ""}
          </Text>
        </View>
        <Svg height={8} width={14} style={styles.tail}>
          <Polygon
            points="0,0 7,8 14,0"
            fill={selected ? "#111827" : "#ffffff"}
            stroke={selected ? "#111827" : "#e5e7eb"}
            strokeWidth={1}
          />
        </Svg>
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
    position: "absolute",
    width: 64,
    height: 64,
    top: -16,
    left: -16,
    zIndex: -1,
  },
  pinWrapper: {
    alignItems: "center",
  },
  bubbleBase: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 50,
  },
  bubble: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  bubbleSelected: {
    backgroundColor: "#111827",
    borderColor: "#000000",
    borderWidth: 2,
  },
  priceText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "700",
  },
  priceTextSelected: {
    color: "#ffffff",
  },
  tail: {
    marginTop: -2,
  },
});
