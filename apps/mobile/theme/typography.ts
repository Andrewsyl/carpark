import { colors } from "./colors";

export const typography = {
  display: {
    fontSize: 32,
    fontWeight: "700" as const,
    lineHeight: 40,
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  h1: {
    fontSize: 28,
    fontWeight: "700" as const,
    lineHeight: 36,
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 24,
    fontWeight: "700" as const,
    lineHeight: 32,
    color: colors.text.primary,
  },
  h3: {
    fontSize: 20,
    fontWeight: "600" as const,
    lineHeight: 28,
    color: colors.text.primary,
  },
  h4: {
    fontSize: 18,
    fontWeight: "600" as const,
    lineHeight: 24,
    color: colors.text.primary,
  },
  body: {
    fontSize: 16,
    fontWeight: "400" as const,
    lineHeight: 24,
    color: colors.text.primary,
  },
  bodyMedium: {
    fontSize: 16,
    fontWeight: "500" as const,
    lineHeight: 24,
    color: colors.text.primary,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: "400" as const,
    lineHeight: 20,
    color: colors.text.secondary,
  },
  button: {
    fontSize: 16,
    fontWeight: "600" as const,
    lineHeight: 24,
    letterSpacing: 0.2,
  },
  caption: {
    fontSize: 12,
    fontWeight: "400" as const,
    lineHeight: 16,
    color: colors.text.tertiary,
  },
  label: {
    fontSize: 11,
    fontWeight: "600" as const,
    lineHeight: 16,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    color: colors.text.secondary,
  },
};
