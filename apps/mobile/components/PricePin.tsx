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
            fill={selected ? "#10b981" : "#ffffff"}
            stroke={selected ? "#059669" : "#10b981"}
            strokeWidth={1.5}
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
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#10b981",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  bubbleSelected: {
    backgroundColor: "#10b981",
    borderColor: "#059669",
  },
  priceText: {
    color: "#047857",
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
