import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text } from "react-native";

type ToastProps = {
  message: string;
  variant?: "success" | "info" | "danger";
  visible: boolean;
};

const variantStyles = {
  success: { backgroundColor: "#16a34a" },
  info: { backgroundColor: "#2563eb" },
  danger: { backgroundColor: "#b42318" },
} as const;

export function Toast({ message, variant = "success", visible }: ToastProps) {
  const translateY = useRef(new Animated.Value(-24)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, opacity, translateY]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        variantStyles[variant],
        { opacity, transform: [{ translateY }] },
      ]}
    >
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
    position: "absolute",
    top: 18,
    left: 16,
    right: 16,
    zIndex: 50,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 4,
  },
  text: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
});
