/**
 * Design tokens, reverse-engineered from the listing screen.
 *
 * The listing screen is the source of truth. Where this file and that screen
 * disagree, the screen is right and this file is stale.
 *
 * Why these exist: an audit of all 26 screens found 21 distinct font sizes,
 * 26 radii, 31 spacing values and 18 hex literals. Not one of those numbers
 * was chosen — they accumulated. This file is the closed set that replaces
 * them: 6 sizes, 4 radii, 7 spacing steps, 7 colours.
 *
 * Rule: if a value is not in here, it does not belong in a screen. If a screen
 * genuinely needs one, add it here first so the next screen inherits it.
 */
import { Platform } from "react-native";

// ─────────────────────────────────────────────────────────────────────────────
// Colour
//
// Seven values. The listing screen's restraint is the point: ink and muted do
// almost all the work, and green is rationed to three jobs — an affordance you
// can tap, the rating, and an accent chip. A page with green in a fourth place
// has stopped following the system.
// ─────────────────────────────────────────────────────────────────────────────
export const palette = {
  /** Text, icons, the committing action. Near-black, never pure. */
  ink: "#111111",
  /** Supporting copy, meta, inactive icons. */
  muted: "#6A6A6A",
  /** The only divider in the system. */
  rule: "#E3E3E1",
  /** Grey buttons, chips, neutral status. */
  pill: "#F2F2F0",
  /** Tinted fields, accent chips, empty-state circles. */
  accentSoft: "#E9F4EC",
  /** Text on an accent tint — never on white, it fails contrast. */
  accentDark: "#0E5538",
  /** Affordances, rating, primary CTA. */
  accent: "#0a8050",
  /** Page ground. The listing is white throughout; there is no second ground. */
  surface: "#FFFFFF",
  /** Behind a fullscreen photo only. Not the page ink, which is lighter. */
  scrim: "#000000",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Typography
//
// Six steps. Weight and colour carry hierarchy, not size — the listing puts a
// label and its value at the same size and separates them by weight alone,
// which is what stops rows reading as heading-plus-caption.
//
// A seventh step is a signal the layout is wrong, not that the scale is short.
// ─────────────────────────────────────────────────────────────────────────────
export const font = {
  regular: "PlusJakartaSans-Regular",
  semibold: "PlusJakartaSans-SemiBold",
  bold: "PlusJakartaSans-Bold",
} as const;

export const type = {
  /** A screen's own title. One per screen. */
  title: { fontFamily: font.bold, fontSize: 32, lineHeight: 38, letterSpacing: -0.9 },
  /** A masthead title, sitting over or under media. */
  display: { fontFamily: font.semibold, fontSize: 26, lineHeight: 31, letterSpacing: -0.6 },
  /** Section heading. */
  section: { fontFamily: font.semibold, fontSize: 19, lineHeight: 24, letterSpacing: -0.3 },
  /** A row's label (bold) and its value (regular) — same size, different weight. */
  row: { fontFamily: font.regular, fontSize: 17, lineHeight: 24 },
  /** List labels and prose. */
  body: { fontFamily: font.regular, fontSize: 15, lineHeight: 22 },
  /** Timestamps, captions, supporting detail. */
  meta: { fontFamily: font.regular, fontSize: 13, lineHeight: 18 },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Spacing
//
// Seven steps on a 4pt grid. `gutter` is the page inset and is not negotiable
// per screen — a screen that insets at 20 while its neighbour insets at 24 is
// the single most visible inconsistency in an app.
// ─────────────────────────────────────────────────────────────────────────────
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 28,
} as const;

export const gutter = 24;

// ─────────────────────────────────────────────────────────────────────────────
// Radius
//
// By role, not by size. The question is never "how round?" but "what is this?",
// and that has one answer per role.
// ─────────────────────────────────────────────────────────────────────────────
export const radii = {
  /** Buttons, pills, chips. */
  control: 8,
  /** Inputs and tappable tinted fields. */
  field: 10,
  /** Cards, tiles, media frames. */
  surface: 12,
  /** Sheets and the top of a content sheet over media. */
  sheet: 20,
  /** Avatars, dots, the primary action. */
  round: 999,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Elevation
//
// The listing screen has NO shadows. Separation is done with a 1px rule and
// white space, and that restraint is most of why it reads as premium — drop
// shadows are the fastest way to make a screen look like a 2016 template.
//
// Two exceptions, both for things that float over content rather than sit in
// it. Nothing else gets elevation.
// ─────────────────────────────────────────────────────────────────────────────
export const elevation = {
  /** Default. Use a rule instead. */
  none: {},
  /** A control floating over a photo or map. */
  floating: Platform.select({
    ios: {
      shadowColor: palette.ink,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
    },
    android: { elevation: 3 },
    default: {},
  }),
  /** A bottom sheet or dock, lifting off the page it covers. */
  sheet: Platform.select({
    ios: {
      shadowColor: palette.ink,
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
    },
    android: { elevation: 8 },
    default: {},
  }),
} as const;

/** The hairline. One weight, one colour, everywhere. */
export const hairline = { height: 1, backgroundColor: palette.rule } as const;

// ─────────────────────────────────────────────────────────────────────────────
// Motion
//
// Short and functional. Nothing in the listing screen announces itself: the
// header crossfades, the hero parallaxes, sheets slide. No bounces, no
// staggered entrances, no artificial delay before content appears.
// ─────────────────────────────────────────────────────────────────────────────
export const duration = {
  /** A crossfade or colour change. */
  fast: 160,
  /** A sheet opening, a row expanding. */
  base: 240,
  /** A full-screen transition. */
  slow: 320,
  /** One breath of a skeleton pulse. */
  pulse: 750,
} as const;

export const opacity = {
  /** A control that cannot be used. */
  disabled: 0.4,
  /** Pressed feedback on a tappable surface. */
  pressed: 0.6,
  /** A skeleton at its dimmest. */
  skeletonMin: 0.45,
  /** A scrim over a photo, so white controls hold contrast. */
  scrim: 0.32,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Layering
//
// Named so a stacking bug is a lookup, not an archaeology exercise. The three
// values that matter on the listing: content, the header bar that fades in over
// it, and the title that sits on that bar.
// ─────────────────────────────────────────────────────────────────────────────
export const zIndex = {
  base: 0,
  raised: 1,
  headerBar: 2,
  headerContent: 3,
  dock: 4,
  overlay: 10,
} as const;

/** Minimum tappable area. Anything smaller needs a hitSlop to reach it. */
export const MIN_TAP = 44;
