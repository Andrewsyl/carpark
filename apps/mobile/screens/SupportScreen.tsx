import { useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { sendSupportMessage } from "../api";
import { useAuth } from "../auth";
import type { RootStackParamList } from "../types";

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
            <Text style={styles.kicker}>Support</Text>
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
            <Text style={styles.ghostButtonText}>Back</Text>
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
    backgroundColor: "#f5f7fb",
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 24,
  },
  header: {
    marginBottom: 18,
  },
  kicker: {
    color: "#00d4aa",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    color: "#0f172a",
    fontSize: 28,
    fontWeight: "800",
    marginTop: 6,
  },
  subtitle: {
    color: "#6b7280",
    fontSize: 14,
    marginTop: 6,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 18,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 2,
  },
  field: {
    marginBottom: 14,
  },
  label: {
    color: "#475467",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#f9fafb",
    borderColor: "#e5e7eb",
    borderRadius: 12,
    borderWidth: 1,
    color: "#0f172a",
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    textAlignVertical: "top",
  },
  select: {
    backgroundColor: "#f9fafb",
    borderColor: "#e5e7eb",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectText: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "600",
  },
  selectPlaceholder: {
    color: "#94a3b8",
    fontWeight: "500",
  },
  selectChevron: {
    color: "#94a3b8",
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
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
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
    color: "#111827",
    fontSize: 14,
    fontWeight: "600",
  },
  textArea: {
    minHeight: 140,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#00d4aa",
    borderRadius: 12,
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
    color: "#00a889",
    fontSize: 12,
    marginTop: 12,
    textAlign: "center",
  },
  ghostButton: {
    alignItems: "center",
    marginTop: 18,
  },
  ghostButtonText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
  },
});
