import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, ChevronDown, Star } from "lucide-react-native";
import { listListingReviews, type ListingReview } from "../api";
import { colors } from "../styles/theme";
import { GREEN, INK, MUTED, PILL, RULE, WHITE } from "../styles/pageTokens";
import { PageHeader, PillButton, Rule } from "../components/ui/page";
import type { RootStackParamList } from "../types";
import { formatReviewDate } from "../utils/dateFormat";
import { fallbackRoutes, goBackOrFallback, resetToSafeRoute } from "../navigation/safeNavigation";

const SORT_OPTIONS = ["Most relevant", "Newest"] as const;

type Props = NativeStackScreenProps<RootStackParamList, "ListingReviews">;

type SortKey = (typeof SORT_OPTIONS)[number];

const sortReviews = (items: ListingReview[], sort: SortKey) => {
  if (sort === "Newest") {
    return [...items].sort((a, b) => {
      const aDate = Date.parse((a as { created_at?: string }).created_at ?? a.createdAt ?? "");
      const bDate = Date.parse((b as { created_at?: string }).created_at ?? b.createdAt ?? "");
      return bDate - aDate;
    });
  }
  return items;
};

export function ListingReviewsScreen({ navigation, route }: Props) {
  const { id, rating, ratingCount } = route.params;
  const [reviews, setReviews] = useState<ListingReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>("Most relevant");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await listListingReviews(id);
        if (!active) return;
        setReviews(data);
      } catch {
        if (active) setReviews([]);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [id]);

  const totalReviews = ratingCount ?? reviews.length;
  const ratingValue = typeof rating === "number" ? rating : 0;
  const sortedReviews = useMemo(() => sortReviews(reviews, sort), [reviews, sort]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <PageHeader
        title="Reviews"
        onBack={() => goBackOrFallback(navigation, fallbackRoutes.search)}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Same shape the listing's own reviews block uses: score, then what
            it is based on — no boxed card. */}
        <View style={styles.summary}>
          <Star size={16} color={GREEN} fill={GREEN} strokeWidth={0} />
          <Text style={styles.summaryScore}>{ratingValue.toFixed(1)}</Text>
          <Text style={styles.summaryMeta}>
            {`Based on ${totalReviews} recent ${totalReviews === 1 ? "booking" : "bookings"}`}
          </Text>
          <Pressable
            style={styles.sortButton}
            onPress={() =>
              setSort((prev) => (prev === "Most relevant" ? "Newest" : "Most relevant"))
            }
            accessibilityRole="button"
          >
            <Text style={styles.sortText}>{sort}</Text>
            <ChevronDown size={15} color={MUTED} strokeWidth={2.2} />
          </Pressable>
        </View>

        <Rule />

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={INK} />
          </View>
        ) : sortedReviews.length ? (
          <View style={styles.reviewList}>
            {sortedReviews.map((review, index) => {
              const createdAt = (review as { created_at?: string }).created_at ?? review.createdAt;
              const author =
                (review as { author_name?: string }).author_name ?? review.authorName ?? "Guest";
              return (
                <View key={review.id}>
                  {index > 0 ? <View style={styles.reviewDivider} /> : null}
                  <View style={styles.reviewRow}>
                    <View style={styles.reviewTop}>
                      <View
                        style={[styles.reviewAvatar, { backgroundColor: avatarFill(author) }]}
                      >
                        <Text style={styles.reviewAvatarText}>
                          {author.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.reviewWho}>
                        <Text style={styles.reviewAuthor} numberOfLines={1}>
                          {author}
                        </Text>
                        <Text style={styles.reviewMeta}>
                          {formatReviewDate(new Date(createdAt))}
                        </Text>
                      </View>
                      <View style={styles.reviewScore}>
                        <Star size={12} color={GREEN} fill={GREEN} strokeWidth={0} />
                        <Text style={styles.reviewScoreText}>{review.rating.toFixed(1)}</Text>
                      </View>
                    </View>
                    {review.comment ? (
                      <Text style={styles.reviewBody}>{review.comment}</Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Star size={22} color={GREEN} strokeWidth={1.8} />
            </View>
            <Text style={styles.emptyTitle}>No reviews yet</Text>
            <Text style={styles.emptyHint}>
              Be the first to park here and share your experience.
            </Text>
            <View style={styles.emptyAction}>
              <PillButton
                label="Browse spaces"
                onPress={() => resetToSafeRoute(navigation, fallbackRoutes.search)}
              />
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// The theme's avatar palette, keyed off the first letter so a given name always
// gets the same colour — same behaviour as the listing's own review rail.
const avatarFill = (name: string) =>
  colors.avatarFills[(name.charCodeAt(0) || 0) % colors.avatarFills.length];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: WHITE },
  content: { paddingBottom: 32 },

  summary: {
    flexDirection: "row", alignItems: "center", gap: 7,
    paddingHorizontal: 24, paddingTop: 20,
  },
  summaryScore: { fontFamily: "PlusJakartaSans-Bold", fontSize: 15, color: INK },
  summaryMeta: {
    flex: 1, minWidth: 0,
    fontFamily: "PlusJakartaSans-Regular", fontSize: 15, color: MUTED,
  },
  sortButton: {
    flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: PILL, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  sortText: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 14, color: INK },

  loader: { paddingTop: 24, alignItems: "center" },

  reviewList: { paddingHorizontal: 24 },
  // Rows are separated by a hairline, not boxed — the listing has no cards.
  reviewDivider: { height: 1, backgroundColor: RULE },
  reviewRow: { paddingVertical: 18 },
  reviewTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  reviewAvatar: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  reviewAvatarText: { fontFamily: "PlusJakartaSans-Bold", fontSize: 14, color: INK },
  reviewWho: { flex: 1, minWidth: 0 },
  reviewAuthor: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 15, color: INK },
  reviewMeta: { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, color: MUTED },
  reviewScore: { flexDirection: "row", alignItems: "center", gap: 3 },
  reviewScoreText: { fontFamily: "PlusJakartaSans-Bold", fontSize: 13, color: GREEN },
  reviewBody: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 15, lineHeight: 22,
    color: MUTED, marginTop: 10,
  },

  empty: { alignItems: "center", paddingHorizontal: 24, paddingTop: 40 },
  emptyIcon: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: colors.pageAccentSoft,
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: "PlusJakartaSans-Bold", fontSize: 16, color: INK, textAlign: "center",
  },
  emptyHint: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 15, lineHeight: 21,
    color: MUTED, textAlign: "center", marginTop: 4,
  },
  emptyAction: { alignSelf: "stretch", marginTop: 20 },
});
