# UI review checklist

Every screen passes this before it is done. If a line fails, the screen is not
finished — it is a screen that will need redoing later, which is more expensive.

Run `npm run test:mobile` first: the drift guard mechanises items 1–3.

## Tokens

- [ ] **No hex literals.** Every colour comes from `palette` or the `page*`
      theme tokens. Exceptions are real-world constants only — a brand mark, an
      EU plate band — and each carries a comment saying so.
- [ ] **No raw font sizes.** Every text style is one of the six `type` steps.
- [ ] **No raw radii.** Every corner is a `radii` role.
- [ ] **No raw spacing.** Every gap, pad and margin is a `space` step.
- [ ] **Page inset is `gutter`.** Not 16, not 20, not "whatever looked right".

## Hierarchy

- [ ] **One title per screen.** `type.title` appears once, or not at all if the
      screen has a masthead instead.
- [ ] **Label and value share a size**, separated by weight — not a big label
      over a small caption.
- [ ] **Green appears in at most three roles**: a tappable affordance, the
      rating, an accent chip. A fourth use means something else should be ink.
- [ ] **No shadows** unless the element floats over content (a control on a
      photo, a dock). Separation is a rule and white space.

## Components

- [ ] **Nothing hand-rolled that the kit already has.** Check `components/ui/page.tsx`
      before writing a row, pill, empty state, avatar or chip.
- [ ] **Anything new that appears three times goes in the kit**, not copied a
      third time.
- [ ] **One divider.** `Rule`, at `gutter` inset. No borders on cards, no second
      hairline colour.
- [ ] **Records are borderless** — hairline between rows, no boxes.

## Content honesty

- [ ] **No value invented to fill a layout.** If the API has no walking time, no
      bay dimensions, no response rate, the element is not rendered.
- [ ] **Every claim traced to code.** A stated policy ("free cancellation up to
      4 hours") reads from the constant that enforces it, never a literal.
- [ ] **No fabricated statistics or social proof**, on any surface, including
      marketing.
- [ ] **Empty states say what to do**, not just that something is absent.

## Interaction

- [ ] **Chevrons only where something happens.** An arrow that leads nowhere is
      a promise the screen cannot keep.
- [ ] **Tap targets ≥ 44pt**, or a `hitSlop` that gets them there.
- [ ] **Disabled states say why** — "Add your vehicle to continue" beats a grey
      button with no explanation.
- [ ] **Destructive and committing actions state the consequence.** "Pay €24.00",
      not "Continue".

## States

Every screen that loads data has all four. A screen with only the happy path is
half a screen.

- [ ] **Loading** — a skeleton that mirrors the real layout. Never a spinner on
      content, never an artificial delay.
- [ ] **Empty** — `EmptyState` with icon, title and a hint that says what next.
- [ ] **Error** — states what failed and offers the retry.
- [ ] **Success** — confirmation is visible without hunting for it.

## Motion

- [ ] **Durations come from `duration`.** Nothing improvised.
- [ ] **Opacity and transform only**, so it runs on the native driver.
- [ ] **Nothing announces itself** — no bounce, no stagger, no entrance
      animation on content that could simply be there.

## Accessibility

- [ ] **`accessibilityRole` on every Pressable.**
- [ ] **`accessibilityLabel` where the label is an icon** or a bare number.
- [ ] **Text contrast ≥ 4.5:1.** `muted` on white passes; `muted` on `pill`
      does not — use `ink`.
- [ ] **Nothing conveyed by colour alone.** A status pill carries its word, not
      just its tone.
- [ ] **Layout survives large text.** Rows grow rather than truncate the value.

## Before you call it done

- [ ] Added to `CONVERTED` in `test/designSystem.test.ts` with measured budgets.
- [ ] Looked at on a real device, not only the simulator.
- [ ] Compared side by side with the listing screen. If it looks like a
      different app, it is.
