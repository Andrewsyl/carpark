export const colors = {
  appBg: "#f5f7fb",
  cardBg: "#ffffff",
  headerTint: "#ecfdf3",
  overlayLight: "rgba(255, 255, 255, 0.95)",
  text: "#0f172a",
  textDisabled: "#D1D5DB",
  textMuted: "#6b7280",
  textSoft: "#94a3b8",
  border: "#e5e7eb",
  accent: "#00d4aa",
  danger: "#dc2626",
  status: {
    active: { background: "#ede9fe", border: "#a855f7", text: "#6b21a8" },
    canceled: { background: "#fee2e2", border: "#ef4444", text: "#991b1b" },
    completed: { background: "#f3f4f6", border: "#6b7280", text: "#6b7280" },
    confirmed: { background: "#ecfdf5", border: "#10b981", text: "#047857" },
    pending: { background: "#fef3c7", border: "#f59e0b", text: "#b45309" },
    refunded: { background: "#dbeafe", border: "#3b82f6", text: "#1e40af" },
  },
  star: {
    active: "#111827",
    inactive: "#D1D5DB",
  },
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
    fontWeight: "500" as const,
    letterSpacing: 0,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "600" as const,
    letterSpacing: -0.3,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "400" as const,
  },
};
