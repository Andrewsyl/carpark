/**
 * The wizard's two selection shapes.
 *
 * Selection is a 2px ink border and nothing else — no fill, no checkmark, no
 * green wash. Green is reserved for the forward action, so a selected option
 * and the Next button never compete for the same meaning.
 *
 * Both compensate for the thicker selected border by dropping a point of
 * padding, so the tile does not grow by 2px when picked.
 */
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Check, type LucideIcon } from "lucide-react-native";
import { hostFlowColors } from "./hostFlowTheme";

/**
 * 16a's multi-select mark: a square that fills with ink when checked, never a
 * green tick. Single-select never uses one — that reads through border weight.
 */
export function Checkbox({ checked }: { checked: boolean }) {
  return (
    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
      {checked ? <Check size={15} color={hostFlowColors.cardBg} strokeWidth={3} /> : null}
    </View>
  );
}

/** The two-up wrapping grid these tiles sit in. */
export function ChoiceGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

/** A square-ish option in a two-up grid: plain glyph over a label. */
export function ChoiceTile({
  icon: Icon,
  label,
  selected,
  onPress,
  style,
}: {
  icon: LucideIcon;
  label: string;
  selected: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      style={[styles.tile, selected && styles.tileSelected, style]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Icon size={30} color={hostFlowColors.text} strokeWidth={1.6} />
      <Text style={styles.tileLabel}>{label}</Text>
    </Pressable>
  );
}

/**
 * 16a's "Add discounts" row: a grey field carrying a white bordered badge, a
 * title with a supporting line, and the checkbox mark on the right.
 *
 * The fill does the containing, so there is no outline and no selected border —
 * the mark alone says what is chosen. That is why the badge keeps a border of
 * its own: it is the one white thing on a grey ground and needs an edge.
 *
 * `single` swaps the accessibility role to radio for a pick-one list. The mark
 * stays a checkbox because that is the shape the design uses; only what
 * assistive tech is told changes.
 */
export function ChoiceOptionRow({
  badgeLabel,
  badgeIcon: BadgeIcon,
  title,
  hint,
  selected,
  onPress,
  single = false,
}: {
  badgeLabel?: string;
  badgeIcon?: LucideIcon;
  title: string;
  hint?: string;
  selected: boolean;
  onPress: () => void;
  single?: boolean;
}) {
  return (
    <Pressable
      style={styles.optionRow}
      onPress={onPress}
      accessibilityRole={single ? "radio" : "checkbox"}
      accessibilityState={{ selected, checked: selected }}
    >
      <View style={styles.optionBadge}>
        {BadgeIcon ? (
          <BadgeIcon size={22} color={hostFlowColors.text} strokeWidth={1.7} />
        ) : (
          <Text style={styles.optionBadgeLabel}>{badgeLabel}</Text>
        )}
      </View>
      <View style={styles.optionCopy}>
        <Text style={styles.optionTitle}>{title}</Text>
        {hint ? <Text style={styles.optionHint}>{hint}</Text> : null}
      </View>
      <Checkbox checked={selected} />
    </Pressable>
  );
}

/** The wrapping row the pills sit in. Gaps both ways, no column rhythm. */
export function ChoicePillGroup({ children }: { children: React.ReactNode }) {
  return <View style={styles.pillGroup}>{children}</View>;
}

/**
 * 16a's highlight pill — a rounded outline sized to its own label rather than
 * to a grid column, so a set of options reads as a sentence of choices instead
 * of a form. Icon 18/1.7 in ink, label 17/600.
 *
 * Selection is the same 2px ink border every other choice shape uses, with a
 * point of padding dropped so the pill doesn't grow when picked.
 */
export function ChoicePill({
  icon: Icon,
  label,
  selected,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.pill, selected && styles.pillSelected]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Icon size={18} color={hostFlowColors.text} strokeWidth={1.7} />
      <Text style={styles.pillLabel}>{label}</Text>
    </Pressable>
  );
}

/**
 * A settled answer, collapsed to one line with a way back into it.
 *
 * Progressive disclosure only works if what it hides stays reachable — this is
 * the "reachable" half. Two callers (the details and access steps), which is
 * below the extract-on-the-third bar; it lives here anyway because the two were
 * already drawing the identical row and a third step would have copied it.
 */
export function ChoiceSummary({
  label,
  onPress,
  leading,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  leading?: React.ReactNode;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      style={styles.summary}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${label}. Change`}
    >
      {leading}
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryChange}>Change</Text>
    </Pressable>
  );
}

/** A full-width option: title, supporting line, and an optional trailing image. */
export function ChoiceRow({
  title,
  hint,
  selected,
  onPress,
  trailing,
}: {
  title: string;
  hint?: string;
  selected: boolean;
  onPress: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <Pressable
      style={[styles.row, selected && styles.rowSelected]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
      {trailing}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: "48%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: hostFlowColors.border,
    backgroundColor: hostFlowColors.cardBg,
    paddingVertical: 24,
    paddingHorizontal: 16,
    gap: 16,
  },
  // Border weight alone. 16a never fills or ticks a selected tile, and the
  // grey wash this used to add made unpicked tiles look disabled by contrast.
  tileSelected: {
    borderWidth: 2,
    borderColor: hostFlowColors.text,
    paddingVertical: 23,
    paddingHorizontal: 15,
  },
  // 17, not the 19 of 16a's place-type grid: our labels are phrases rather than
  // single words ("Apartment / underground"), and at 19 they broke mid-word.
  tileLabel: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 17,
    lineHeight: 22,
    color: hostFlowColors.text,
  },
  /**
   * Two-up, wrapping. The column gap comes from `space-between` rather than
   * `gap`: at 48% + 48% + a 12px gap the row overflows its container by a
   * fraction of a point on narrow screens, and every tile drops to its own row.
   */
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: hostFlowColors.border,
    backgroundColor: hostFlowColors.cardBg,
    padding: 16,
  },
  rowSelected: {
    borderWidth: 2,
    borderColor: hostFlowColors.text,
    padding: 15,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: hostFlowColors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: hostFlowColors.text,
    borderColor: hostFlowColors.text,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    borderRadius: 12,
    backgroundColor: hostFlowColors.disabledBg,
    padding: 16,
  },
  optionBadge: {
    width: 56,
    height: 56,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: hostFlowColors.border,
    backgroundColor: hostFlowColors.cardBg,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  optionBadgeLabel: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 18,
    color: hostFlowColors.text,
  },
  optionCopy: { flex: 1, minWidth: 0 },
  optionTitle: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 16,
    color: hostFlowColors.text,
  },
  optionHint: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    lineHeight: 19,
    color: hostFlowColors.textMuted,
    marginTop: 2,
  },

  pillGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: hostFlowColors.border,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  pillSelected: {
    borderWidth: 2,
    borderColor: hostFlowColors.text,
    paddingVertical: 13,
    paddingHorizontal: 19,
  },
  pillLabel: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 17,
    color: hostFlowColors.text,
  },

  summary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: hostFlowColors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  summaryLabel: {
    flex: 1,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    letterSpacing: -0.2,
    color: hostFlowColors.text,
  },
  summaryChange: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    color: hostFlowColors.accent,
  },

  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 16,
    lineHeight: 21,
    color: hostFlowColors.text,
  },
  rowHint: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 15,
    lineHeight: 21,
    color: hostFlowColors.textMuted,
  },
});
