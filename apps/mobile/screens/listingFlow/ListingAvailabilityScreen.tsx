import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import DatePicker from "../../components/AdaptiveDatePicker";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Briefcase, Check, ChevronRight, Clock, SlidersHorizontal, X } from "lucide-react-native";
import { Button } from "../../components/ui";
import { useListingFlow } from "./context";
import { FlowHeader } from "./FlowHeader";
import { StepQuestion, StepSection } from "./StepQuestion";
import { hostFlowColors } from "./hostFlowTheme";
import { FlowFooter } from "./FlowFooter";
import { colors, radius, spacing } from "../../styles/theme";

type FlowStackParamList = {
  ListingAvailability: { fromReview?: boolean } | undefined;
  ListingPhotos: undefined;
  ListingReview: undefined;
};

type Props = NativeStackScreenProps<FlowStackParamList, "ListingAvailability">;

type PickerField = "timeStart" | "timeEnd";
type DayCode = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
type DayTimeRanges = Record<DayCode, { start: string; end: string }>;
type AvailabilityPreset = "always" | "working" | "custom";

const ACCENT = hostFlowColors.accent;
const FG = hostFlowColors.text;
const MUTED = hostFlowColors.textMuted;
const SOFT = hostFlowColors.textSoft;
// No card shadow: the system separates with a rule and white space.

function DayTimeReveal({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  const progress = useState(() => new Animated.Value(visible ? 1 : 0))[0];
  const previousVisible = useRef(visible);

  useEffect(() => {
    if (previousVisible.current === visible) return;
    previousVisible.current = visible;
    progress.stopAnimation();
    progress.setValue(visible ? 0 : 1);
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: 360,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, visible]);

  return (
    <Animated.View
      pointerEvents={visible ? "auto" : "none"}
      style={{
        overflow: "hidden",
        opacity: progress,
        height: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 76] }),
        marginTop: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 8] }),
      }}
    >
      {children}
    </Animated.View>
  );
}

