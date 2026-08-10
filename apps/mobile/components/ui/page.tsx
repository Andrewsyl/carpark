/**
 * The page kit — the shared shapes behind the listing and booking-review
 * screens.
 *
 * Every component here was extracted from code that already existed in both
 * pages; nothing is speculative. The caller count is in each doc comment so a
 * later reader can see what the evidence was.
 *
 * Reads the `page*` tokens from `styles/theme.ts` via `styles/pageTokens`.
 * Those are a colder, higher-contrast set than the older tokens the rest of
 * the app uses — don't mix the two within one screen.
 */
import { useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { AlertCircle, ArrowLeft, ChevronRight, type LucideIcon } from "lucide-react-native";
import { GREEN, INK, MUTED, PILL, RULE, WHITE } from "../../styles/pageTokens";
import { colors } from "../../styles/theme";

/** The page's horizontal inset. Everything in the kit sits on it. */
export const GUTTER = 24;

/**
 * Spacing. Every gap in the system is one of these — if a number isn't here,
 * it shouldn't be in a screen either.
 */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 28 } as const;

/**
 * Radius. Four values, by role rather than by size, so the question is never
 * "how round?" but "what is this?".
 *   control  a button, pill or chip
 *   field    an input or a tappable tinted field
 *   surface  a card, tile or media frame
 *   round    avatars and dots
 */
export const radii = { control: 8, field: 10, surface: 12, round: 999 } as const;

// ── Type ────────────────────────────────────────────────────────────────────
// Six steps, which is all the two pages actually use.
export const text = StyleSheet.create({
  /** Screen title — the review page's "Review and continue". */
  title: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 32, lineHeight: 38, letterSpacing: -0.9, color: INK,
  },
  /** Masthead title — the listing's space name. */
  display: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 26, lineHeight: 31, letterSpacing: -0.6, color: INK,
  },
  /** Section heading. */
  section: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 19, lineHeight: 24, letterSpacing: -0.3, color: INK,
  },
  /** A row's value, and the label above it at Bold. */
  row: { fontFamily: "PlusJakartaSans-Regular", fontSize: 17, lineHeight: 24, color: INK },
  /** List labels and prose. */
  body: { fontFamily: "PlusJakartaSans-Regular", fontSize: 15, color: INK },
  /** Supporting and muted copy. */
  meta: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: MUTED },
});

/**
 * The inset hairline that does all the separating. the listing has no cards and no
 * borders — this is the only divider. (5 callers.)
 */
export function Rule({
  style,
  tight = false,
}: {
  style?: StyleProp<ViewStyle>;
  /** 18 rather than 28, for a dense record where sections are short. */
  tight?: boolean;
}) {
  return <View style={[styles.rule, tight && styles.ruleTight, style]} />;
}

/**
 * Section heading with its own padding, optionally carrying an action on the
 * right. (4 callers.)
 */
