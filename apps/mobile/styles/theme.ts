import { Dimensions } from "react-native";
import { mobileDesignTokens as designTokens } from "../designTokens";

const color = designTokens.color;
const type = designTokens.typography;

// The listing/checkout design was drawn on a 390pt frame (iPhone 14–17 Pro).
// Display-sized type — page titles, prices, totals, the time-control numerals —
// is derived from the real screen width so a narrower device gets the same
// *proportions* the mock shows rather than the same absolute points. On a 360dp
// Android phone the 30pt title lands at 28, which is the difference between a
// two-line and a three-line title block.
//
// Deliberately capped at 1: this shrinks to fit small screens, it never inflates
// type on large ones. Body, label and row steps are NOT scaled — they are already
// at the readable floor, and shrinking them would cost legibility for no layout
// gain. Safe to read once at module load because the app is portrait-locked
// (app.json `orientation: "portrait"`); if that ever changes this must move into
// a hook backed by useWindowDimensions.
const DESIGN_FRAME_WIDTH = 390;
export const displayScale = Math.min(1, Dimensions.get("window").width / DESIGN_FRAME_WIDTH);
export const scaleDisplay = (size: number) => Math.round(size * displayScale);

export const colors = {
  appBg: color.surface.app,
  cardBg: color.surface.card,
  cardBgMuted: color.surface.muted,
  headerTint: color.brand[700],
  overlayLight: color.surface.overlayLight,
  text: color.text.primary,
  textDisabled: color.text.disabled,
  textInverse: color.text.inverse,
  textMuted: color.text.secondary,
  textSoft: color.text.soft,
  border: color.border.default,
  borderStrong: color.border.strong,
  // ── The system's three rules, lightest first ──────────────────────────────
  // `hairline` (#EDF0F0) separates rows inside a tile.
  // `divider`  (#DDE2E2) is the tile edge and the masthead's closing rule.
  // `border`   (#C7CFCF) is a control outline — inputs, not surfaces.
  hairline: color.border.hairline,
  divider: color.border.subtle,
  // Deprecated alias: `divider` is now the tile edge, so these are the same
  // colour. Kept so unconverted screens keep compiling; remove per wave.
  borderHairline: color.border.subtle,
  // Icon glyphs in a fact row's gutter.
  iconGrey: "#8A9292",
  heroDark: color.surface.heroDark,
  skeletonBg: color.surface.skeleton,
  // Every shadow in the app casts from the same near-black.
  shadow: color.text.primary,
  // Reviewer avatar fills, picked by initial. Decorative by design — the only
  // place the system allows colour that isn't the one green.
  avatarFills: ["#CCE9E6", "#FFE4C8", "#D8E4FF", "#FFD6D6", "#D6F5E3"],
  accent: color.brand[500],
  accentSoft: color.brand[50],
  // Soft-green tile ground (amenity/category tiles, chip fills) — a notch
  // more visible than `accentSoft`, distinct token per designTokens'
  // `surface.accent`.
  tileBg: color.surface.accent,
  // The green actually used for primary CTAs/live-status across the app
  // (brand[600], #0a8050) — distinct from `accent` (brand[500]), which is a
  // lighter tone used for secondary-button outlines/spinners.
  primary: color.brand[600],
  // The ground everything below a masthead sits on. Same value as `ground`;
  // both names are kept because screens reach for one or the other, and the
  // system has only one page tint.
  pageBg: "#F2F5F4",
  // Sub-lines under a section header, and meta beneath a fact.
  textTertiary: color.text.tertiary,
  // The listing/checkout "ground" — one step darker than `pageBg` so white
  // tiles read as lifted off it rather than dissolving into it. Also the
  // in-tile hairline colour, which is why it is its own token and not an
  // alias of `pageBg`.
  // #F2F5F4 per the funnel design — a touch cooler and darker than
  // neutral[100], so white tiles sitting on it read as raised.
  ground: "#F2F5F4",

  // ── Page surface — THE DIRECTION ────────────────────────────────────────
  // A colder, higher-contrast set than the tokens above, introduced with the
  // listing rebuild. This is where the app is going: new surfaces should reach
  // for `page*` and `components/ui/page`, not for `text`/`divider`/`ground`
  // and `Tile`/`Section`.
  //
  // The two sets coexist deliberately rather than being swapped in one go —
  // replacing the originals in place would restyle every screen at once, with
  // no way to look at any single one and say whether it is right. They collapse
  // to one set when the booking pair moves over, which is the last thing still
  // using the old layout kit.
  //
  // Until then: don't mix them within a screen. A surface is on one set or the
  // other, never both.
  pageInk: "#111111",
  pageMuted: "#6A6A6A",
  pageRule: "#E3E3E1",
  pagePill: "#F2F2F0",
  pageAccentSoft: "#E9F4EC",
  pageAccentDark: "#0E5538",
  pageMapGround: "#EBEDEB",
  // True black behind a fullscreen photo — not the page ink, which is lighter.
  viewerBackdrop: "#000000",
  // #F5F7F7 — the lighter tint used *inside* a tile (e.g. the duration strip
  // under the arrival/departure fields), so it separates from the card's white
  // without matching the page ground behind it.
  groundSoft: color.neutral[100],
  brandDark: color.brand[900],
  mint: color.mint[500],
  mintSoft: color.mint[100],
  danger: color.status.dangerStrong,
  warning: color.status.warning,
  status: {
    active: { background: color.brand[50], border: color.brand[700], text: color.brand[700] },
    canceled: { background: "#FEE2E2", border: "#EF4444", text: "#991B1B" },
    completed: { background: color.neutral[100], border: color.neutral[500], text: color.neutral[600] },
    confirmed: { background: color.brand[50], border: color.brand[700], text: color.brand[700] },
    pending: { background: "#FFF8BF", border: color.status.warning, text: "#5A3800" },
    refunded: { background: "#DBEAFE", border: color.status.info, text: "#1E40AF" },
  },
  star: {
    active: color.text.strong,
    inactive: color.rating.inactive,
    // Amber fill for interactive review stars (rate-your-stay moments); the
    // ink `active` is for static rating displays.
    review: color.rating.active,
  },
};

