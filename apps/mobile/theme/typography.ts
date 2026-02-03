import { Platform } from "react-native";
import { colors } from "./colors";

// Inter font family for both iOS and Android
// Note: Currently using system fonts as fallback
// - iOS: San Francisco (similar to Inter)
// - Android: Roboto (similar to Inter)
// To use custom Inter fonts, add font files to assets/fonts/ and load with expo-font
const fontFamily = {
  regular: Platform.select({
    ios: "System",
    android: "System",
    default: "System",
  }),
  medium: Platform.select({
    ios: "System",
    android: "System",
    default: "System",
  }),
  semiBold: Platform.select({
    ios: "System",
    android: "System",
    default: "System",
  }),
};

export const typography = {
  // Page headers / Screen titles - bold and prominent
  display: {
    fontFamily: fontFamily.semiBold,
    fontSize: 32,
    fontWeight: "800" as const,
    lineHeight: 38,
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  h1: {
    fontFamily: fontFamily.semiBold,
    fontSize: 28,
    fontWeight: "800" as const,
    lineHeight: 34,
    color: colors.text.primary,
    letterSpacing: -0.4,
  },
  h2: {
    fontFamily: fontFamily.semiBold,
    fontSize: 20,
    fontWeight: "700" as const,
    lineHeight: 26,
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  h3: {
    fontFamily: fontFamily.semiBold,
    fontSize: 18,
    fontWeight: "700" as const,
    lineHeight: 24,
    color: colors.text.primary,
    letterSpacing: -0.1,
  },
  h4: {
    fontFamily: fontFamily.semiBold,
    fontSize: 16,
    fontWeight: "700" as const,
    lineHeight: 22,
    color: colors.text.primary,
  },
  // Body text - larger and more readable
  body: {
    fontFamily: fontFamily.regular,
    fontSize: 15,
    fontWeight: "400" as const,
    lineHeight: 22,
    color: colors.text.primary,
  },
  bodyMedium: {
    fontFamily: fontFamily.medium,
    fontSize: 15,
    fontWeight: "500" as const,
    lineHeight: 22,
    color: colors.text.primary,
  },
  bodySmall: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    fontWeight: "400" as const,
    lineHeight: 20,
    color: colors.text.secondary,
  },
  // CTAs and primary actions - bolder
  button: {
    fontFamily: fontFamily.semiBold,
    fontSize: 16,
    fontWeight: "600" as const,
    lineHeight: 24,
    letterSpacing: 0,
  },
  buttonSmall: {
    fontFamily: fontFamily.semiBold,
    fontSize: 14,
    fontWeight: "600" as const,
    lineHeight: 20,
    letterSpacing: 0,
  },
  // Tab labels - slightly bolder
  tabLabel: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    fontWeight: "600" as const,
    lineHeight: 16,
    letterSpacing: 0,
  },
  // Supporting text
  caption: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    fontWeight: "400" as const,
    lineHeight: 16,
    color: colors.text.tertiary,
  },
  // Labels - bolder for better visibility
  label: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    fontWeight: "600" as const,
    lineHeight: 18,
    letterSpacing: 0.5,
    color: colors.text.secondary,
  },
};
