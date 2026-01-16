export const colors = {
  appBg: "#f5f7fb",
  cardBg: "#ffffff",
  text: "#0f172a",
  textMuted: "#6b7280",
  textSoft: "#94a3b8",
  border: "#e5e7eb",
  accent: "#00d4aa",
  danger: "#dc2626",
};

export const spacing = {
  screenX: 20,
  screenY: 16,
  card: 18,
  gap: 12,
};

export const radius = {
  card: 18,
  pill: 999,
};

export const cardShadow = {
  shadowColor: "#0f172a",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.12,
  shadowRadius: 12,
  elevation: 2,
};

export const textStyles = {
  kicker: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase" as const,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
  },
};