export const spacing = {
  xxs: 4,
  xs: designTokens.spacing.xs,
  sm: designTokens.spacing.sm,
  md: designTokens.spacing.md,
  lg: designTokens.spacing.lg,
  xl: designTokens.spacing.xl,
  xxl: designTokens.spacing.xxl,
  xxxl: designTokens.spacing.xxxl,
  screenX: designTokens.layout.screenX,
  screenY: designTokens.spacing.md,
  card: designTokens.layout.cardPadding,
  gap: designTokens.spacing.sm,
  readingInset: designTokens.layout.readingInset,
  section: designTokens.spacing.section,
  hero: designTokens.spacing.hero,
};

export const radius = {
  sm: designTokens.radius.sm,
  md: designTokens.radius.md,
  // Small/medium cards (list rows, map card, review tiles) — see
  // docs/PARKING_DESIGN_BIBLE.md Part E2. `card` (24) is for hero surfaces.
  cardSmall: designTokens.radius.cardSmall,
  card: designTokens.radius.xl,
  lg: designTokens.radius.xxl,
  pill: designTokens.radius.pill,
  sheet: designTokens.radius.xxl,
};

export const cardShadow = {
  shadowColor: "#0f172a",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.09,
  shadowRadius: 12,
  elevation: 4,
};

export const floatingShadow = {
  shadowColor: "#000000",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.12,
  shadowRadius: 16,
  elevation: 6,
};

export const primaryButtonShadow = {
  shadowColor: "#0a7a50",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.28,
  shadowRadius: 14,
  elevation: 5,
};

