import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { borderRadius, colors, shadows, spacing } from "../../theme";

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  noPadding?: boolean;
  noShadow?: boolean;
}

export function Card({ children, style, noPadding = false, noShadow = false }: CardProps) {
  return (
    <View style={[styles.card, noPadding && styles.noPadding, noShadow && styles.noShadow, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    ...shadows.md,
  },
  noPadding: {
    padding: 0,
  },
  noShadow: {
    ...shadows.none,
  },
});
