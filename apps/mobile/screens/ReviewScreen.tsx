import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { createReview } from "../api";
import { useAuth } from "../auth";
import type { RootStackParamList } from "../types";

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
          <Text style={styles.backLabel}>Back</Text>
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
    backgroundColor: "#f9fafb",
    flex: 1,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  backButton: {
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  backLabel: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "700",
  },
  topTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "700",
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 32,
  },
  title: {
    color: "#111827",
    fontSize: 24,
    fontWeight: "700",
    marginTop: 12,
  },
  subtitle: {
    color: "#6b7280",
    fontSize: 13,
    marginTop: 6,
  },
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#e5e7eb",
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 16,
    padding: 20,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  cardTitle: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "700",
  },
  cardSubtitle: {
    color: "#6b7280",
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
    borderColor: "#e5e7eb",
    borderRadius: 10,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  starActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  starText: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "700",
  },
  starTextActive: {
    color: "#ffffff",
  },
  input: {
    backgroundColor: "#ffffff",
    borderColor: "#e5e7eb",
    borderRadius: 12,
    borderWidth: 1,
    color: "#111827",
    height: 140,
    marginTop: 16,
    padding: 12,
    textAlignVertical: "top",
  },
  error: {
    color: "#b42318",
    marginTop: 10,
  },
  noticeCard: {
    backgroundColor: "#ffffff",
    borderColor: "#e5e7eb",
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 16,
    padding: 18,
  },
  noticeTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
  },
  noticeText: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 6,
    lineHeight: 18,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#10b981",
    borderRadius: 12,
    marginTop: 18,
    minHeight: 44,
    paddingVertical: 12,
  },
  primaryButtonDisabled: {
    backgroundColor: "#cbd5e1",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
});
