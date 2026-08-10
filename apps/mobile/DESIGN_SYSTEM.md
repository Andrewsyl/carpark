# The FreeSpace design system

**Source of truth: `screens/ListingScreen.tsx`.** Where this document and that
screen disagree, the screen is right and this document is stale.

Implementation: `styles/tokens.ts` (values), `components/ui/page.tsx` (shapes),
`UI_REVIEW_CHECKLIST.md` (the gate), `test/designSystem.test.ts` (enforcement).

The point of this file is that **building a screen should involve no design
decisions.** If you are choosing a size, a grey, a corner or a gap, the answer
is already here. If it genuinely isn't, add it here first so the next screen
inherits it.

---

## 1. Why the listing screen works

### Personality

Quiet, dense, factual. It reads like a document about a parking space rather
than a page selling one. Closest relatives are Airbnb's stay page and Linear's
settings — confident enough to use plain white, one grey, and almost no
decoration.

It is **not** playful, not glossy, and deliberately not "designed-looking". The
craft is in restraint.

### The five things doing the work

**1. One divider, and no boxes.**
There is not a single bordered card on the listing. Sections are separated by a
1px `#E3E3E1` rule inset to the page gutter, and nothing else. Boxes are what
make an app look like a form; removing them is the largest single reason this
screen reads as premium. Every "card" you add costs a border, a radius, a
shadow and an inner padding — four decisions that then need to agree with every
other card in the app.

**2. Weight carries hierarchy, not size.**
A row's label and its value are the *same size*, separated by weight alone.
Most apps set a 17pt bold label over a 13pt grey caption, which reads as
heading-plus-footnote. Same-size pairs read as one fact. This is why six type
steps are enough for the whole app.

**3. Green is rationed.**
It appears in exactly three roles: a tappable affordance, the rating, and an
accent chip. Everything else is ink or muted. The scarcity is what gives the
green any meaning — an app where the brand colour is on every heading has a
brand colour that signals nothing.

**4. Space is the layout.**
28 between sections, 24 at the gutter, 12 under a heading. No dotted lines, no
background tints marking regions, no alternating row colours. The rhythm is
regular enough that the eye stops noticing it, which is the goal.

**5. The photo is furniture, not decoration.**
The hero is fixed behind the content, which slides over it. Pulling down
stretches it to fill the rubber band; scrolling recedes it at a third of
content speed. The controls over it are dark glass, and they *lose* the glass
as a white bar fades in behind them rather than becoming white circles on
white. That transition is the most expensive-feeling detail on the screen and
costs two interpolations.

### The details that make it feel expensive

- **The header bar arrives before its title.** Two staggered fades, so the
  surface is white before the words land on it, and the page title and the
  header title are never both on screen.
- **The stat row is equal thirds** with dividers inset 2pt top and bottom —
  they separate the columns without slicing the block.
- **The rating column carries a star where the others carry a word**, in the
  label's slot, so the row still aligns at two lines.
- **"Read more" sits on the last line**, not below it, which required measuring
  the real layout rather than guessing a character count.
- **Unearned stars stay grey rather than being omitted**, so a 4.5 keeps the
  row's full width.
- **The reg plate spans the row** with a fixed EU band and a centred
  registration — it reads as a plate, not a chip holding text.

### What it deliberately refuses

No shadows. No gradients except the scrim that keeps controls legible on a
photo. No icon in a coloured circle unless it is an empty state. No badge on
anything that isn't a state. No animation on content that could simply be
there.

---

## 2. Tokens

Full values in `styles/tokens.ts`. The audit that motivated them: **21 distinct
font sizes, 26 radii, 31 spacing values, 18 hex literals** across 26 screens.
None were chosen; they accumulated.

### Colour — 7 values

| Token | Value | Use | Never |
|---|---|---|---|
| `ink` | `#111111` | Text, icons, committing action | As a background except the primary button |
| `muted` | `#6A6A6A` | Supporting copy, meta | On a tinted fill — fails contrast |
| `rule` | `#E3E3E1` | The only divider | As a border on a card |
| `pill` | `#F2F2F0` | Grey buttons, chips, neutral status | As a page ground |
| `accentSoft` | `#E9F4EC` | Tinted fields, accent chips, empty circles | Behind long prose |
| `accentDark` | `#0E5538` | Text on an accent tint | On white |
| `accent` | `#0a8050` | Affordance, rating, primary CTA | Headings, decoration |

**The rule that matters:** green in a fourth role means something else should
be ink.

