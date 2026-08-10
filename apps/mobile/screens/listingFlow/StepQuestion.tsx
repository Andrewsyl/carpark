/**
 * The question at the top of every wizard step.
 *
 * 16a gives each step exactly one 29px ask, optionally with a line of support
 * under it. No kicker, no icon, no card — the question IS the header.
 */
import { StyleSheet, Text, View } from "react-native";
import { hostFlowColors } from "./hostFlowTheme";

export function StepQuestion({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

/** The inset rule dividing a step's sections. */
export function StepRule() {
  return <View style={styles.rule} />;
}

/** A sub-heading within a step, with an optional supporting line. */
export function StepSection({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // No gutter of its own. In 16a the 24px inset belongs to the step's content
  // container, so everything in the step shares one left edge; when this owned
  // its own padding the question sat 24px further in than the options under it.
  wrap: {},
  title: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 29,
    lineHeight: 35,
    letterSpacing: -0.6,
    color: hostFlowColors.text,
  },
  hint: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 16,
    lineHeight: 22,
    color: hostFlowColors.textMuted,
    marginTop: 10,
  },
  rule: {
    height: 1,
    backgroundColor: hostFlowColors.border,
    marginVertical: 28,
  },
  section: {},
  sectionTitle: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 18,
    lineHeight: 23,
    color: hostFlowColors.text,
  },
  sectionHint: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 15,
    lineHeight: 21,
    color: hostFlowColors.textMuted,
    marginTop: 2,
  },
});
