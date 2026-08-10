import { useEffect, useRef } from "react";
import { Animated, ViewStyle } from "react-native";
import { colors } from "../../styles/theme";

interface Props {
  width?: number | `${number}%`;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
  pulse: Animated.Value;
  /**
   * The fill. Defaults to the original palette's skeleton grey; screens on the
   * `page*` set pass theirs, so a skeleton never drags the old tokens onto a
   * surface built from the new ones. Shape stays neutral either way, which is
   * what lets this stay a shared primitive rather than forking per system.
   */
  color?: string;
}

export function SkeletonBlock({
  width,
  height,
  borderRadius = 6,
  style,
  pulse,
  color = colors.skeletonBg,
}: Props) {
  return (
    <Animated.View
      style={[{ width, height, borderRadius, backgroundColor: color, opacity: pulse }, style]}
    />
  );
}

export function usePulse() {
  const pulse = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 750, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);
  return pulse;
}
