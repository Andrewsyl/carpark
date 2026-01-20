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
  // Page headers / Screen titles - Inter SemiBold, tighter spacing
  display: {
    fontFamily: fontFamily.semiBold,
    fontSize: 28,
    fontWeight: "600" as const,
    lineHeight: 34,
    color: colors.text.primary,
    letterSpacing: -0.4,
  },
  h1: {
    fontFamily: fontFamily.semiBold,
    fontSize: 24,
    fontWeight: "600" as const,
    lineHeight: 30,
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  h2: {
    fontFamily: fontFamily.semiBold,
    fontSize: 20,
    fontWeight: "600" as const,
    lineHeight: 26,
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  h3: {
    fontFamily: fontFamily.semiBold,
    fontSize: 18,
    fontWeight: "600" as const,
    lineHeight: 24,
    color: colors.text.primary,
    letterSpacing: -0.1,
  },
  h4: {
    fontFamily: fontFamily.semiBold,
    fontSize: 16,
    fontWeight: "600" as const,
    lineHeight: 22,
    color: colors.text.primary,
  },
  // Body text - Inter Regular, high legibility
  body: {
    fontFamily: fontFamily.regular,
    fontSize: 16,
    fontWeight: "400" as const,
    lineHeight: 24,
    color: colors.text.primary,
  },
  bodyMedium: {
    fontFamily: fontFamily.medium,
    fontSize: 16,
    fontWeight: "500" as const,
    lineHeight: 24,
    color: colors.text.primary,
  },
  bodySmall: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    fontWeight: "400" as const,
    lineHeight: 20,
    color: colors.text.secondary,
  },
  // CTAs and primary actions - Inter SemiBold, no all-caps
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
  // Tab labels - Inter Medium, restrained contrast
  tabLabel: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    fontWeight: "500" as const,
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
  // Labels - reduced visual weight, no uppercase
  label: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    fontWeight: "500" as const,
    lineHeight: 16,
    letterSpacing: 0,
    color: colors.text.secondary,
  },
};
