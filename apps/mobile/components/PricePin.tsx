import { StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

const PIN_WIDTH = 52;
const PIN_HEIGHT = 52;
const LABEL_HEIGHT = 36;

export function PricePin({ label, selected = false }: { label?: string; selected?: boolean }) {
  const fill = selected ? "#0f172a" : "#ffffff";
  const stroke = "#0b0b0b";
  const textColor = selected ? "#ffffff" : "#0b0b0b";

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.hitArea} />
      <View style={styles.pinWrapper}>
        <Svg width={PIN_WIDTH} height={PIN_HEIGHT} viewBox="-6 -4 64 64" overflow="visible">
          <Path
            d="M26 0A18 18 0 0 1 44 18C44 26.464 38.274 33.535 30.49 35.676L26 48L21.51 35.676C13.726 33.535 8 26.464 8 18A18 18 0 0 1 26 0Z"
            fill="rgba(0, 0, 0, 0.18)"
            opacity={0.9}
            transform="translate(0 7) scale(1.06)"
          />
          <Path
            d="M26 0A18 18 0 0 1 44 18C44 26.464 38.274 33.535 30.49 35.676L26 48L21.51 35.676C13.726 33.535 8 26.464 8 18A18 18 0 0 1 26 0Z"
            fill="rgba(0, 0, 0, 0.3)"
            opacity={0.95}
            transform="translate(0 5) scale(1.02)"
          />
          <Path
            d="M26 0A18 18 0 0 1 44 18C44 26.464 38.274 33.535 30.49 35.676L26 48L21.51 35.676C13.726 33.535 8 26.464 8 18A18 18 0 0 1 26 0Z"
            fill={fill}
            stroke={stroke}
            strokeWidth={2}
          />
        </Svg>
        {label ? (
          <View style={styles.labelWrap}>
            <Text style={[styles.label, { color: textColor }]}>{label}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    position: "relative",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  hitArea: {
    position: "absolute",
    width: 60,
    height: 60,
    top: -12,
    left: -12,
    zIndex: -1,
  },
  pinWrapper: {
    alignItems: "center",
    justifyContent: "flex-start",
    width: PIN_WIDTH,
    height: PIN_HEIGHT,
  },
  labelWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: LABEL_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
  },
});
