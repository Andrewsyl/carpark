import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

/**
 * Guards the design system against the drift that already happened once here:
 * screens accumulated their own hex literals and type sizes until the listing
 * and checkout pages no longer matched, and nobody could tell by reading a
 * diff.
 *
 * A screen is added to CONVERTED as its wave lands. Unconverted screens are
 * not checked — they are allowed their existing hex until their PR converts
 * them whole. The list only ever grows; removing a name to make the suite pass
 * is the failure this test exists to catch.
 */
// Paths are relative to `screens/`, so a screen in a subdirectory names its
// folder — the host flow lives in `listingFlow/` and was invisible to this
// guard until it did.
const CONVERTED = [
  "ListingScreen.tsx",
  "BookingReviewBody.tsx",
  "ListingReviewsScreen.tsx",
  "BookingDetailScreen.tsx",
  "BookingSummaryScreen.tsx",
  // The host flow. Every one of these declares its colour through
  // `hostFlowTheme`, which is where the flow's remaining off-system values are
  // now concentrated — that file is the next thing to fold into the palette.
  "listingFlow/ChoiceTile.tsx",
  "listingFlow/FlowFooter.tsx",
  "listingFlow/FlowHeader.tsx",
  "listingFlow/StepQuestion.tsx",
  "listingFlow/ListingAccessScreen.tsx",
  "listingFlow/ListingAvailabilityScreen.tsx",
  "listingFlow/ListingDetailsScreen.tsx",
  "listingFlow/ListingFeaturesScreen.tsx",
  "listingFlow/ListingLocationScreen.tsx",
  "listingFlow/ListingPhotosScreen.tsx",
  "listingFlow/ListingPriceScreen.tsx",
  "listingFlow/ListingReviewScreen.tsx",
  "listingFlow/ListingStreetViewScreen.tsx",
];

const SCREENS_DIR = join(__dirname, "..", "screens");
const UI_DIR = join(__dirname, "..", "components", "ui");

// Colours a converted screen may still name directly, with the reason. These
// are real-world constants, not palette choices: recolouring them would be
// wrong rather than merely off-system.
const ALLOWED = new Set([
  "#3D6FB6", // EU number-plate band blue
  "#1A1F71", // Visa
  "#EB001B", // Mastercard red
  "#F79E1B", // Mastercard amber
  "#006FCF", // American Express
  "#FFFFFF", // paper white inside a trademark mark
  "#000000", // Apple's wordmark
]);

const HEX = /#[0-9A-Fa-f]{3,8}\b/g;

// Comments routinely name a colour to explain which token was chosen and why.
// That is documentation, not drift, so only code is scanned.
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

function hexLiteralsIn(file: string): string[] {
  const src = stripComments(readFileSync(file, "utf8"));
  return (src.match(HEX) ?? []).filter((hex) => !ALLOWED.has(hex.toUpperCase()));
}

/**
 * Raw `fontSize:` and `borderRadius:` still declared per-screen, per file.
 *
 * Colour was never the main drift here: an audit of all 25 screens found 18
 * hex literals but 21 distinct font sizes and 21 distinct radii. A hex-only
 * rule would pass a screen that invents a 19px heading and a 14px radius.
 *
 * These are ratchets, not targets. They may only ever go DOWN — as a screen
 * moves onto `textStyles` and the radius scale, lower the number. Raising one
 * to make the suite pass is the drift this file exists to prevent.
 */
