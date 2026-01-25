import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop } from "react-native-svg";

type MapPricePinProps = {
  price: number;
  selected?: boolean;
  soldOut?: boolean;
};

export function MapPricePin({ price, selected = false, soldOut = false }: MapPricePinProps) {
  const priceText = soldOut ? "Sold out" : `€${price}`;
  
  // Airbnb-style: larger pins when selected for better visibility
  const scale = 1;
  
  const dimensions = useMemo(() => {
    const textLength = priceText.length;
    const baseWidth = soldOut ? 56 : 46;
    const extraWidth = soldOut ? 0 : Math.max(0, (textLength - 3) * 7);
    const width = Math.max(baseWidth, baseWidth + extraWidth);
    const bubbleHeight = soldOut ? 22 : 26;
    const tailHeight = soldOut ? 5 : 6;
    const totalHeight = bubbleHeight + tailHeight;
    const tailWidth = soldOut ? 8 : 10;
    
    return { width, bubbleHeight, tailHeight, totalHeight, tailWidth };
  }, [priceText, soldOut]);

  const { width, bubbleHeight, tailHeight, totalHeight, tailWidth } = dimensions;
  const strokeWidth = 1.5;
  const radius = bubbleHeight / 2;
  const padding = strokeWidth;

  const pinPath = useMemo(() => {
    const w = width;
    const h = bubbleHeight;
    const r = radius;
    const tw = tailWidth / 2;
    const th = tailHeight;
    const cx = w / 2;
    const p = padding;

    return `
      M ${r + p} ${p}
      L ${w - r + p} ${p}
      A ${r} ${r} 0 0 1 ${w + p} ${r + p}
      A ${r} ${r} 0 0 1 ${w - r + p} ${h + p}
      L ${cx + tw + p} ${h + p}
      L ${cx + p} ${h + th + p}
      L ${cx - tw + p} ${h + p}
      L ${r + p} ${h + p}
      A ${r} ${r} 0 0 1 ${p} ${r + p}
      A ${r} ${r} 0 0 1 ${r + p} ${p}
      Z
    `.trim();
  }, [width, bubbleHeight, tailHeight, tailWidth, radius, padding]);

  const viewBoxWidth = width + padding * 2;
  const viewBoxHeight = totalHeight + padding * 2;

  return (
    <View style={[styles.container, { width: viewBoxWidth * scale, height: viewBoxHeight * scale }]}>
      <Svg
        width={viewBoxWidth * scale}
        height={viewBoxHeight * scale}
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      >
        <Path
          d={pinPath}
          fill={soldOut ? "#f1f5f9" : selected ? "#000000" : "#FFFFFF"}
          stroke="rgba(0,0,0,0.16)"
          strokeWidth={1.25}
          strokeLinejoin="round"
        />
      </Svg>
      
      <View style={styles.textContainer} pointerEvents="none">
        <Text style={[styles.priceText, soldOut && styles.priceTextSoldOut, selected && !soldOut && styles.priceTextSelected]}>
          {priceText}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "flex-start",
    // Airbnb-style: add drop shadow for better depth perception
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  textContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  priceText: {
    color: "#000000",
    fontSize: 13,
    fontWeight: "600",
  },
  priceTextSelected: {
    color: "#FFFFFF",
  },
  priceTextSoldOut: {
    color: "#94a3b8",
    fontSize: 10,
  },
});
