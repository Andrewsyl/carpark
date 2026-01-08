import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import DatePicker from "react-native-date-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { useListingFlow } from "./context";
import { StepProgress } from "./StepProgress";

type FlowStackParamList = {
  ListingAvailability: undefined;
  ListingPrice: undefined;
};

type Props = NativeStackScreenProps<FlowStackParamList, "ListingAvailability">;

type PickerField = "timeStart" | "timeEnd" | "dateStart" | "dateEnd";

type AvailabilityMode = "daily" | "dates" | "recurring";

export function ListingAvailabilityScreen({ navigation }: Props) {
  const { draft, setDraft } = useListingFlow();
  const [timeStart, setTimeStart] = useState(() => new Date());
  const [timeEnd, setTimeEnd] = useState(() => {
    const next = new Date();
    next.setHours(next.getHours() + 8);
    return next;
  });
  const [dateStart, setDateStart] = useState(() => new Date());
  const [dateEnd, setDateEnd] = useState(() => {
    const next = new Date();
    next.setDate(next.getDate() + 7);
    return next;
  });
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerMode, setPickerMode] = useState<"time" | "date">("time");
  const [pickerField, setPickerField] = useState<PickerField>("timeStart");
  const [weekdays, setWeekdays] = useState<string[]>([]);


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

  useEffect(() => {
    if (!availabilitySummary && draft.availability.mode !== "daily") return;
    setDraft((prev) => ({
      ...prev,
      availability: { ...prev.availability, detail: availabilitySummary },
    }));
  }, [availabilitySummary, draft.availability.mode, setDraft]);

  const detail = draft.availability.detail.trim();
  const canContinue =
    draft.availability.mode === "daily" ||
    (draft.availability.mode === "dates" && detail.length > 0) ||
    (draft.availability.mode === "recurring" && detail.length > 0);

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
      availability: { mode, detail: prev.availability.detail },
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
          </View>
        ) : null}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable
          style={[styles.primaryButton, !canContinue && styles.primaryButtonDisabled]}
          onPress={() => navigation.navigate("ListingPrice")}
          disabled={!canContinue}
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
    backgroundColor: "#f9fafb",
  },
  content: {
    padding: 18,
    paddingBottom: 140,
  },
  kicker: {
    color: "#10b981",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "700",
    marginTop: 6,
  },
  subtitle: {
    color: "#6b7280",
    fontSize: 13,
    marginTop: 6,
  },
  optionCard: {
    backgroundColor: "#ffffff",
    borderColor: "#e5e7eb",
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 12,
    padding: 16,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  optionCardActive: {
    borderColor: "#10b981",
    borderWidth: 2,
  },
  optionTitle: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
  },
  optionBody: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 6,
  },
  sectionCard: {
    backgroundColor: "#ffffff",
    borderColor: "#e5e7eb",
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 12,
    padding: 16,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  inlineRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
  },
  timePill: {
    backgroundColor: "#f8fafc",
    borderColor: "#e5e7eb",
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  timePillLabel: {
    color: "#6b7280",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  timePillValue: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 6,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  chip: {
    backgroundColor: "#f8fafc",
    borderColor: "#e5e7eb",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: "#10b981",
    borderColor: "#10b981",
  },
  chipText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#ffffff",
  },
  footer: {
    backgroundColor: "#ffffff",
    borderTopColor: "#e5e7eb",
    borderTopWidth: 1,
    padding: 16,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#10b981",
    borderRadius: 14,
    minHeight: 44,
    paddingVertical: 14,
  },
  primaryButtonDisabled: {
    backgroundColor: "#cbd5e1",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
});
