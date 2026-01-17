import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import LottieView from "lottie-react-native";
import { colors, spacing } from "../styles/theme";

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

export function LoadingOverlay({ visible, message = "Loading..." }: LoadingOverlayProps) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.ease) });
      scale.value = withSequence(
        withTiming(1.05, { duration: 200, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 150, easing: Easing.inOut(Easing.ease) })
      );
    } else {
      opacity.value = withTiming(0, { duration: 150, easing: Easing.in(Easing.ease) });
      scale.value = withTiming(0.8, { duration: 150, easing: Easing.in(Easing.ease) });
    }
  }, [visible]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (!visible && opacity.value === 0) return null;

  return (
    <Animated.View style={[styles.overlay, overlayStyle]} pointerEvents={visible ? "auto" : "none"}>
      <Animated.View style={[styles.content, contentStyle]}>
        <View style={styles.animationContainer}>
          <LottieView
            source={require("../assets/Insider-loading.json")}
            autoPlay
            loop
            style={styles.lottie}
          />
        </View>
        <Text style={styles.message}>{message}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  content: {
    alignItems: "center",
    justifyContent: "center",
  },
  animationContainer: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  lottie: {
    width: 120,
    height: 120,
  },
  message: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    marginTop: 12,
    textAlign: "center",
  },
});
