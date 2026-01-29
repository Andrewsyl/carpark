import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSequence,
  Easing,
  withRepeat,
} from "react-native-reanimated";
import { colors } from "../styles/theme";

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

export function LoadingOverlay({ visible, message = "Loading..." }: LoadingOverlayProps) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.ease) });
      scale.value = withSequence(
        withTiming(1.05, { duration: 200, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 150, easing: Easing.inOut(Easing.ease) })
      );
      rotation.value = withRepeat(
        withTiming(1, { duration: 700, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      opacity.value = withTiming(0, { duration: 150, easing: Easing.in(Easing.ease) });
      scale.value = withTiming(0.8, { duration: 150, easing: Easing.in(Easing.ease) });
      rotation.value = 0;
    }
  }, [opacity, rotation, scale, visible]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.overlay, overlayStyle]} pointerEvents={visible ? "auto" : "none"}>
      <Animated.View style={[styles.content, contentStyle]}>
        <View style={styles.animationContainer}>
          <ActivityIndicator size="large" color={colors.textSoft} />
        </View>
        <Text style={styles.message}>{message}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  animationContainer: {
    alignItems: "center",
    height: 120,
    justifyContent: "center",
    width: 120,
  },
  content: {
    alignItems: "center",
    justifyContent: "center",
  },
  message: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
    marginTop: 12,
    textAlign: "center",
  },
  overlay: {
    alignItems: "center",
    backgroundColor: colors.overlayLight,
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 9999,
  },
});