export function SectionTitle({
  children,
  actionLabel,
  onAction,
}: {
  children: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionBlock}>
      {/* flex/shrink rather than marginLeft:auto on the action — with auto a
          long title runs straight into it and the two touch. */}
      <Text style={[text.section, styles.sectionTitle]}>{children}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button">
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** The one button shape: a full-width grey pill under a list. (2 callers.) */
export function PillButton({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable style={styles.pill} onPress={onPress} accessibilityRole="button">
      <Text style={styles.pillLabel}>{label}</Text>
    </Pressable>
  );
}

/** The one list shape: 20px outline icon, 16 gap, 15px label. (mapped.) */
export function ListRow({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <View style={styles.listRow}>
      <View style={styles.listIcon}>
        <Icon size={20} color={INK} strokeWidth={1.7} />
      </View>
      <Text style={[text.body, styles.listLabel]}>{label}</Text>
    </View>
  );
}

/**
 * Same geometry as ListRow but with stacked copy and an optional chevron —
 * the "Things to know" shape. (3 callers.)
 */
export function FactRow({
  icon: Icon,
  title,
  lines,
  onPress,
}: {
  icon: LucideIcon;
  title: string;
  lines: string[];
  onPress?: () => void;
}) {
  const Container = onPress ? Pressable : View;
  return (
    <Container style={styles.factRow} onPress={onPress}>
      <View style={[styles.listIcon, styles.factIcon]}>
        <Icon size={20} color={INK} strokeWidth={1.7} />
      </View>
      <View style={styles.factCopy}>
        <Text style={styles.factTitle}>{title}</Text>
        {lines.map((line) => (
          <Text key={line} style={styles.factLine}>
            {line}
          </Text>
        ))}
      </View>
      {onPress ? (
        <ChevronRight size={18} color={INK} strokeWidth={1.8} style={styles.factChevron} />
      ) : null}
    </Container>
  );
}

/**
 * Label, value, an optional grey action, and an optional full-width footer.
 * The review page's row. (5 callers.)
 */
export function ReviewRow({
  label,
  children,
  actionLabel,
  onAction,
  footer,
}: {
  label: string;
  children: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  /**
   * Rendered below the label/action line at full width. The copy column is
   * narrowed by the action beside it, so anything that must span the row —
   * a reg plate — cannot live inside it.
   */
  footer?: React.ReactNode;
}) {
  return (
    <View>
      <View style={[styles.reviewRow, footer ? styles.reviewRowWithFooter : null]}>
        <View style={styles.reviewCopy}>
          <Text style={styles.reviewLabel}>{label}</Text>
          {children}
        </View>
        {actionLabel && onAction ? (
          <Pressable style={styles.reviewAction} onPress={onAction} accessibilityRole="button">
            <Text style={styles.reviewActionLabel}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {footer ? <View style={styles.reviewFooter}>{footer}</View> : null}
    </View>
  );
}

/**
 * An Irish registration, drawn as the plate itself.
 *
 * The plate is the one detail a host checks at the barrier, so it earns being
 * the thing it is rather than another `12 D 12345` in a row of grey values.
 * Full width of whatever holds it, with the registration centred in the space
 * left of the band — that centring is what makes it read as a plate instead of
 * a labelled field with a blue square on the end.
 *
 * (2 callers: the confirm page and the booking summary it replaced.)
 */
export function RegPlate({ value }: { value: string }) {
  return (
    <View style={styles.plate}>
      {/* #3D6FB6 is the EU band blue — a real-world constant, not a brand
          colour, so it stays literal rather than moving into the palette. */}
      <View style={styles.plateBand}>
        <Text style={styles.plateBandText}>IRL</Text>
      </View>
      <View style={styles.plateBody}>
        <Text style={styles.plateNumber} numberOfLines={1} adjustsFontSizeToFit>
          {value.toUpperCase()}
        </Text>
      </View>
    </View>
  );
}

/**
 * A static screen header: back, title, optional trailing slot, closed by a
 * rule. For screens that are pushed rather than scrolled into — a detail page
 * behind a list.
 *
 * (2 callers: the reviews screen and booking detail. Below the three-caller
 * bar, extracted early because both were hand-rolling the identical thing and
 * the host booking screen is queued behind them.)
 */
export function PageHeader({
  title,
  onBack,
  trailing,
  align = "center",
}: {
  title: string;
  onBack: () => void;
  trailing?: React.ReactNode;
  /**
   * Centred reads as a section you drilled into; left reads as a record with
   * its own identity. Records use left, and give the trailing slot something
   * to say.
   */
  align?: "center" | "left";
}) {
  return (
    <View style={styles.pageHeader}>
      <Pressable
        style={styles.pageHeaderBack}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <ArrowLeft size={20} color={INK} strokeWidth={2.2} />
      </Pressable>
      <Text
        style={[styles.pageHeaderTitle, align === "left" && styles.pageHeaderTitleLeft]}
        numberOfLines={1}
      >
        {title}
      </Text>
      {/* Balances the back button so a centred title stays optically centred;
          a left-aligned one hands the space to whatever the record needs. */}
      <View style={[styles.pageHeaderTrailing, align === "left" && styles.pageHeaderTrailingAuto]}>
        {trailing}
      </View>
    </View>
  );
}

/**
 * The scroll-driven header both pages share: a white bar that fades in, then a
 * title that follows it. The one component with a caller on each page, which
 * is why it is the kit's centrepiece rather than an afterthought.
 *
 * `barRange` and `titleRange` are scroll offsets. They differ per page — the
 * listing waits for a hero, the review page does not — so they are arguments
 * rather than constants.
 */
export function useScrollHeader({
  barRange,
  titleRange,
  listener,
}: {
  barRange: [number, number];
  titleRange: [number, number];
  /**
   * Optional JS-side observer. The listing drives hero physics off the same
   * value and needs to know when the sheet has covered the photo; the native
   * driver still handles the fades.
   */
  listener?: (event: { nativeEvent: { contentOffset: { y: number } } }) => void;
}) {
  const scrollY = useRef(new Animated.Value(0)).current;
  return {
    scrollY,
    /** Pass to Animated.ScrollView's onScroll. */
    onScroll: Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
      useNativeDriver: true,
      listener,
    }),
    barOpacity: scrollY.interpolate({
      inputRange: barRange,
      outputRange: [0, 1],
      extrapolate: "clamp",
    }),
    // Lags the bar deliberately: the title only appears once the page's own
    // title has scrolled away, so the two are never on screen together.
    titleOpacity: scrollY.interpolate({
      inputRange: titleRange,
      outputRange: [0, 1],
      extrapolate: "clamp",
    }),
  };
}

export function ScrollHeader({
  title,
  topInset,
  barOpacity,
  titleOpacity,
  insetLeft = 68,
  insetRight = 68,
  titleCentre = 28,
}: {
  title: string;
  topInset: number;
  barOpacity: Animated.AnimatedInterpolation<number>;
  titleOpacity: Animated.AnimatedInterpolation<number>;
  /**
   * Clearance for the controls, per side — they are rarely symmetrical. The
   * listing has one button left and two right, and a shared value put a long
   * title under the share icon.
   */
  insetLeft?: number;
  insetRight?: number;
  /**
   * Where the title's optical centre sits below the safe area, which has to be
   * the centre line of the screen's own controls or the title rides high next
   * to them. This was a fixed `top` and could not know: the listing floats a
   * 40pt button at +12 (centre 32) while the review page puts a 24pt arrow at
   * +8 (centre 20), so one number was always wrong for someone. The default is
   * the bar's own middle.
   */
  titleCentre?: number;
}) {
  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[styles.headerBar, { height: topInset + 56, opacity: barOpacity }]}
      />
      {/* Centred inside a band twice the target's depth rather than offset by
          half a line height — that way the text sits on the centre line
          whatever the font metrics do, which iOS and Android disagree about. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.headerTitleBand,
          {
            top: topInset,
            height: titleCentre * 2,
            left: insetLeft,
            right: insetRight,
            opacity: titleOpacity,
          },
        ]}
      >
        <Text numberOfLines={1} style={styles.headerTitle}>
          {title}
        </Text>
      </Animated.View>
    </>
  );
}


/**
 * Status, in one shape for the whole app. Sixteen screens show a state of some
 * kind; two components would be two things to drift, so a paused listing and a
 * cancelled booking are the same pill in different tones.
 *
 * Tones are roles, not colours — "danger" not "red" — so a palette change is
 * one edit here rather than a search across screens.
 */
export type StatusTone = "neutral" | "positive" | "warning" | "danger" | "info";

const STATUS_TONES: Record<StatusTone, { bg: string; fg: string }> = {
  neutral: { bg: PILL, fg: MUTED },
  positive: { bg: colors.status.confirmed.background, fg: colors.status.confirmed.text },
  warning: { bg: colors.status.pending.background, fg: colors.status.pending.text },
  danger: { bg: colors.status.canceled.background, fg: colors.status.canceled.text },
  info: { bg: colors.status.refunded.background, fg: colors.status.refunded.text },
};

export function StatusPill({
  label,
  tone = "neutral",
  icon: Icon,
  dot = false,
}: {
  label: string;
  tone?: StatusTone;
  /** A glyph naming the state — preferred over a dot where one exists. */
  icon?: LucideIcon;
  /** A leading dot, for live states with no glyph of their own. */
  dot?: boolean;
}) {
  const { bg, fg } = STATUS_TONES[tone];
  return (
    <View style={[styles.statusPill, { backgroundColor: bg }]}>
      {Icon ? <Icon size={15} color={fg} strokeWidth={2} /> : null}
      {!Icon && dot ? <View style={[styles.statusDot, { backgroundColor: fg }]} /> : null}
      <Text style={[styles.statusPillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

/**
 * The empty state. Seven screens hand-roll one today, all with the same three
 * parts — tinted circle, title, explanation — and none quite matching.
 *
 * `hint` is not optional by accident: a title alone states a fact and leaves
 * the person stuck. The hint is where you say what to do about it.
 */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  actionLabel,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  hint: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon size={22} color={GREEN} strokeWidth={1.8} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyHint}>{hint}</Text>
      {actionLabel && onAction ? (
        <View style={styles.emptyAction}>
          <PillButton label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * Initial avatar. Four screens colour these; all should agree, so the fill is
 * derived from the name rather than passed in — the same person is the same
 * colour everywhere.
 */
export function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  const initial = (name.trim().charAt(0) || "?").toUpperCase();
  const fill = colors.avatarFills[(name.charCodeAt(0) || 0) % colors.avatarFills.length];
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: fill },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: Math.round(size * 0.4) }]}>{initial}</Text>
    </View>
  );
}

/** A tinted label with an optional glyph. Facts, not actions. */
export function Chip({
  label,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  icon?: LucideIcon;
  tone?: "neutral" | "accent";
}) {
  const accent = tone === "accent";
  return (
    <View style={[styles.chip, accent && styles.chipAccent]}>
      {Icon ? (
        <Icon size={16} color={accent ? colors.pageAccentDark : INK} strokeWidth={1.8} />
      ) : null}
      <Text style={[styles.chipText, accent && styles.chipAccentText]}>{label}</Text>
    </View>
  );
}

/**
 * The record card — a booking or a listing in a list. Borderless on white with
 * a hairline between rows, matching the listing page: six screens box these
 * today, and the boxes are what make the tabs look like different apps.
 */
export function RecordCard({
  children,
  onPress,
  first = false,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  /** Suppresses the top rule so a list doesn't open with one. */
  first?: boolean;
}) {
  const Container = onPress ? Pressable : View;
  return (
    <>
      {first ? null : <View style={styles.recordDivider} />}
      <Container style={styles.record} onPress={onPress}>
        {children}
      </Container>
    </>
  );
}

/**
 * A text input with its action beside it — a promo code, a reference, anything
 * short that is typed and submitted in place.
 *
 * Exists because three screen budgets crept upward for the same reason: an
 * input, its button and its error line are three sizes each screen was
 * declaring itself.
 */
export function Field({
  value,
  onChangeText,
  placeholder,
  actionLabel,
  onAction,
  busy = false,
  error,
  autoCapitalize = "none",
}: {
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  actionLabel?: string;
  onAction?: () => void;
  busy?: boolean;
  error?: string | null;
  autoCapitalize?: "none" | "characters" | "words";
}) {
  return (
    <View>
      <View style={styles.fieldRow}>
        <TextInput
          style={styles.fieldInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={MUTED}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={onAction}
        />
        {actionLabel && onAction ? (
          <Pressable
            style={styles.fieldAction}
            onPress={onAction}
            disabled={busy || !value.trim()}
            accessibilityRole="button"
          >
            <Text style={styles.fieldActionLabel}>{busy ? "Checking…" : actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

/**
 * A blocking problem, stated where the person is rather than on a screen of
 * its own — a failed payment, a slot that went while they were deciding.
 *
 * Always carries an action when one exists. A notice that only describes a
 * problem leaves someone stuck with it.
 */
export function Notice({
  message,
  actionLabel,
  onAction,
  tone = "danger",
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: "danger" | "warning";
}) {
  const fg =
    tone === "danger" ? colors.status.canceled.text : colors.status.pending.text;
  const bg =
    tone === "danger"
      ? colors.status.canceled.background
      : colors.status.pending.background;
  return (
    <View style={[styles.notice, { backgroundColor: bg }]}>
      <AlertCircle size={18} color={fg} strokeWidth={2} />
      <View style={styles.noticeCopy}>
        <Text style={[styles.noticeText, { color: fg }]}>{message}</Text>
        {actionLabel && onAction ? (
          <Pressable onPress={onAction} accessibilityRole="button">
            <Text style={[styles.noticeAction, { color: fg }]}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Label left, value right, closed by a rule — what a record's Details section
 * is made of. Four callers on the booking detail alone.
 *
 * `last` drops the rule so a list doesn't end on one.
 */
export function DataRow({
  label,
  value,
  valueNode,
  last = false,
}: {
  label: string;
  value?: string;
  valueNode?: React.ReactNode;
  last?: boolean;
}) {
  return (
    <View style={[styles.dataRow, last && styles.dataRowLast]}>
      <Text style={styles.dataLabel}>{label}</Text>
      {valueNode ?? <Text style={styles.dataValue}>{value}</Text>}
    </View>
  );
}

/** The committing action: full width, ink, pill. One per screen at most. */
export function PrimaryButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[styles.primary, disabled && styles.primaryDisabled]}
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      <Text style={styles.primaryLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rule: { height: 1, backgroundColor: RULE, marginVertical: 28, marginHorizontal: GUTTER },
  ruleTight: { marginVertical: 18 },

  sectionBlock: {
    flexDirection: "row", alignItems: "baseline", gap: 12,
    paddingHorizontal: GUTTER, paddingBottom: 12,
  },
  sectionTitle: { flex: 1, minWidth: 0 },
  sectionAction: {
    flexShrink: 0, fontFamily: "PlusJakartaSans-SemiBold", fontSize: 15, color: GREEN,
  },

  pill: {
    marginHorizontal: GUTTER, backgroundColor: PILL, borderRadius: 8,
    height: 46, alignItems: "center", justifyContent: "center",
  },
  pillLabel: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 16, color: INK },

  listRow: { flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 12 },
  listIcon: { width: 20, flexShrink: 0, alignItems: "center" },
  listLabel: { flex: 1 },

  factRow: { flexDirection: "row", alignItems: "flex-start", gap: 16, paddingVertical: 12 },
  factIcon: { paddingTop: 2 },
  factCopy: { flex: 1, minWidth: 0 },
  factTitle: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 15, color: INK },
  factLine: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 15, lineHeight: 21,
    color: MUTED, marginTop: 1,
  },
  factChevron: { marginTop: 2 },

  reviewRow: { flexDirection: "row", alignItems: "flex-start", gap: 14, padding: 18 },
  // The footer supplies the bottom padding when there is one.
  reviewRowWithFooter: { paddingBottom: 0 },
  reviewFooter: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 18 },
  reviewCopy: { flex: 1, minWidth: 0 },
  reviewLabel: { fontFamily: "PlusJakartaSans-Bold", fontSize: 17, color: INK },
  reviewAction: {
    flexShrink: 0, backgroundColor: PILL, borderRadius: 8,
    paddingHorizontal: 26, paddingVertical: 14,
  },
  reviewActionLabel: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 16, color: INK },

  pageHeader: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: space.lg, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: RULE,
  },
  pageHeaderBack: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  pageHeaderTitle: {
    flex: 1, textAlign: "center",
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 17, color: INK,
  },
  pageHeaderTitleLeft: { textAlign: "left", marginLeft: 4 },
  pageHeaderTrailing: { width: 38, alignItems: "flex-end" },
  pageHeaderTrailingAuto: { width: "auto" },

  headerBar: {
    position: "absolute", top: 0, left: 0, right: 0, zIndex: 2,
    backgroundColor: WHITE,
    borderBottomWidth: 1, borderBottomColor: RULE,
  },
  headerTitleBand: { position: "absolute", zIndex: 3, justifyContent: "center" },
  headerTitle: {
    textAlign: "center",
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 17, lineHeight: 24, color: INK,
    // Android pads the line box above the glyphs, which is the same 2-3pt of
    // apparent misalignment this band exists to remove.
    includeFontPadding: false,
  },

  // Fully rounded, not a radius-8 chip: a state is a badge, and the round
  // form is what separates it from the chips and buttons around it.
  statusPill: {
    flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 7,
    borderRadius: radii.round, paddingHorizontal: 14, paddingVertical: 6,
  },
  statusDot: { width: 6, height: 6, borderRadius: radii.round },
  statusPillText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 14 },

  empty: { alignItems: "center", paddingHorizontal: GUTTER, paddingTop: 40 },
  emptyIcon: {
    width: 48, height: 48, borderRadius: radii.round,
    backgroundColor: colors.pageAccentSoft,
    alignItems: "center", justifyContent: "center", marginBottom: space.md,
  },
  emptyTitle: {
    fontFamily: "PlusJakartaSans-Bold", fontSize: 16, color: INK, textAlign: "center",
  },
  emptyHint: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 15, lineHeight: 21,
    color: MUTED, textAlign: "center", marginTop: space.xs,
  },
  emptyAction: { alignSelf: "stretch", marginTop: space.xl },

  avatar: { alignItems: "center", justifyContent: "center", flexShrink: 0 },
  avatarText: { fontFamily: "PlusJakartaSans-Bold", color: INK },

  chip: {
    flexDirection: "row", alignItems: "center", gap: 7,
    backgroundColor: PILL, borderRadius: radii.field,
    paddingHorizontal: space.lg, paddingVertical: 9,
  },
  chipAccent: { backgroundColor: colors.pageAccentSoft },
  chipText: { fontFamily: "PlusJakartaSans-Regular", fontSize: 15, color: INK },
  chipAccentText: { fontFamily: "PlusJakartaSans-SemiBold", color: colors.pageAccentDark },

  record: { paddingHorizontal: GUTTER, paddingVertical: 18 },
  recordDivider: { height: 1, backgroundColor: RULE, marginHorizontal: GUTTER },

  fieldRow: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.sm },
  fieldInput: {
    flex: 1, backgroundColor: PILL, borderRadius: radii.control,
    paddingHorizontal: space.lg, paddingVertical: space.md,
    fontFamily: "PlusJakartaSans-Regular", fontSize: 16, color: INK,
  },
  fieldAction: {
    flexShrink: 0, backgroundColor: PILL, borderRadius: radii.control,
    paddingHorizontal: space.xl, paddingVertical: 13,
  },
  fieldActionLabel: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 16, color: INK },
  fieldError: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 15,
    color: colors.status.canceled.text, marginTop: space.sm,
  },

  notice: {
    flexDirection: "row", alignItems: "flex-start", gap: space.md,
    marginHorizontal: GUTTER, marginBottom: GUTTER,
    borderRadius: radii.surface, padding: space.lg,
  },
  noticeCopy: { flex: 1, minWidth: 0 },
  noticeText: { fontFamily: "PlusJakartaSans-Regular", fontSize: 15, lineHeight: 21 },
  noticeAction: { fontFamily: "PlusJakartaSans-Bold", fontSize: 15, marginTop: 6 },

  dataRow: {
    flexDirection: "row", alignItems: "baseline", justifyContent: "space-between",
    gap: space.xl, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: RULE,
  },
  dataRowLast: { borderBottomWidth: 0 },
  dataLabel: { fontFamily: "PlusJakartaSans-Regular", fontSize: 15, color: MUTED },
  dataValue: {
    flexShrink: 1, textAlign: "right",
    fontFamily: "PlusJakartaSans-Regular", fontSize: 15, color: INK,
  },

  plate: {
    flexDirection: "row", alignItems: "stretch",
    height: 46, borderRadius: 6, borderWidth: 1.5, borderColor: "#3D6FB6",
    overflow: "hidden", backgroundColor: WHITE,
  },
  plateBand: {
    width: 30, backgroundColor: "#3D6FB6",
    alignItems: "center", justifyContent: "flex-end", paddingBottom: 4,
  },
  plateBandText: {
    fontFamily: "PlusJakartaSans-Bold", fontSize: 9, lineHeight: 11,
    color: "#FFFFFF", letterSpacing: 0.3,
  },
  plateBody: { flex: 1, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
  // The real plate face, not a monospace stand-in — the font ships with the
  // app, so there is no reason to approximate it.
  plateNumber: {
    fontFamily: "UKNumberPlate", fontSize: 27, color: INK,
    letterSpacing: 2, textAlign: "center", includeFontPadding: false,
  },

  primary: {
    height: 56, borderRadius: radii.round, backgroundColor: INK,
    alignItems: "center", justifyContent: "center",
  },
  primaryDisabled: { opacity: 0.4 },
  primaryLabel: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 17, color: WHITE },
});