const RAW_VALUE_BUDGET: Record<string, { fontSize: number; radius: number }> = {
  // Rebuilt from scratch, not drifted: the old screen's numbers (48/13) do not
  // describe this file. Type came DOWN hard (48 → 32) because the page kit owns
  // the scale now. Radius went UP (13 → 17), which a ratchet would normally
  // forbid — recorded here rather than hidden because it is a real regression
  // in kind: the new layout has more distinct rounded shapes (tinted fields,
  // reg plate, map, viewer, chips) and none of them go through a radius scale
  // yet. Closing that is the next thing this budget should force down.
  // 32/17 -> 29/15: the parking window's grey summary strip went (the dock
  // already states the total and the duration), and its fields take their
  // corner from `radii.surface` rather than a raw 10. The sheet's two corners
  // went with the curve over the photo but don't show here — the check only
  // sees `borderRadius`, not `borderTopLeftRadius`, which is a hole worth
  // closing the next time this file is touched.
  "ListingScreen.tsx": { fontSize: 29, radius: 15 },
  // Went 15 -> 18 -> 20 as this screen absorbed promo entry and the payment
  // recovery notice from the summary it replaced, then back to 15 once `Field`
  // and `Notice` took those shapes into the kit. That round trip is the budget
  // working: it named the missing components rather than letting the screen
  // quietly grow.
  // 11 -> 16 rebuilding to the 12a checkout: a summary card, edit links and a
  // price ledger with a 26px total are shapes the kit does not own yet. The
  // summary card and the label/value/edit row are the two worth extracting.
  "BookingReviewBody.tsx": { fontSize: 20, radius: 4 },
  "ListingReviewsScreen.tsx": { fontSize: 10, radius: 3 },
  // 37 -> 3 and 14 -> 0: the classic summary this screen used to render was
  // deleted when the review body became the confirm page, and 78 of its 88
  // styles went with it. What is left is loading, signed out, and not found.
  "BookingSummaryScreen.tsx": { fontSize: 3, radius: 0 },
  // radius 8 -> 0: every corner moved onto the `radii` scale when this screen
  // converted properly (it had been on the kit's components but still using
  // its own greys, 14/16/20 corners and a card shadow).
  "BookingDetailScreen.tsx": { fontSize: 15, radius: 0 },

  // The host flow, measured on the day it entered the guard rather than chosen.
  // These are high — the flow declares 17 distinct font sizes and 16 radii
  // against a system of 6 and 5 — and that is the point: they are a ratchet, so
  // the numbers record where the rebuild actually is and can only come down.
  // The two worth attacking first are the review screen (24/15, the largest
  // single source of drift in the app) and the availability screen, whose
  // custom-schedule modal is still on the pre-rebuild token set.
  // 3 -> 9 and 3 -> 7, the only rise here, recorded rather than hidden. This
  // file absorbed three shapes the screens were each drawing themselves:
  // `ChoiceSummary` (details + access), `ChoicePill` (16a's highlight pill, now
  // the features step) and `ChoiceOptionRow` (16a's discounts row, now the
  // pricing step). Every screen that handed a shape over came down by more than
  // this went up — one file paying so several don't is the trade the kit exists
  // to make. It is now the flow's shape library and should be read as one.
  "listingFlow/ChoiceTile.tsx": { fontSize: 9, radius: 7 },
  "listingFlow/FlowFooter.tsx": { fontSize: 3, radius: 3 },
  "listingFlow/FlowHeader.tsx": { fontSize: 1, radius: 1 },
  "listingFlow/StepQuestion.tsx": { fontSize: 4, radius: 0 },
  "listingFlow/ListingAccessScreen.tsx": { fontSize: 6, radius: 4 },
  "listingFlow/ListingAvailabilityScreen.tsx": { fontSize: 13, radius: 4 },
  "listingFlow/ListingDetailsScreen.tsx": { fontSize: 2, radius: 1 },
  // 0/0: every value on this step now comes from the kit.
  "listingFlow/ListingFeaturesScreen.tsx": { fontSize: 0, radius: 0 },
  "listingFlow/ListingLocationScreen.tsx": { fontSize: 8, radius: 6 },
  "listingFlow/ListingPhotosScreen.tsx": { fontSize: 7, radius: 7 },
  // 11/6 -> 8/2: the radio rows and the green "you keep everything" callout both
  // went when this step moved onto the discounts row shape.
  "listingFlow/ListingPriceScreen.tsx": { fontSize: 8, radius: 2 },
  "listingFlow/ListingReviewScreen.tsx": { fontSize: 24, radius: 15 },
  "listingFlow/ListingStreetViewScreen.tsx": { fontSize: 3, radius: 2 },
};

function countRaw(file: string, prop: "fontSize" | "borderRadius"): number {
  const src = stripComments(readFileSync(file, "utf8"));
  return (src.match(new RegExp(`${prop}:\\s*(?:scaleDisplay\\()?\\d+`, "g")) ?? [])
    .length;
}

describe("design system", () => {
  it.each(Object.entries(RAW_VALUE_BUDGET))(
    "%s declares no more raw type/radius than its budget",
    (screen, budget) => {
      const path = join(SCREENS_DIR, screen);
      expect(countRaw(path, "fontSize")).toBeLessThanOrEqual(budget.fontSize);
      expect(countRaw(path, "borderRadius")).toBeLessThanOrEqual(budget.radius);
    }
  );

  it.each(CONVERTED)("%s declares no hex literals", (screen) => {
    const found = hexLiteralsIn(join(SCREENS_DIR, screen));
    expect(found).toEqual([]);
  });

  it("the shared ui kit declares no hex literals", () => {
    const offenders: Record<string, string[]> = {};
    for (const name of readdirSync(UI_DIR)) {
      if (!name.endsWith(".tsx") && !name.endsWith(".ts")) continue;
      const path = join(UI_DIR, name);
      if (!statSync(path).isFile()) continue;
      const found = hexLiteralsIn(path);
      if (found.length) offenders[name] = found;
    }
    expect(offenders).toEqual({});
  });

  it("every converted screen is a real file", () => {
    // Catches a rename that silently drops a screen out of the check.
    for (const screen of CONVERTED) {
      expect(existsSync(join(SCREENS_DIR, screen))).toBe(true);
    }
  });

  it("the converted list has no duplicates", () => {
    // A name listed twice reads as two screens covered and is one — the list
    // carried `BookingDetailScreen.tsx` twice before this check existed.
    expect([...new Set(CONVERTED)]).toEqual(CONVERTED);
  });
});