### Typography — 6 steps

| Step | Size / line | Use |
|---|---|---|
| `title` | 32 / 38 | A screen's own title. Once per screen. |
| `display` | 26 / 31 | A masthead title over or under media |
| `section` | 19 / 24 | Section heading |
| `row` | 17 / 24 | A row's label (bold) and value (regular) |
| `body` | 15 / 22 | List labels, prose |
| `meta` | 13 / 18 | Timestamps, captions |

A seventh step means the layout is wrong, not the scale short.

### Spacing — 7 steps, 4pt grid

`4 · 8 · 12 · 16 · 20 · 24 · 28`, gutter `24`.

Standard rhythm: **28** between sections, **12** heading → content, **18**
inside a record row, **16** between sibling controls.

### Radius — by role

| Role | Value | Applies to |
|---|---|---|
| `control` | 8 | Buttons, pills, chips |
| `field` | 10 | Inputs, tinted tappable fields |
| `surface` | 12 | Cards, media frames |
| `sheet` | 20 | Sheets, content sheet over media |
| `round` | 999 | Avatars, dots, primary action |

### Elevation — almost none

Default is **no shadow**. Two exceptions, both for things floating *over*
content: `elevation.floating` (a control on a photo) and `elevation.sheet` (a
dock or bottom sheet). Anything sitting *in* the page is separated by a rule.

### Motion

`fast` 160 · `base` 240 · `slow` 320 · `pulse` 750.
Opacity and transform only, so everything runs on the native driver.

---

## 3. Components

All in `components/ui/page.tsx`.

### `ScrollHeader` + `useScrollHeader`

White bar fades in, then the title, staggered.

- **Use** on any scrolling screen with a title or a hero.
- **Don't** show the bar and the page's own title simultaneously — that is what
  the stagger prevents.
- **Sizing** — `insetLeft`/`insetRight` clear the controls *per side*. They are
  rarely symmetrical; the listing has one button left, two right.
- **Alignment** — `titleCentre` is how far below the safe area the title's
  optical centre sits, and it must equal the centre line of that screen's own
  controls (button top + half its height). The listing floats a 40pt button at
  +12, so 32. It defaults to 28, the bar's own middle.
- **Mistake** — a shared inset, which puts a long title under the share icon.
- **Mistake** — leaving `titleCentre` at the default when the controls aren't
  centred in the bar. That was a fixed `top` until 2026-08-10 and the title rode
  ~5pt high next to the back and share buttons on the listing.

### `Rule`

The inset hairline. The only divider in the system.

- **Use** between sections.
- **Don't** use inside a record list (rows carry their own hairline) or as a
  card border.

### `SectionTitle`

- **Use** above every section. Optional action on the right.
- **Sizing** — title takes `flex: 1, minWidth: 0`; the action `flexShrink: 0`.
- **Mistake** — `marginLeft: "auto"` on the action, which lets a long title run
  into it.

### `ListRow` / `FactRow`

20px outline icon, 16 gap, 15px label. `FactRow` stacks copy and takes a
chevron.

- **Don't** give `FactRow` a chevron unless it navigates.

### `ReviewRow`

Label, value, optional grey action, optional **full-width footer**.

- **Use** the footer for anything spanning the row — a reg plate. The copy
  column is narrowed by the action, so `alignSelf: "stretch"` inside it is not
  full width.

### `RegPlate`

An Irish registration drawn as the plate: 46 tall, 1.5px `#3D6FB6` border, a
30px EU band with IRL, and the reg in `UKNumberPlate` centred in what's left.

- **Use** wherever a driver's registration is stated to a host — it is the one
  detail checked at a barrier, so it earns being the thing it is.
- **Don't** put it inside a copy column that an action has narrowed. It has to
  span the row, which is what `ReviewRow`'s footer slot is for.
- **Note** — `#3D6FB6` is a real-world constant, not a brand colour, and is on
  the hex check's allow-list for that reason.

### `RecordCard`

A booking or listing in a list. Borderless, hairline between rows.

- **Use** for every list of records.
- **Don't** box it. Boxed cards are why the tabs currently look like three
  different apps.

### `StatusPill`

One shape, five tones: `neutral` `positive` `warning` `danger` `info`.

- **Use** for every state in the app — listing, booking, payment.
- **Don't** build a second status component. Sixteen screens show state; two
  components is two things to drift.
- **Mistake** — colour without a word. A tone is not readable on its own.

### `EmptyState`