export function ListingAvailabilityScreen({ navigation, route }: Props) {
  const { draft, setDraft } = useListingFlow();
  const fromReview = route.params?.fromReview ?? false;
  const insets = useSafeAreaInsets();
  const allDays: DayCode[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const [timeStart, setTimeStart] = useState(() =>
    draft.availability.timeStart
      ? new Date(draft.availability.timeStart)
      : new Date(new Date().setHours(0, 0, 0, 0))
  );
  const [timeEnd, setTimeEnd] = useState(() => {
    if (draft.availability.timeEnd) return new Date(draft.availability.timeEnd);
    return new Date(new Date().setHours(23, 59, 0, 0));
  });
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerField, setPickerField] = useState<PickerField>("timeStart");
  const [pickerDay, setPickerDay] = useState<DayCode | null>(null);
  const [weekdays, setWeekdays] = useState<string[]>(
    draft.availability.weekdays.length ? draft.availability.weekdays : []
  );
  const [dayTimeRanges, setDayTimeRanges] = useState<DayTimeRanges>(() => {
    const now = new Date();
    const fallbackStart = draft.availability.timeStart
      ? new Date(draft.availability.timeStart)
      : new Date(new Date().setHours(6, 0, 0, 0));
    const fallbackEnd = draft.availability.timeEnd
      ? new Date(draft.availability.timeEnd)
      : new Date(new Date().setHours(19, 0, 0, 0));
    const source = draft.availability.dayTimeRanges ?? {};
    const out = {} as DayTimeRanges;
    allDays.forEach((day) => {
      const start = source[day]?.start ? new Date(source[day].start) : fallbackStart;
      const end = source[day]?.end ? new Date(source[day].end) : fallbackEnd;
      const startForDay = new Date(now);
      startForDay.setHours(start.getHours(), start.getMinutes(), 0, 0);
      const endForDay = new Date(now);
      endForDay.setHours(end.getHours(), end.getMinutes(), 0, 0);
      out[day] = { start: startForDay.toISOString(), end: endForDay.toISOString() };
    });
    return out;
  });
  const [customVisible, setCustomVisible] = useState(false);
  const [preset, setPreset] = useState<AvailabilityPreset | null>(() => {
    // Fresh listing: no saved days means the host hasn't picked a schedule yet,
    // so start with nothing selected rather than silently defaulting a preset.
    if (!weekdays.length) return null;
    const startHour = timeStart.getHours();
    const startMinute = timeStart.getMinutes();
    const endHour = timeEnd.getHours();
    const endMinute = timeEnd.getMinutes();
    const sorted = [...weekdays].sort().join(",");
    const allSorted = [...allDays].sort().join(",");
    const workSorted = ["Mon", "Tue", "Wed", "Thu", "Fri"].sort().join(",");
    if (sorted === allSorted && startHour === 0 && startMinute === 0 && endHour === 23 && endMinute === 59) {
      return "always";
    }
    if (sorted === workSorted && startHour === 6 && startMinute === 0 && endHour === 19 && endMinute === 0) {
      return "working";
    }
    return "custom";
  });

  const formatTime = (value: Date) =>
    value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const formatDays = (days: string[]) => (days.length ? days.join(", ") : "");
  const isOvernight = (start: Date, end: Date) =>
    end.getHours() * 60 + end.getMinutes() <= start.getHours() * 60 + start.getMinutes();

  const availabilitySummary = useMemo(() => {
    if (preset === "always") return "Monday - Sunday (24 hours)";
    if (preset === "working") return "Monday - Friday (06:00 - 19:00)";
    if (!weekdays.length) return "";
    const details = weekdays
      .map((day) => {
        const code = day as DayCode;
        const range = dayTimeRanges[code];
        if (!range) return null;
        const start = new Date(range.start);
        const end = new Date(range.end);
        return `${day} ${formatTime(start)}-${formatTime(end)}${isOvernight(start, end) ? " +1" : ""}`;
      })
      .filter(Boolean)
      .join(" • ");
    return details || `${formatDays(weekdays)} (${formatTime(timeStart)} - ${formatTime(timeEnd)}${isOvernight(timeStart, timeEnd) ? " +1" : ""})`;
  }, [dayTimeRanges, preset, timeEnd, timeStart, weekdays]);

  const timeWindowValid = useMemo(() => {
    const startMinutes = timeStart.getHours() * 60 + timeStart.getMinutes();
    const endMinutes = timeEnd.getHours() * 60 + timeEnd.getMinutes();
    return endMinutes !== startMinutes;
  }, [timeEnd, timeStart]);
  const customWindowsValid = useMemo(() => {
    if (preset !== "custom") return true;
    return weekdays.every((day) => {
      const code = day as DayCode;
      const range = dayTimeRanges[code];
      if (!range) return false;
      const start = new Date(range.start);
      const end = new Date(range.end);
      const startMinutes = start.getHours() * 60 + start.getMinutes();
      const endMinutes = end.getHours() * 60 + end.getMinutes();
      return endMinutes !== startMinutes;
    });
  }, [dayTimeRanges, preset, weekdays]);

  useEffect(() => {
    if (!availabilitySummary) return;
    setDraft((prev) => ({
      ...prev,
      availability: {
        ...prev.availability,
        mode: preset === "always" ? "daily" : "recurring",
        detail: availabilitySummary,
        timeStart: timeStart.toISOString(),
        timeEnd: timeEnd.toISOString(),
        dateStart: prev.availability.dateStart,
        dateEnd: prev.availability.dateEnd,
        weekdays,
        dayTimeRanges,
      },
    }));
  }, [availabilitySummary, dayTimeRanges, preset, setDraft, timeEnd, timeStart, weekdays]);

  const canContinue = preset !== null && (preset !== "custom" || weekdays.length > 0);
  const canSave = canContinue && timeWindowValid && customWindowsValid;

  const openPicker = (field: PickerField, day: DayCode | null = null) => {
    setPickerField(field);
    setPickerDay(day);
    setPickerVisible(true);
  };

  const handlePickerConfirm = (value: Date) => {
    if (pickerDay) {
      setDayTimeRanges((prev) => {
        const current = prev[pickerDay];
        if (!current) return prev;
        const startDate = new Date(current.start);
        const endDate = new Date(current.end);
        const next = { ...prev };
        if (pickerField === "timeStart") {
          startDate.setHours(value.getHours(), value.getMinutes(), 0, 0);
          next[pickerDay] = { ...current, start: startDate.toISOString() };
        } else {
          endDate.setHours(value.getHours(), value.getMinutes(), 0, 0);
          next[pickerDay] = { ...current, end: endDate.toISOString() };
        }
        return next;
      });
      return;
    }
    if (pickerField === "timeStart") {
      setTimeStart(value);
    } else {
      setTimeEnd(value);
    }
  };

  const toggleWeekday = (day: string) => {
    setWeekdays((prev) => {
      const exists = prev.includes(day);
      if (exists) {
        return prev.filter((item) => item !== day);
      }
      setDayTimeRanges((currentRanges) => {
        const dayIndex = allDays.indexOf(day as DayCode);
        const previousSelectedDay =
          [...prev]
            .sort((a, b) => allDays.indexOf(a as DayCode) - allDays.indexOf(b as DayCode))
            .filter((selectedDay) => allDays.indexOf(selectedDay as DayCode) < dayIndex)
            .at(-1) ??
          prev.at(-1) ??
          null;
        if (!previousSelectedDay) return currentRanges;
        const previousRange = currentRanges[previousSelectedDay as DayCode];
        if (!previousRange) return currentRanges;
        return { ...currentRanges, [day]: { start: previousRange.start, end: previousRange.end } };
      });
      return [...prev, day];
    });
  };

  // Preserve a hand-built custom schedule when the host taps a preset to peek at
  // it. Without this, tapping "Always" then "Custom" wiped their days and times
  // with no way back — exploration shouldn't be destructive.
  const customScheduleRef = useRef<{ weekdays: string[]; dayTimeRanges: DayTimeRanges } | null>(null);
  // Snapshot taken when the host opens the custom editor via "Edit" so the X can
  // cancel back to it. Confirm commits; a fresh entry from a preset has nothing
  // to revert to (snapshot cleared), so its X just closes.
  const modalSnapshotRef = useRef<{ weekdays: string[]; dayTimeRanges: DayTimeRanges } | null>(null);

  const selectPreset = (next: AvailabilityPreset) => {
    const previousPreset = preset;
    if (previousPreset === "custom" && next !== "custom" && weekdays.length > 0) {
      customScheduleRef.current = { weekdays, dayTimeRanges };
    }
    setPreset(next);
    if (next === "always") {
      const start = new Date(timeStart);
      const end = new Date(timeEnd);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 0, 0);
      setTimeStart(start);
      setTimeEnd(end);
      setWeekdays(allDays);
      setDayTimeRanges((prev) => {
        const nextRanges = { ...prev };
        allDays.forEach((day) => {
          const s = new Date(start);
          const e = new Date(end);
          nextRanges[day] = { start: s.toISOString(), end: e.toISOString() };
        });
        return nextRanges;
      });
      return;
    }
    if (next === "working") {
      const start = new Date(timeStart);
      const end = new Date(timeEnd);
      start.setHours(6, 0, 0, 0);
      end.setHours(19, 0, 0, 0);
      setTimeStart(start);
      setTimeEnd(end);
      setWeekdays(["Mon", "Tue", "Wed", "Thu", "Fri"]);
      setDayTimeRanges((prev) => {
        const nextRanges = { ...prev };
        ["Mon", "Tue", "Wed", "Thu", "Fri"].forEach((day) => {
          const s = new Date(start);
          const e = new Date(end);
          nextRanges[day as DayCode] = { start: s.toISOString(), end: e.toISOString() };
        });
        return nextRanges;
      });
      return;
    }
    if (customScheduleRef.current) {
      // Returning to Custom after visiting a preset: restore what the host built.
      setWeekdays(customScheduleRef.current.weekdays);
      setDayTimeRanges(customScheduleRef.current.dayTimeRanges);
    } else if (previousPreset !== "custom") {
      setWeekdays([]);
    }
    modalSnapshotRef.current = null;
    setCustomVisible(true);
  };

  // "Edit" on the summary card: snapshot the committed schedule so X can revert.
  const openCustomEditor = () => {
    modalSnapshotRef.current = { weekdays, dayTimeRanges };
    setCustomVisible(true);
  };
  const cancelCustomModal = () => {
    const snap = modalSnapshotRef.current;
    if (snap) {
      setWeekdays(snap.weekdays);
      setDayTimeRanges(snap.dayTimeRanges);
    }
    setCustomVisible(false);
  };
  const dayRangeInvalid = (day: DayCode) => {
    const range = dayTimeRanges[day];
    if (!range) return false;
    const start = new Date(range.start);
    const end = new Date(range.end);
    return start.getHours() * 60 + start.getMinutes() === end.getHours() * 60 + end.getMinutes();
  };

  const exitFlow = () => {
    const parent = navigation.getParent();
    if (parent?.canGoBack()) parent.goBack();
  };

  const PRESETS = [
    {
      key: "always" as const,
      label: "Always available",
      body: "Mon – Sun · 24 hours · Recommended",
      Icon: (active: boolean) => <Clock size={18} color={active ? ACCENT : SOFT} strokeWidth={2} />,
    },
    {
      key: "working" as const,
      label: "Working week",
      body: "Mon – Fri · 06:00 – 19:00",
      Icon: (active: boolean) => <Briefcase size={18} color={active ? ACCENT : SOFT} strokeWidth={2} />,
    },
    {
      key: "custom" as const,
      label: "Custom",
      body: "Choose your own days and times",
      Icon: (active: boolean) => <SlidersHorizontal size={18} color={active ? ACCENT : SOFT} strokeWidth={2} />,
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <FlowHeader current={6} onClose={exitFlow} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header card */}
        <StepQuestion
            title={"Set when your space is available"}
          />

        {/* Schedule card */}
        <View style={styles.section}>
          <StepSection title="Schedule" />
          {PRESETS.map(({ key, label, body, Icon }, idx) => {
            const active = preset === key;
            const isLast = idx === PRESETS.length - 1;
            const isCustom = key === "custom";
            return (
              <Pressable
                key={key}
                style={[styles.optionRow, !isLast && styles.optionRowBorder, active && styles.optionRowActive]}
                onPress={() => selectPreset(key)}
              >
                <View style={styles.optionIconBox}>{Icon(active)}</View>
                <View style={styles.optionTextWrap}>
                  {/* Selection is carried by the row's border and its check —
                      nothing happens to the label. */}
                  <Text style={styles.optionTitle}>{label}</Text>
                  <Text style={styles.optionBody}>{body}</Text>
                </View>
                {active
                  ? <Check size={20} color={hostFlowColors.text} strokeWidth={2.4} />
                  : isCustom
                  ? <ChevronRight size={18} color={SOFT} strokeWidth={2.4} />
                  : null}
              </Pressable>
            );
          })}
        </View>

        {/* Custom summary card */}
        {preset === "custom" && weekdays.length > 0 ? (
          <View style={styles.customSummaryCard}>
            <Text style={styles.customSummaryLabel}>Selected schedule</Text>
            <Text style={styles.customSummary}>{availabilitySummary}</Text>
            <Pressable onPress={openCustomEditor}>
              <Text style={styles.customEditLink}>Edit →</Text>
            </Pressable>
          </View>
        ) : null}

        {!timeWindowValid || !customWindowsValid ? (
          <Text style={styles.warningText}>Start and end times can't be the same.</Text>
        ) : null}
      </ScrollView>

      <FlowFooter
        current={6}
        total={9}
        onBack={() => (fromReview ? navigation.navigate("ListingReview") : navigation.goBack())}
        primaryLabel={fromReview ? "Save changes" : "Continue"}
        onPrimary={() => navigation.navigate(fromReview ? "ListingReview" : "ListingPhotos")}
        primaryDisabled={!canSave}
      />

      {customVisible ? (
        <Modal animationType="slide" transparent>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { paddingBottom: Math.max(18, insets.bottom + 12) }]}>
              <View style={styles.modalHeader}>
                <Pressable onPress={cancelCustomModal} style={styles.iconButton}>
                  <X size={20} color={colors.text} strokeWidth={2.2} />
                </Pressable>
                <Text style={styles.modalTitle}>Set your custom availability</Text>
                <View style={styles.iconButton} />
              </View>
              <Text style={styles.modalSubtitle}>
                Choose the days and times that you would like to make your space available.
              </Text>
              {weekdays.some((day) => {
                const range = dayTimeRanges[day as DayCode];
                return range && isOvernight(new Date(range.start), new Date(range.end));
              }) ? (
                <Text style={styles.overnightNote}>
                  An end time earlier than the start runs into the next morning (shown as +1).
                </Text>
              ) : null}
              <ScrollView contentContainerStyle={styles.dayList}>
                {allDays.map((day) => {
                  const enabled = weekdays.includes(day);
                  return (
                    <View key={day} style={styles.dayBlock}>
                      <Pressable
                        accessibilityRole="switch"
                        accessibilityState={{ checked: enabled }}
                        onPress={() => toggleWeekday(day)}
                        style={styles.dayRow}
                      >
                        <Text style={styles.dayLabel}>
                          {{ Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" }[day]}
                        </Text>
                        <View style={[styles.dayToggleTrack, enabled && styles.dayToggleTrackActive]}>
                          <View style={[styles.dayToggleKnob, enabled && styles.dayToggleKnobActive]} />
                        </View>
                      </Pressable>
                      <DayTimeReveal visible={enabled}>
                        <View style={styles.dayTimeRow}>
                          <Pressable style={styles.timePill} onPress={() => openPicker("timeStart", day)}>
                            <Text style={styles.timePillLabel}>Start</Text>
                            <Text style={styles.timePillValue}>{formatTime(new Date(dayTimeRanges[day].start))}</Text>
                          </Pressable>
                          <Pressable style={styles.timePill} onPress={() => openPicker("timeEnd", day)}>
                            <Text style={styles.timePillLabel}>End</Text>
                            <Text style={styles.timePillValue}>
                              {isOvernight(new Date(dayTimeRanges[day].start), new Date(dayTimeRanges[day].end))
                                ? `${formatTime(new Date(dayTimeRanges[day].end))} +1`
                                : formatTime(new Date(dayTimeRanges[day].end))}
                            </Text>
                          </Pressable>
                        </View>
                      </DayTimeReveal>
                      {enabled && dayRangeInvalid(day) ? (
                        <Text style={styles.dayWarning}>Start and end times can't be the same</Text>
                      ) : null}
                    </View>
                  );
                })}
              </ScrollView>
              <Button
                title="Confirm"
                onPress={() => { setPreset("custom"); modalSnapshotRef.current = null; setCustomVisible(false); }}
                disabled={weekdays.length === 0}
              />
            </View>
          </View>
        </Modal>
      ) : null}

      <DatePicker
        modal
        mode="time"
        open={pickerVisible}
        minuteInterval={5}
        date={
          pickerDay
            ? new Date(pickerField === "timeStart" ? dayTimeRanges[pickerDay].start : dayTimeRanges[pickerDay].end)
            : pickerField === "timeStart" ? timeStart : timeEnd
        }
        onConfirm={(value) => {
          setPickerVisible(false);
          handlePickerConfirm(value);
          setPickerDay(null);
        }}
        onCancel={() => {
          setPickerVisible(false);
          setPickerDay(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: hostFlowColors.bg },
  content: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 140,
    gap: 14,
  },

  // ── Header card (matches location screen style) ──────────────

  // ── Schedule card ────────────────────────────────────────────
  section: { paddingTop: 24 },
  optionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  optionRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: hostFlowColors.border,
  },
  // Border weight alone, and a radius: without one the 2px border drew a square
  // band across the full width. Padding drops to hold the row's size steady.
  optionRowActive: {
    borderWidth: 2,
    borderColor: hostFlowColors.text,
    borderRadius: 12,
    borderBottomColor: hostFlowColors.text,
    paddingHorizontal: 15,
    paddingVertical: 15,
  },
  // A plain glyph, not a boxed one: 16a puts no frame around its icons, and the
  // framed version put a second selected-looking border inside the selected row.
  optionIconBox: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  optionTextWrap: { flex: 1 },
  optionTitle: {
    color: FG,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  optionBody: {
    color: MUTED,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },

  // ── Custom summary ───────────────────────────────────────────
  customSummaryCard: {
    backgroundColor: hostFlowColors.accentSoft,
    borderColor: ACCENT,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  customSummaryLabel: {
    color: ACCENT,
    fontSize: 11,
    fontFamily: "PlusJakartaSans-Bold",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  customSummary: {
    color: FG,
    fontSize: 14,
    fontFamily: "PlusJakartaSans-SemiBold",
    lineHeight: 22,
  },
  customEditLink: {
    color: ACCENT,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14,
    marginTop: 8,
  },
  warningText: {
    color: colors.danger,
    fontSize: 12,
    fontFamily: "PlusJakartaSans-SemiBold",
  },

  // ── Tips card ────────────────────────────────────────────────

  // ── Modal ────────────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "flex-end",
  },
  modalCard: {
    maxHeight: "92%",
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: spacing.screenX,
    paddingTop: 14,
    paddingBottom: 14,
  },
  modalHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  iconButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    flex: 1,
    textAlign: "center",
    color: colors.text,
    fontSize: 17,
    fontFamily: "PlusJakartaSans-ExtraBold",
    paddingHorizontal: 8,
    letterSpacing: -0.5,
  },
  modalSubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    fontFamily: "PlusJakartaSans-Regular",
    marginTop: 8,
    lineHeight: 22,
    marginBottom: 6,
  },
  overnightNote: {
    color: colors.textSoft,
    fontSize: 12,
    fontFamily: "PlusJakartaSans-Regular",
    lineHeight: 17,
    marginBottom: 4,
  },
  dayList: {
    paddingBottom: 10,
  },
  dayBlock: {
    marginTop: 10,
  },
  dayRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dayLabel: {
    color: colors.text,
    fontSize: 15,
    fontFamily: "PlusJakartaSans-Bold",
    letterSpacing: -0.1,
  },
  dayToggleTrack: {
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    height: 22,
    padding: 2,
    width: 40,
  },
  dayToggleTrackActive: {
    backgroundColor: colors.accent,
  },
  dayToggleKnob: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.pill,
    height: 18,
    width: 18,
  },
  dayToggleKnobActive: {
    marginLeft: 18,
  },
  dayWarning: {
    color: colors.status.pending.text,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 12,
    marginTop: 8,
    paddingHorizontal: 2,
  },
  dayTimeRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 2,
  },
  timePill: {
    backgroundColor: colors.cardBgMuted,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  timePillLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: "PlusJakartaSans-Bold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  timePillValue: {
    color: colors.text,
    fontSize: 15,
    fontFamily: "PlusJakartaSans-ExtraBold",
    marginTop: 3,
    letterSpacing: -0.3,
  },
});
