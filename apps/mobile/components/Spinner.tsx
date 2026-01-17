import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../styles/theme";

interface SpinnerProps {
  size?: "small" | "medium" | "large";
  color?: string;
  label?: string;
  center?: boolean;
}

export function Spinner({
  size = "medium",
  color = colors.accent,
  label,
  center = false,
}: SpinnerProps) {
  const spinnerSize = size === "small" ? "small" : "large";
  const customSize = size === "medium" ? 32 : size === "large" ? 48 : undefined;

  const containerStyle = center ? styles.centerContainer : styles.container;

  return (
    <View style={containerStyle}>
      {customSize ? (
        <View style={{ width: customSize, height: customSize }}>
          <ActivityIndicator size={spinnerSize} color={color} />
        </View>
      ) : (
        <ActivityIndicator size={spinnerSize} color={color} />
      )}
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 8,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textMuted,
    marginTop: 4,
  },
});