Tinted circle, title, **required** hint, optional action.

- **Mistake** — a title alone. It states a fact and leaves the person stuck.
- **Note** — "no written reviews yet" and "no reviews yet" are different
  states. A rating with no review bodies is not an empty list.

### `Avatar`

Initial on a fill **derived from the name**, never passed in — the same person
is the same colour on every screen.

### `Chip`

A tinted fact with an optional glyph. Facts, not actions.

- **Don't** make a chip tappable. If it does something it is a button.

### `PillButton` / `PrimaryButton`

Grey pill under a list; ink pill for the committing action.

- **Don't** put more than one `PrimaryButton` on a screen.
- **Mistake** — a label that hides the consequence. "Pay €24.00", not
  "Continue".

---

## 4. Patterns not yet componentised

Present on the listing, not yet extracted because each has one caller. Extract
on the third.

**Media hero** — fixed behind the scroll, parallax on scroll, stretch on
pull, tap to fullscreen, paging gesture layer inset 24 from the left so it
never eats iOS's edge-swipe-back.

**Stat strip** — equal thirds, dividers inset 2pt, glyph in the label slot for
the rating.

**Field pair** — arriving/leaving, two equal `pill` fields with a 1px `rule`
border at `surface` radius, everything centred: 15 muted label, 26 **bold** ink
value, 20px muted chevron beside it, 15 muted date. Neutral rather than tinted:
green here means "tappable", and a page where both fields are green has stopped
distinguishing anything with it. The 1.5px green outline this carried until
2026-08-10 is what made the pair read as form inputs — a fill plus a hairline
says "control" without it. The monthly end is derived, so that half loses its
chevron and its press. Nothing sits under the pair: the grey duration/total
strip that did was saying what the dock already says two inches below it.

---

## 5. Audit

Measured, not eyeballed. `sizes` and `radii` are distinct values per screen.

| Screen | Lines | Hex | Sizes | Radii | Kit | Verdict |
|---|---|---|---|---|---|---|
| `ListingScreen` | 1517 | 0 | 9 | 10 | page | **Source of truth** |
| `BookingReviewBody` | 395 | 1 | 7 | 5 | page | ✅ |
| `ListingReviewsScreen` | 244 | 0 | 5 | 3 | page | ✅ |
| `HostBookingDetailScreen` | 726 | 1 | **13** | 8 | — | ❌ worst type drift |
| `BookingSummaryScreen` | 1600 | 2 | 10 | 6 | old | ❌ two designs in one file |
| `BookingDetailScreen` | 876 | 0 | 10 | 4 | old | ❌ old kit |
| `ListingsScreen` | 1604 | 1 | 9 | 5 | old | ❌ 10 status style keys |
| `ProfileScreen` | 412 | 0 | 9 | 5 | — | profileUi, out of scope |
| `FavoritesScreen` | 539 | 2 | 8 | 5 | old | ❌ |
| `HistoryScreen` | 1202 | **5** | 9 | 3 | — | ❌ worst colour drift |
| `SearchScreen` | 3803 | 4 | 9 | 1 | — | ❌ largest, most seen |
| `ReviewScreen` | 375 | **8** | 7 | 3 | old | ❌ worst hex count |
| `VehicleTypeScreen` | 513 | 1 | 6 | 6 | — | ❌ |
| `listingFlow/*` (14 files) | 5049 | 0 | **17** | **16** | own | ⚠️ mid-rebuild |

### The honest verdict, screen by screen

**`SearchScreen` — the most damaging.** It is the first thing a user sees and
the last to be converted, at 3,803 lines with 4 hex literals and 24 spacing
values. Whatever the listing achieves, the app's first impression is set here.
Its single radius suggests one card shape repeated — that is at least a
tractable conversion, not a rebuild.

**`ReviewScreen` — 8 hex literals in 375 lines.** The highest density of
hardcoded colour anywhere. This is a screen where someone rates a booking; it
should be the calmest surface in the app and instead it carries more raw colour
than the listing, booking and review screens combined.

**`HostBookingDetailScreen` — 13 distinct font sizes in 726 lines.** More type
variety than the listing screen in half the space. Hosts are the users you can
least afford to look amateur to, since they are trusting you with property
access.

**`HistoryScreen` — 5 hex literals, and it is a tab.** Users hit it constantly.
It also has three tabs whose empty states differ from every other empty state
in the app.

