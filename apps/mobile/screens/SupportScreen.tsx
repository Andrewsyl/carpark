import { useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { sendSupportMessage } from "../api";
import { useAuth } from "../auth";
import { cardShadow, colors, radius, spacing, textStyles } from "../styles/theme";
import type { RootStackParamList } from "../types";
import { Ionicons } from "@expo/vector-icons";

type Props = NativeStackScreenProps<RootStackParamList, "Support">;

export function SupportScreen({ navigation }: Props) {
  const { token, user } = useAuth();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [menuFrame, setMenuFrame] = useState<{ top: number; left: number; width: number } | null>(
    null
  );
  const selectRef = useRef<View | null>(null);

  const subjectOptions = [
    "Booking issue",
    "Payment or refund",
    "Host payout",
    "Listing problem",
    "Account access",
    "App bug",
    "Other",
  ];

  const handleSubmit = async () => {
    if (!token) {
      setError("Please sign in to contact support.");
      return;
    }
    if (!subject) {
      setError("Please select a subject.");
      return;
    }
    if (message.trim().length < 10) {
      setError("Please include a few details (at least 10 characters).");
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await sendSupportMessage(token, { subject, message: message.trim() });
      setSuccess("Thanks! We received your message and will reply soon.");
      setSubject("");
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send message");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>Contact us</Text>
            <Text style={styles.subtitle}>
              We will reply to {user?.email ?? "your email"} as soon as we can.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.field}>
              <Text style={styles.label}>Subject</Text>
              <Pressable
                ref={selectRef}
                style={styles.select}
                onPress={() => {
                  selectRef.current?.measureInWindow((x, y, width, height) => {
                    const menuHeight = Math.min(320, subjectOptions.length * 44 + 52);
                    const spaceBelow = windowHeight - (y + height + 12);
                    const top =
                      spaceBelow >= menuHeight
                        ? y + height + 8
                        : Math.max(12, y - menuHeight - 8);
                    const left = Math.min(Math.max(12, x), windowWidth - width - 12);
                    setMenuFrame({ top, left, width });
                    setSubjectOpen(true);
                  });
                }}
                accessibilityRole="button"
              >
                <Text style={[styles.selectText, !subject && styles.selectPlaceholder]}>
                  {subject || "Select a topic"}
                </Text>
                <Text style={styles.selectChevron}>▾</Text>
              </Pressable>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Message</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={message}
                onChangeText={setMessage}
                placeholder="Tell us what happened and include any booking details."
                placeholderTextColor="#94a3b8"
                multiline
              />
            </View>
            <Pressable style={styles.primaryButton} onPress={handleSubmit} disabled={submitting}>
              <Text style={styles.primaryButtonText}>
                {submitting ? "Sending..." : "Send message"}
              </Text>
            </Pressable>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {success ? <Text style={styles.success}>{success}</Text> : null}
          </View>

          <Pressable style={styles.ghostButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
        </ScrollView>
        <Modal transparent visible={subjectOpen} animationType="fade" onRequestClose={() => setSubjectOpen(false)}>
          <View style={styles.modalBackdrop}>
            <Pressable style={styles.modalScrim} onPress={() => setSubjectOpen(false)} />
            {menuFrame ? (
              <View style={[styles.menuSheet, { top: menuFrame.top, left: menuFrame.left, width: menuFrame.width }]}>
                <Text style={styles.modalTitle}>Choose a topic</Text>
                {subjectOptions.map((option) => (
                  <Pressable
                    key={option}
                    style={({ pressed }) => [styles.optionRow, pressed && styles.optionRowPressed]}
                    onPress={() => {
                      setSubject(option);
                      setSubjectOpen(false);
                    }}
                  >
                    <Text style={styles.optionText}>{option}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.appBg,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.screenX,
    paddingBottom: 32,
    paddingTop: 24,
  },
  header: {
    marginBottom: 18,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
    marginTop: 6,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 6,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.card,
    ...cardShadow,
  },
  field: {
    marginBottom: 14,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.appBg,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.text,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    textAlignVertical: "top",
  },
  select: {
    backgroundColor: colors.appBg,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  selectPlaceholder: {
    color: colors.textSoft,
    fontWeight: "500",
  },
  selectChevron: {
    color: colors.textSoft,
    fontSize: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.2)",
  },
  modalScrim: {
    ...StyleSheet.absoluteFillObject,
  },
  menuSheet: {
    position: "absolute",
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: 16,
    ...cardShadow,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 8,
  },
  optionRow: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  optionRowPressed: {
    backgroundColor: "#f0fdf8",
  },
  optionText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  textArea: {
    minHeight: 140,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radius.card,
    paddingVertical: 12,
    marginTop: 6,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  error: {
    color: "#b42318",
    fontSize: 12,
    marginTop: 12,
    textAlign: "center",
  },
  success: {
    color: colors.accent,
    fontSize: 12,
    marginTop: 12,
    textAlign: "center",
  },
  ghostButton: {
    alignItems: "center",
    marginTop: 18,
  },
  backCircle: {
    alignItems: "center",
    justifyContent: "center",
    height: 32,
    width: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBg,
  },
  backIcon: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 14,
    textAlign: "center",
    fontWeight: "700",
  },
});
