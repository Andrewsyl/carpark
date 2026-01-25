import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  ZoomIn,
  ZoomOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft, MapPin } from "lucide-react-native";
import { createReview } from "../api";
import { useAuth } from "../auth";
import type { RootStackParamList } from "../types";
import { StarRating } from "../components/ui/StarRating";
import { colors, spacing, typography } from "../theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = NativeStackScreenProps<RootStackParamList, "Review">;

export function ReviewScreen({ navigation, route }: Props) {
  const { booking } = route.params;
  const { token } = useAuth();
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputHeight, setInputHeight] = useState(120);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [existingRating, setExistingRating] = useState<number | null>(null);

  const end = new Date(booking.endTime);
  const canReview = booking.status === "confirmed" && end.getTime() <= Date.now();
  const showReviewNotice = !canReview && booking.status !== "canceled";

  const ratingPrompt = useMemo(() => {
    if (rating >= 4) return "Awesome! What did you like?";
    if (rating === 3) return "It was okay";
    if (rating > 0) return "What went wrong?";
    return "";
  }, [rating]);

  const submitLabel = useMemo(() => {
    if (existingRating) return "Reviewed";
    if (rating >= 4) return "Share the love";
    return "Submit review";
  }, [existingRating, rating]);

  useEffect(() => {
    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(`bookingRating:${booking.id}`);
        if (!stored) return;
        const parsed = JSON.parse(stored) as { rating?: number };
        if (typeof parsed.rating === "number") {
          setExistingRating(parsed.rating);
          setRating(parsed.rating);
        }
      } catch {
        // Ignore stored rating errors.
      }
    })();
  }, [booking.id]);

  const handleSubmit = async () => {
    if (!token || !canReview || existingRating) return;
    setSubmitting(true);
    setError(null);
    try {
      await createReview({
        token,
        bookingId: booking.id,
        rating,
        comment: feedback.trim() ? feedback.trim() : undefined,
      });
      await AsyncStorage.setItem(
        `bookingRating:${booking.id}`,
        JSON.stringify({ rating })
      );
      setIsSubmitted(true);
      setExistingRating(rating);
      setTimeout(() => {
        navigation.popToTop();
      }, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.gradient}>
        <LinearGradient colors={["#ECFDF5", "#F9FAFB"]} style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={24} color={colors.text.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>Review</Text>
          <View style={styles.headerSpacer} />
        </LinearGradient>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View entering={FadeInDown.delay(0)} style={styles.titleSection}>
              <View style={styles.heroRow}>
                <View style={styles.heroIcon}>
                  <MapPin size={20} color={colors.primary.main} />
                </View>
                <View style={styles.heroText}>
                  <Text style={styles.mainTitle}>How was your parking experience?</Text>
                  <Text style={styles.helperText}>
                    Your feedback helps other drivers find great parking spots.
                  </Text>
                </View>
              </View>
            </Animated.View>

            {showReviewNotice ? (
              <Animated.View entering={FadeInDown.delay(50)} style={styles.noticeCard}>
                <Text style={styles.noticeTitle}>Reviews unlock after the stay</Text>
                <Text style={styles.noticeText}>
                  You can leave a review once the booking has ended and is confirmed.
                </Text>
              </Animated.View>
            ) : null}

            {existingRating ? (
              <Animated.View entering={FadeInDown.delay(80)} style={styles.noticeCard}>
                <Text style={styles.noticeTitle}>Already reviewed</Text>
                <Text style={styles.noticeText}>
                  You rated this booking {existingRating} out of 5.
                </Text>
              </Animated.View>
            ) : null}

            <Animated.View entering={FadeInDown.delay(100)} style={styles.card}>
              <Text style={styles.cardTitle}>Rate your experience</Text>
              <Text style={styles.cardSubtitle}>Tap a star to rate the space</Text>
              <View style={styles.ratingContainer}>
                <StarRating
                  rating={rating}
                  onRatingChange={setRating}
                  size={52}
                  disabled={!!existingRating}
                />
              </View>
              {rating > 0 ? (
                <Animated.Text entering={FadeIn} exiting={FadeOut} style={styles.ratingFeedback}>
                  {ratingPrompt}
                </Animated.Text>
              ) : null}
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(200)} style={styles.card}>
              <Text style={styles.cardTitle}>Share your feedback</Text>
              <Text style={styles.cardSubtitle}>Help other drivers by sharing a few words</Text>
              <TextInput
                value={feedback}
                onChangeText={setFeedback}
                placeholder="Tell other drivers what to expect…"
                placeholderTextColor={colors.text.tertiary}
                multiline
                style={[styles.textInput, { height: Math.max(120, inputHeight) }]}
                textAlignVertical="top"
                onContentSizeChange={(event) => setInputHeight(event.nativeEvent.contentSize.height)}
                editable={canReview && !existingRating}
              />
              <View style={styles.feedbackFooter}>
                <Text style={styles.characterCount}>{feedback.length} characters</Text>
                {feedback.length > 0 ? (
                  <Animated.Text entering={FadeIn} style={styles.positiveText}>
                    Looking good! ✨
                  </Animated.Text>
                ) : null}
              </View>
            </Animated.View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Animated.View entering={FadeInDown.delay(400)}>
              <SubmitButton
                disabled={!canReview || rating === 0 || !!existingRating}
                isSubmitted={isSubmitted}
                loading={submitting}
                label={submitLabel}
                onPress={handleSubmit}
              />
            </Animated.View>

            <View style={styles.spacer} />
          </ScrollView>
        </KeyboardAvoidingView>

        {isSubmitted ? (
          <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.successOverlay} pointerEvents="none">
            <Animated.View entering={ZoomIn.springify().damping(10)} exiting={ZoomOut} style={styles.successCircle}>
              <Text style={styles.successEmoji}>🎉</Text>
            </Animated.View>
          </Animated.View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

interface SubmitButtonProps {
  disabled: boolean;
  isSubmitted: boolean;
  loading: boolean;
  label: string;
  onPress: () => void;
}

function SubmitButton({ disabled, isSubmitted, loading, label, onPress }: SubmitButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (!disabled) {
      scale.value = withSpring(0.98);
    }
  };

  const handlePressOut = () => {
    if (!disabled) {
      scale.value = withSpring(1.02);
      setTimeout(() => {
        scale.value = withSpring(1);
      }, 100);
    }
  };

  if (disabled) {
    return (
      <View style={[styles.submitButton, styles.submitButtonDisabled]}>
        <Text style={styles.submitButtonTextDisabled}>{label}</Text>
      </View>
    );
  }

  return (
    <AnimatedPressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut} style={animatedStyle}>
      <LinearGradient
        colors={["#14b8a6", "#10b981"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.submitButton}
      >
        {loading ? (
          <ActivityIndicator color={colors.text.inverse} />
        ) : isSubmitted ? (
          <Animated.View entering={ZoomIn} style={styles.submitSuccessContent}>
            <Text style={styles.submitButtonText}>✓ Thank you!</Text>
          </Animated.View>
        ) : (
          <Text style={styles.submitButtonText}>{label}</Text>
        )}
      </LinearGradient>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  gradient: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.lg,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "500",
    color: colors.text.primary,
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  titleSection: {
    marginBottom: spacing.xl,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  heroIcon: {
    height: 48,
    width: 48,
    borderRadius: 16,
    backgroundColor: colors.primary.subtle,
    alignItems: "center",
    justifyContent: "center",
  },
  heroText: {
    flex: 1,
  },
  mainTitle: {
    fontSize: 32,
    fontWeight: "600",
    marginBottom: spacing.xs,
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  helperText: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 4,
    color: colors.text.primary,
  },
  cardSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 16,
  },
  ratingContainer: {
    marginVertical: spacing.md,
    alignItems: "center",
  },
  ratingFeedback: {
    textAlign: "center",
    marginTop: spacing.lg,
    fontSize: 16,
    fontWeight: "600",
    color: colors.text.primary,
  },
  textInput: {
    minHeight: 120,
    padding: spacing.lg,
    backgroundColor: colors.background.tertiary,
    borderRadius: 16,
    fontSize: 15,
    marginBottom: spacing.sm,
    color: colors.text.primary,
  },
  feedbackFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  characterCount: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  positiveText: {
    fontSize: 12,
    color: "#14b8a6",
    fontWeight: "500",
  },
  submitButton: {
    paddingVertical: spacing.md,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonDisabled: {
    backgroundColor: colors.border,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text.inverse,
  },
  submitButtonTextDisabled: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text.tertiary,
  },
  submitSuccessContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  successOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.1)",
  },
  successCircle: {
    backgroundColor: colors.background.secondary,
    borderRadius: 80,
    padding: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  successEmoji: {
    fontSize: 60,
  },
  spacer: {
    height: 24,
  },
  error: {
    ...typography.bodySmall,
    color: colors.error,
    marginBottom: 8,
  },
  noticeCard: {
    marginBottom: spacing.xxl,
    backgroundColor: colors.background.accent,
    borderRadius: 16,
    padding: spacing.xl,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.primary,
  },
  noticeText: {
    fontSize: 12,
    marginTop: 6,
    lineHeight: 18,
    color: colors.text.secondary,
  },
});
