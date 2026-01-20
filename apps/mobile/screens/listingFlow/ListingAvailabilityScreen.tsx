import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import DatePicker from "react-native-date-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { useListingFlow } from "./context";
import { StepProgress } from "./StepProgress";
import { cardShadow, colors, radius, spacing, textStyles } from "../../styles/theme";

type FlowStackParamList = {
  ListingAvailability: undefined;
  ListingPrice: undefined;
};

type Props = NativeStackScreenProps<FlowStackParamList, "ListingAvailability">;

type PickerField = "timeStart" | "timeEnd" | "dateStart" | "dateEnd";

type AvailabilityMode = "daily" | "dates" | "recurring";

export function ListingAvailabilityScreen({ navigation }: Props) {
  const { draft, setDraft } = useListingFlow();
  const [timeStart, setTimeStart] = useState(() =>
    draft.availability.timeStart
      ? new Date(draft.availability.timeStart)
      : new Date(new Date().setHours(0, 0, 0, 0))
  );
  const [timeEnd, setTimeEnd] = useState(() => {
    if (draft.availability.timeEnd) return new Date(draft.availability.timeEnd);
    return new Date(new Date().setHours(23, 59, 0, 0));
  });
  const [dateStart, setDateStart] = useState(() =>
    draft.availability.dateStart ? new Date(draft.availability.dateStart) : new Date()
  );
  const [dateEnd, setDateEnd] = useState(() => {
    if (draft.availability.dateEnd) return new Date(draft.availability.dateEnd);
    const next = new Date();
    next.setDate(next.getDate() + 7);
    return next;
  });
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerMode, setPickerMode] = useState<"time" | "date">("time");
  const [pickerField, setPickerField] = useState<PickerField>("timeStart");
  const [weekdays, setWeekdays] = useState<string[]>(
    draft.availability.weekdays.length ? draft.availability.weekdays : []
  );


  const formatTime = (value: Date) =>
    value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const formatDate = (value: Date) =>
    value.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  const formatDays = (days: string[]) => (days.length ? days.join(", ") : "");

  const availabilitySummary = useMemo(() => {
    if (draft.availability.mode === "daily") {
      return `Every day • ${formatTime(timeStart)}–${formatTime(timeEnd)}`;
    }
    if (draft.availability.mode === "dates") {
      return `${formatDate(dateStart)} → ${formatDate(dateEnd)} • ${formatTime(
        timeStart
      )}–${formatTime(timeEnd)}`;
    }
    if (draft.availability.mode === "recurring") {
      if (!weekdays.length) return "";
      return `${formatDays(weekdays)} • ${formatTime(timeStart)}–${formatTime(timeEnd)}`;
    }
    return "";
  }, [dateEnd, dateStart, draft.availability.mode, timeEnd, timeStart, weekdays]);

  const timeWindowValid = useMemo(() => {
    const startMinutes = timeStart.getHours() * 60 + timeStart.getMinutes();
    const endMinutes = timeEnd.getHours() * 60 + timeEnd.getMinutes();
    return endMinutes > startMinutes;
  }, [timeEnd, timeStart]);

  const isAllDay =
    timeStart.getHours() === 0 &&
    timeStart.getMinutes() === 0 &&
    timeEnd.getHours() === 23 &&
    timeEnd.getMinutes() === 59;

  const toggleAllDay = () => {
    if (isAllDay) {
      const start = new Date(timeStart);
      const end = new Date(timeEnd);
      start.setHours(8, 0, 0, 0);
      end.setHours(18, 0, 0, 0);
      setTimeStart(start);
      setTimeEnd(end);
      return;
    }
    const start = new Date(timeStart);
    const end = new Date(timeEnd);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 0, 0);
    setTimeStart(start);
    setTimeEnd(end);
  };

  useEffect(() => {
    if (!availabilitySummary && draft.availability.mode !== "daily") return;
    setDraft((prev) => ({
      ...prev,
      availability: {
        ...prev.availability,
        detail: availabilitySummary,
        timeStart: timeStart.toISOString(),
        timeEnd: timeEnd.toISOString(),
        dateStart: dateStart.toISOString(),
        dateEnd: dateEnd.toISOString(),
        weekdays,
      },
    }));
  }, [availabilitySummary, dateEnd, dateStart, draft.availability.mode, setDraft, timeEnd, timeStart, weekdays]);

  const detail = draft.availability.detail.trim();
  const canContinue =
    draft.availability.mode === "daily" ||
    (draft.availability.mode === "dates" && detail.length > 0) ||
    (draft.availability.mode === "recurring" && detail.length > 0);
  const canSave = canContinue && timeWindowValid;

  const openPicker = (field: PickerField) => {
    setPickerField(field);
    setPickerMode(field === "dateStart" || field === "dateEnd" ? "date" : "time");
    setPickerVisible(true);
  };

  const handlePickerConfirm = (value: Date) => {
    if (pickerField === "timeStart") {
      setTimeStart(value);
    } else if (pickerField === "timeEnd") {
      setTimeEnd(value);
    } else if (pickerField === "dateStart") {
      setDateStart(value);
      if (value > dateEnd) {
        const bump = new Date(value);
        bump.setDate(bump.getDate() + 1);
        setDateEnd(bump);
      }
    } else {
      setDateEnd(value);
    }
  };

  const toggleWeekday = (day: string) => {
    setWeekdays((prev) => (prev.includes(day) ? prev.filter((item) => item !== day) : [...prev, day]));
  };


  const setMode = (mode: AvailabilityMode) => {
    setDraft((prev) => ({
      ...prev,
      availability: { ...prev.availability, mode },
    }));
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>Availability</Text>
        <StepProgress current={4} total={7} />
        <Text style={styles.title}>When is your space available?</Text>
        <Text style={styles.subtitle}>Pick the dates and time window drivers can book.</Text>

        <Pressable
          style={[styles.optionCard, draft.availability.mode === "daily" && styles.optionCardActive]}
          onPress={() => setMode("daily")}
        >
          <Text style={styles.optionTitle}>Available every day</Text>
          <Text style={styles.optionBody}>Drivers can book any day with a fixed time window.</Text>
        </Pressable>
        {draft.availability.mode === "daily" ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Daily hours</Text>
            <View style={styles.toggleRow}>
              <Pressable
                style={[styles.toggleChip, isAllDay && styles.toggleChipActive]}
                onPress={toggleAllDay}
              >
                <Text style={[styles.toggleChipText, isAllDay && styles.toggleChipTextActive]}>
                  24/7
                </Text>
              </Pressable>
              <Text style={styles.toggleHint}>Set full-day access</Text>
            </View>
            <View style={styles.inlineRow}>
              <Pressable style={styles.timePill} onPress={() => openPicker("timeStart")}> 
                <Text style={styles.timePillLabel}>Start</Text>
                <Text style={styles.timePillValue}>{formatTime(timeStart)}</Text>
              </Pressable>
              <Pressable style={styles.timePill} onPress={() => openPicker("timeEnd")}> 
                <Text style={styles.timePillLabel}>End</Text>
                <Text style={styles.timePillValue}>{formatTime(timeEnd)}</Text>
              </Pressable>
            </View>
            {!timeWindowValid ? (
              <Text style={styles.warningText}>End time must be after start time.</Text>
            ) : null}
          </View>
        ) : null}

        <Pressable
          style={[styles.optionCard, draft.availability.mode === "dates" && styles.optionCardActive]}
          onPress={() => setMode("dates")}
        >
          <Text style={styles.optionTitle}>Specific dates</Text>
          <Text style={styles.optionBody}>Set a date range and daily hours.</Text>
        </Pressable>
        {draft.availability.mode === "dates" ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Date range</Text>
            <View style={styles.inlineRow}>
              <Pressable style={styles.timePill} onPress={() => openPicker("dateStart")}> 
                <Text style={styles.timePillLabel}>Start date</Text>
                <Text style={styles.timePillValue}>{formatDate(dateStart)}</Text>
              </Pressable>
              <Pressable style={styles.timePill} onPress={() => openPicker("dateEnd")}> 
                <Text style={styles.timePillLabel}>End date</Text>
                <Text style={styles.timePillValue}>{formatDate(dateEnd)}</Text>
              </Pressable>
            </View>
            <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Daily hours</Text>
            <View style={styles.toggleRow}>
              <Pressable
                style={[styles.toggleChip, isAllDay && styles.toggleChipActive]}
                onPress={toggleAllDay}
              >
                <Text style={[styles.toggleChipText, isAllDay && styles.toggleChipTextActive]}>
                  24/7
                </Text>
              </Pressable>
              <Text style={styles.toggleHint}>Set full-day access</Text>
            </View>
            <View style={styles.inlineRow}>
              <Pressable style={styles.timePill} onPress={() => openPicker("timeStart")}> 
                <Text style={styles.timePillLabel}>Start</Text>
                <Text style={styles.timePillValue}>{formatTime(timeStart)}</Text>
              </Pressable>
              <Pressable style={styles.timePill} onPress={() => openPicker("timeEnd")}> 
                <Text style={styles.timePillLabel}>End</Text>
                <Text style={styles.timePillValue}>{formatTime(timeEnd)}</Text>
              </Pressable>
            </View>
            {!timeWindowValid ? (
              <Text style={styles.warningText}>End time must be after start time.</Text>
            ) : null}
          </View>
        ) : null}

        <Pressable
          style={[styles.optionCard, draft.availability.mode === "recurring" && styles.optionCardActive]}
          onPress={() => setMode("recurring")}
        >
          <Text style={styles.optionTitle}>Recurring schedule</Text>
          <Text style={styles.optionBody}>Choose days of week and times.</Text>
        </Pressable>
        {draft.availability.mode === "recurring" ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Days available</Text>
            <View style={styles.chipRow}>
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                <Pressable
                  key={day}
                  style={[styles.chip, weekdays.includes(day) && styles.chipActive]}
                  onPress={() => toggleWeekday(day)}
                >
                  <Text style={[styles.chipText, weekdays.includes(day) && styles.chipTextActive]}>
                    {day}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Hours</Text>
            <View style={styles.toggleRow}>
              <Pressable
                style={[styles.toggleChip, isAllDay && styles.toggleChipActive]}
                onPress={toggleAllDay}
              >
                <Text style={[styles.toggleChipText, isAllDay && styles.toggleChipTextActive]}>
                  24/7
                </Text>
              </Pressable>
              <Text style={styles.toggleHint}>Set full-day access</Text>
            </View>
            <View style={styles.inlineRow}>
              <Pressable style={styles.timePill} onPress={() => openPicker("timeStart")}> 
                <Text style={styles.timePillLabel}>Start</Text>
                <Text style={styles.timePillValue}>{formatTime(timeStart)}</Text>
              </Pressable>
              <Pressable style={styles.timePill} onPress={() => openPicker("timeEnd")}> 
                <Text style={styles.timePillLabel}>End</Text>
                <Text style={styles.timePillValue}>{formatTime(timeEnd)}</Text>
              </Pressable>
            </View>
            {!timeWindowValid ? (
              <Text style={styles.warningText}>End time must be after start time.</Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable
          style={[styles.primaryButton, !canSave && styles.primaryButtonDisabled]}
          onPress={() => navigation.navigate("ListingPrice")}
          disabled={!canSave}
        >
          <Text style={styles.primaryButtonText}>Save availability</Text>
        </Pressable>
      </View>
      <DatePicker
        modal
        mode={pickerMode}
        open={pickerVisible}
        minuteInterval={5}
        date={
          pickerField === "timeStart"
            ? timeStart
            : pickerField === "timeEnd"
              ? timeEnd
              : pickerField === "dateStart"
                ? dateStart
                : dateEnd
        }
        onConfirm={(value) => {
          setPickerVisible(false);
          handlePickerConfirm(value);
        }}
        onCancel={() => setPickerVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.appBg,
  },
  content: {
    padding: spacing.screenX,
    paddingBottom: 140,
    paddingTop: 0,
  },
  kicker: textStyles.kicker,
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "600",
    marginTop: 6,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 6,
    lineHeight: 20,
  },
  optionCard: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    marginTop: 12,
    padding: 16,
    ...cardShadow,
  },
  optionCardActive: {
    borderColor: colors.accent,
    borderWidth: 2,
  },
  optionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  optionBody: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 6,
    lineHeight: 18,
  },
  sectionCard: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    marginTop: 12,
    padding: 16,
    ...cardShadow,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  toggleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  toggleChip: {
    backgroundColor: colors.appBg,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  toggleChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  toggleChipText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  toggleChipTextActive: {
    color: colors.cardBg,
  },
  toggleHint: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  inlineRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
  },
  timePill: {
    backgroundColor: colors.appBg,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  timePillLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  timePillValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    marginTop: 6,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  chip: {
    backgroundColor: colors.appBg,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  chipTextActive: {
    color: colors.cardBg,
  },
  warningText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 10,
  },
  footer: {
    backgroundColor: colors.cardBg,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    padding: 16,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 14,
    minHeight: 44,
    paddingVertical: 14,
  },
  primaryButtonDisabled: {
    backgroundColor: "#cbd5e1",
  },
  primaryButtonText: {
    color: colors.cardBg,
    fontSize: 15,
    fontWeight: "600",
  },
});
