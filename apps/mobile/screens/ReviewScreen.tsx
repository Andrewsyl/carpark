import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { createReview } from "../api";
import { useAuth } from "../auth";
import type { RootStackParamList } from "../types";
import { cardShadow, colors, radius, spacing } from "../styles/theme";
import { Ionicons } from "@expo/vector-icons";

type Props = NativeStackScreenProps<RootStackParamList, "Review">;

export function ReviewScreen({ navigation, route }: Props) {
  const { booking } = route.params;
  const { token } = useAuth();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = new Date(booking.endTime);
  const canReview = booking.status === "confirmed" && end.getTime() <= Date.now();
  const showReviewNotice = !canReview && booking.status !== "canceled";

  const handleSubmit = async () => {
    if (!token || !canReview) return;
    setSubmitting(true);
    setError(null);
    try {
      await createReview({
        token,
        bookingId: booking.id,
        rating,
        comment: comment.trim() ? comment.trim() : undefined,
      });
      navigation.popToTop();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Review</Text>
        <View style={styles.backButton} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>How was your stay?</Text>
        <Text style={styles.subtitle}>{booking.title}</Text>

        {showReviewNotice ? (
          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>Reviews unlock after the stay</Text>
            <Text style={styles.noticeText}>
              You can leave a review once the booking has ended and is confirmed.
            </Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Rating</Text>
          <Text style={styles.cardSubtitle}>Tap a star to rate the space.</Text>
          <View style={styles.ratingRow}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable
                key={value}
                style={[styles.star, rating >= value && styles.starActive]}
                onPress={() => setRating(value)}
                disabled={!canReview}
              >
                <Text style={[styles.starText, rating >= value && styles.starTextActive]}>★</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Share your feedback</Text>
          <Text style={styles.cardSubtitle}>Help other drivers by sharing a few words.</Text>
          <TextInput
            style={styles.input}
            placeholder="Share what went well"
            placeholderTextColor="#9ca3af"
            multiline
            value={comment}
            onChangeText={setComment}
            editable={canReview}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting || !canReview}
        >
          <Text style={styles.primaryButtonText}>
            {submitting ? "Submitting..." : "Submit review"}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.appBg,
    flex: 1,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.screenX,
    paddingTop: 8,
  },
  backButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
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
  topTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  content: {
    paddingHorizontal: spacing.screenX,
    paddingBottom: 32,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "700",
    marginTop: 12,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 6,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    marginTop: 16,
    padding: 20,
    ...cardShadow,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
  },
  cardSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 6,
  },
  ratingRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  star: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  starActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  starText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  starTextActive: {
    color: colors.cardBg,
  },
  input: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.text,
    height: 140,
    marginTop: 16,
    padding: 12,
    textAlignVertical: "top",
  },
  error: {
    color: colors.danger,
    marginTop: 10,
  },
  noticeCard: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    marginTop: 16,
    padding: spacing.card,
  },
  noticeTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  noticeText: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 6,
    lineHeight: 18,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 12,
    marginTop: 18,
    minHeight: 44,
    paddingVertical: 12,
  },
  primaryButtonDisabled: {
    backgroundColor: "#cbd5e1",
  },
  primaryButtonText: {
    color: colors.cardBg,
    fontSize: 13,
    fontWeight: "700",
  },
});