export const textStyles = {
  // ── The system's six steps ────────────────────────────────────────────────
  // Everything on a converted screen uses one of these. If a screen needs a
  // size that isn't here, the size goes here first — that is the rule that
  // keeps the set from growing back into per-screen values.
  dsTitle: {
    color: colors.text,
    fontSize: 30,
    lineHeight: 33,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontWeight: "800" as const,
    letterSpacing: -1.2,
  },
  dsSection: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 27,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontWeight: "800" as const,
    letterSpacing: -0.8,
  },
  // The single line in a fact row.
  dsFact: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontFamily: "PlusJakartaSans-Regular",
    fontWeight: "400" as const,
  },
  // Inline green actions — "Change", "View", "See all".
  dsAction: {
    color: colors.primary,
    fontSize: 15,
    lineHeight: 20,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "600" as const,
  },
  dsBody: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "PlusJakartaSans-Regular",
    fontWeight: "400" as const,
  },
  dsMeta: {
    color: colors.textTertiary,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "PlusJakartaSans-Regular",
    fontWeight: "400" as const,
  },

  displayHero: {
    color: colors.brandDark,
    fontSize: 46,
    lineHeight: 52,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontWeight: "900" as const,
    letterSpacing: -1.2,
    textTransform: "uppercase" as const,
  },
  screenTitle: {
    color: colors.text,
    fontSize: 26,
    lineHeight: 31,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontWeight: "800" as const,
    letterSpacing: -0.6,
  },
  kicker: {
    color: colors.accent,
    fontSize: 15,
    lineHeight: 20,
    fontFamily: "PlusJakartaSans-Bold",
    fontWeight: "700" as const,
    letterSpacing: 0.2,
  },
  title: {
    color: colors.text,
    fontSize: 25,
    lineHeight: 31,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontWeight: "800" as const,
    letterSpacing: -0.4,
  },
  titleSmall: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 27,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontWeight: "800" as const,
    letterSpacing: -0.2,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 25,
    lineHeight: 31,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontWeight: "800" as const,
    letterSpacing: -0.4,
  },
  sectionIntro: {
    color: colors.textMuted,
    fontSize: 17,
    lineHeight: 24,
    fontFamily: "PlusJakartaSans-Regular",
    fontWeight: "400" as const,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 17,
    lineHeight: 24,
    fontFamily: "PlusJakartaSans-Regular",
    fontWeight: "400" as const,
  },
  bodyLarge: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 28,
    fontFamily: "PlusJakartaSans-Regular",
    fontWeight: "400" as const,
  },
  body: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 24,
    fontFamily: "PlusJakartaSans-Regular",
    fontWeight: "400" as const,
  },
  bodyStrong: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 24,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "600" as const,
  },
  bodyMedium: {
    color: colors.textMuted,
    fontSize: 17,
    lineHeight: 24,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "600" as const,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 19,
    fontFamily: "PlusJakartaSans-Medium",
    fontWeight: "500" as const,
    letterSpacing: 0.2,
  },
  label: {
    color: colors.textSoft,
    fontSize: 15,
    lineHeight: 20,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "700" as const,
    letterSpacing: 0.7,
  },
  tabLabel: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 18,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "600" as const,
  },
  button: {
    color: color.text.inverse,
    fontSize: 16,
    lineHeight: 22,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "600" as const,
    letterSpacing: -0.3,
  },
  priceLarge: {
    color: colors.text,
    fontSize: 52,
    lineHeight: 58,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontWeight: "900" as const,
    letterSpacing: -1.5,
  },
  // Card/list price — deliberately louder than a card title (see
  // docs/PARKING_DESIGN_BIBLE.md A6): price is the decision, not a peer fact.
  priceCard: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 32,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontWeight: "900" as const,
    letterSpacing: -0.8,
  },
};

export const surfaces = {
  screen: {
    backgroundColor: colors.appBg,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.card,
    ...cardShadow,
  },
  cardMuted: {
    backgroundColor: colors.cardBgMuted,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.card,
  },
  sheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderColor: colors.border,
    borderWidth: 1,
    ...cardShadow,
  },
};

export const fields = {
  container: {
    marginBottom: spacing.md,
  },
  label: {
    color: colors.textSoft,
    fontSize: 15,
    lineHeight: 20,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "600" as const,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: "transparent",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 56,
    paddingHorizontal: 0,
    paddingVertical: 14,
  },
  inputNeutral: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inputFocused: {
    borderBottomColor: colors.accent,
  },
  inputError: {
    borderBottomColor: colors.danger,
  },
  inputText: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 24,
    fontFamily: "PlusJakartaSans-Regular",
    fontWeight: "400" as const,
  },
  inputNeutralText: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 24,
    fontFamily: "PlusJakartaSans-Regular",
    fontWeight: "400" as const,
  },
  placeholderTextColor: colors.textMuted,
  helpText: {
    ...textStyles.meta,
    color: colors.textMuted,
    marginTop: spacing.xxs,
  },
  errorText: {
    ...textStyles.meta,
    color: colors.danger,
    marginTop: spacing.xxs,
  },
};

export const buttons = {
  primary: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 52,
    paddingHorizontal: spacing.xl,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  secondary: {
    backgroundColor: color.neutral[100],
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 48,
    paddingHorizontal: spacing.xl,
    paddingVertical: 11,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  ghost: {
    borderRadius: 14,
    minHeight: 46,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
};