**`BookingSummaryScreen` — the actively harmful one.** It renders *two*
designs: the new review layout behind a flag, and the classic summary. A driver
who signs in mid-flow sees the old one, because the auth return route does not
carry the flag. One booking, two visual identities. This is worse than either
design alone and should be fixed before anything cosmetic.

**`ListingsScreen` — 10 style keys for a status badge.** Plus a status dot,
plus its own empty state. All three now exist in the kit.

**`FavoritesScreen` and `BookingDetailScreen`** — straightforward conversions.
No unusual patterns, just the old kit and old tokens.

**The host flow — the most type drift in the app, in one folder.** Nine steps
across fourteen files declaring 17 distinct font sizes and 16 radii against a
system of 6 and 5. It carries no hex literals, which flatters it: the colour
lives one import away in `screens/listingFlow/hostFlowTheme.ts`, which keeps a
*second* green (`#1B8A5A` against the app's `#0a8050`), a second rule
(`#E6E6E4` against `#E3E3E1`) and a second muted (`#6B6B6B` against `#6A6A6A`).
Three differences nobody can see individually, which together cost the one-green
rule. Alongside them sit eight `rgba()` scrims in three unrelated inks — Tailwind
slate-900 at five opacities, `#101414`, and the app green — none of which the
hex check can see.

Four things break the flow's own rules rather than the system's:

- **Two primary buttons.** Steps 1–8 use `FlowFooter`'s ink rect; the intro and
  the review screen use `SquircleBtn`, a green pill. The first and last things a
  host taps are the two that don't follow the rule the middle eight state.
- **Step 9 has no footer**, so it loses the progress segments and Back, and
  opens with a kicker — the device the rebuild removed everywhere else.
- **The custom-availability modal is pre-rebuild throughout** — old `colors.*`,
  radius 32, 10px uppercase labels, the old `Button`. Tapping "Custom" leaves
  the design.
- **Five ways to say "selected"** across nine steps: border-weight tile, border
  + checkbox, border + check glyph, a green radio dot, and plain `ChoiceRow`.
  The radio is the only place green means "chosen" rather than "go".

### Order of work

1. **`BookingSummaryScreen`** — make the review layout the default and delete
   the classic rendering. Fixes a real inconsistency, not a cosmetic one, and
   removes ~900 lines.
2. **`BookingDetailScreen`** — last old-kit screen. Then delete `Tile`,
   `Section`, `Masthead`, `SectionHeader`, `Card`, `FactRow` and collapse the
   two token sets into one.
3. **`HistoryScreen`, `FavoritesScreen`, `ListingsScreen`** — the record trio.
   `RecordCard` + `StatusPill` + `EmptyState` now exist, so these are assembly.
4. **`HostBookingDetailScreen`, `ReviewScreen`, `VehicleTypeScreen`** — small,
   high drift.
5. **The host flow** — finish the rebuild rather than starting another screen.
   In order: give step 9 the flow footer and drop its kicker, settle on one
   primary button, rebuild the custom-availability modal on the current tokens,
   collapse the five selection idioms into `ChoiceRow`, then fold
   `hostFlowTheme` onto the palette and retire the parallel green. The budgets
   in `test/designSystem.test.ts` will not let any of it drift back.
6. **`SearchScreen`** — last, largest, needs its own plan.

Out of scope: the six `profileUi` screens are a separate, user-approved kit.

---

## 6. Enforcement

`test/designSystem.test.ts`:

- Converted screens declare **no hex literals**
- The shared kit declares **no hex literals**
- Each converted screen has a **budget** of raw sizes and radii that may only
  go **down**
- Names in `CONVERTED` are paths relative to `screens/`, so a screen in a
  subdirectory names its folder (`listingFlow/ListingPriceScreen.tsx`). The host
  flow was invisible to this guard until that was true, which is how it reached
  17 font sizes unnoticed.

Two holes worth knowing about, both open:

- **`rgba()` is not checked.** The hex regex only sees `#rrggbb`, so a scrim
  written as `rgba(15, 23, 42, 0.4)` passes. There are eight of them in the host
  flow today. Closing this means giving the palette a scrim token first.
- **A theme file launders colour.** A screen importing its greys from a
  neighbouring `*Theme.ts` reports zero hex while carrying a whole parallel
  palette. Only `components/ui/` is swept for that today.

Raising a budget to make the suite pass is the drift the test exists to prevent.
If a rebuild genuinely resets one, say so in a comment beside the number — as
`ListingScreen` does, where radius went 13 → 17 and the reason is recorded.
