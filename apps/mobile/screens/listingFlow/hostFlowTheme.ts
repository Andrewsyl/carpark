/**
 * The host flow's palette, on the page tokens.
 *
 * These names stay because fourteen screens read them; the values now come
 * from `styles/pageTokens`, so the wizard uses the same ink, greys and rule as
 * the listing and booking pages rather than a warmer set of its own.
 */
import { colors } from "../../styles/theme";
import { ACCENT_SOFT, INK, PILL, WHITE } from "../../styles/pageTokens";

/**
 * 14a's own values, where they differ from the page tokens:
 *   wizardGreen  #1B8A5A — the forward action. Lighter and more saturated
 *                than the app's #0a8050; the wizard uses it throughout.
 *   textMuted    #6B6B6B — a hair darker than the page's #6A6A6A.
 *
 * Kept exact rather than rounded to the nearest existing token, because the
 * green is a visible difference and the flow is meant to read as 13a.
 */
export const wizardGreen = "#1B8A5A";
/** 14a's rule — a touch warmer than the page's #E3E3E1. */
export const wizardLine = "#E6E6E4";
/** 16a's field outline. Darker than the rule so an input reads as editable. */
export const wizardLineStrong = "#D4D4D2";
/**
 * 16a's disabled forward action. A distinct fill rather than a dimmed ink one:
 * opacity on black read as a grey button that still looked pressable.
 */
export const wizardDisabledBg = "#F7F7F6";
export const wizardDisabledText = "#B8B8B6";

export const hostFlowColors = {
  bg: WHITE,
  appBg: WHITE,
  appBgDeep: ACCENT_SOFT,
  cardBg: WHITE,
  cardBgMuted: PILL,
  border: wizardLine,
  borderStrong: wizardLineStrong,
  divider: wizardLine,
  text: INK,
  textMuted: "#6B6B6B",
  textSoft: "#6B6B6B",
  accent: wizardGreen,
  accentSoft: ACCENT_SOFT,
  accentSoftBorder: wizardGreen,
  mint: colors.mint,
  disabledBg: wizardDisabledBg,
  disabledText: wizardDisabledText,
};

/**
 * No shadow. The system separates with a rule and white space; this stays as
 * an empty object so the fourteen screens spreading it keep compiling while
 * they lose the elevation.
 */
export const hostFlowShadow = {} as const;
