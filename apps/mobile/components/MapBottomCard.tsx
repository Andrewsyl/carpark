import { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Accessibility,
  ArrowDownUp,
  BatteryCharging,
  Bike,
  CarFront,
  Cctv,
  Clock,
  Fence,
  Heart,
  IdCard,
  KeyRound,
  Lightbulb,
  Maximize2,
  Star,
  Warehouse,
} from "lucide-react-native";
import { colors, radius } from "../styles/theme";
import { motion } from "../styles/motion";

type MapBottomCardProps = {
  title: string;
  imageUrl?: string | null;
  rating: number;
  reviewCount: number;
  price: string;
  amenities?: string[] | null;
  isAvailable?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onPress?: () => void;
  bottomOffset?: number;
  horizontalInset?: number;
  dismissing?: boolean;
  onHeightChange?: (height: number) => void;
};

const AMENITY_ACRONYMS: Record<string, string> = { ev: "EV", cctv: "CCTV" };

function humanizeAmenity(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((word) => {
      const lower = word.toLowerCase();
      return AMENITY_ACRONYMS[lower] ?? lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function getFeatureIconType(label: string) {
  const n = label.toLowerCase();
  if (n.includes("low") || n.includes("clearance") || n.includes("height")) return "low";
  if (n.includes("permit")) return "permit";
  if (n.includes("ev") || n.includes("charger") || n.includes("charging")) return "ev";
  if (n.includes("cctv") || n.includes("camera")) return "cctv";
  if (n.includes("light") || n.includes("lit")) return "lit";
  if (n.includes("shelter") || n.includes("covered") || n.includes("roof")) return "sheltered";
  if (n.includes("gate") || n.includes("gated") || n.includes("barrier")) return "gated";
  if (n.includes("code") || n.includes("keypad") || n.includes("entry")) return "code";
  if (n.includes("disabled") || (n.includes("access") && n.includes("wheel"))) return "disabled";
  if (n.includes("24") || n.includes("always") || n.includes("round")) return "allday";
  if (n.includes("motorbike") || n.includes("motorcycle") || n.includes("scooter") || n.includes("bike")) return "motorbike";
  if (n.includes("wide")) return "wide";
  return "sheltered";
}

const FEATURE_ICONS = {
  cctv: Cctv,
  ev: BatteryCharging,
  sheltered: Warehouse,
  lit: Lightbulb,
  gated: Fence,
  low: ArrowDownUp,
  permit: IdCard,
  code: KeyRound,
  disabled: Accessibility,
  allday: Clock,
  motorbike: Bike,
  wide: Maximize2,
} as const;

export function FeatureChip({ label }: { label: string }) {
  const iconType = getFeatureIconType(label);
  const Icon = FEATURE_ICONS[iconType];
  return (
    <View style={styles.featureChip} accessibilityLabel={label}>
      <Icon size={15} color="#55606B" strokeWidth={1.9} />
    </View>
  );
}


export function MapBottomCard({
  title,
  imageUrl,
  rating,
  reviewCount,
  price,
  isAvailable = true,
  amenities,
  isFavorite,
  onToggleFavorite,
  onPress,
  bottomOffset = 0,
  horizontalInset = 0,
  dismissing = false,
  onHeightChange,
}: MapBottomCardProps) {
  const translateAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const translateY = useMemo(
    () => translateAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 140] }),
    [translateAnim]
  );

  // Pop the heart when the card gets saved (not on unsave, and not when a card
  // mounts already-favorited).
  const heartScale = useRef(new Animated.Value(1)).current;
  const prevFavorite = useRef(isFavorite);
  useEffect(() => {
    if (isFavorite && !prevFavorite.current) {
      heartScale.stopAnimation();
      heartScale.setValue(0.6);
      Animated.spring(heartScale, {
        toValue: 1,
        ...motion.springPop,
        useNativeDriver: true,
      }).start();
    }
    prevFavorite.current = isFavorite;
  }, [isFavorite, heartScale]);

  useEffect(() => {
    if (dismissing) {
      Animated.parallel([
        Animated.timing(translateAnim, {
          toValue: 1,
          duration: motion.duration.standard,
          easing: motion.easing.in,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: motion.duration.fast,
          easing: motion.easing.in,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      translateAnim.setValue(1);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.spring(translateAnim, {
          toValue: 0,
          ...motion.spring,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: motion.duration.fast,
          easing: motion.easing.out,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [translateAnim, opacityAnim, title, dismissing]);

  const hasRating = reviewCount > 0 && rating > 0;
  const features = useMemo(
    () => Array.from(new Set((amenities ?? []).filter(Boolean).map(humanizeAmenity))),
    [amenities]
  );

  // "€12.50/mo" → bold amount, quiet suffix. Only the monthly search sends a
  // suffix now; an hourly price is the number alone, since the card's price is
  // always the whole window and the word "total" was restating that.
  const [priceAmount, priceSuffix] = useMemo(() => {
    const m = price.match(/^(\S+)\s+(.+)$/);
    return m ? [m[1], m[2]] : [price, ""];
  }, [price]);

  return (
    <Animated.View
      onLayout={e => onHeightChange?.(e.nativeEvent.layout.height)}
      style={[
        styles.card,
        {
          bottom: bottomOffset,
          left: horizontalInset,
          right: horizontalInset,
          transform: [{ translateY }],
          opacity: opacityAnim,
        },
      ]}
    >
      <Pressable onPress={onPress} style={styles.row}>
        {/* ── Image ─────────────────────────────────────────── */}
        <View style={styles.imageWrap}>
          {imageUrl ? (
            // The card is one persistent instance whose props swap as the driver
            // taps different pins. Without a key the <Image> element is reused
            // and RN keeps the previous photo on screen until the new URI loads,
            // so a stale image lingers for a beat. Keying by URI remounts it,
            // showing the muted placeholder while the new one loads instead.
            <Image key={imageUrl} source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={styles.imageFallback}>
              <CarFront size={22} color="#b0bac4" strokeWidth={1.9} />
            </View>
          )}
          {onToggleFavorite ? (
            <Pressable onPress={onToggleFavorite} hitSlop={8} style={styles.heartBtn}>
              <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                <Heart
                  size={16}
                  color={colors.primary}
                  fill={isFavorite ? colors.primary : "none"}
                  strokeWidth={2.1}
                />
              </Animated.View>
            </Pressable>
          ) : null}
        </View>

        {/* ── Content ───────────────────────────────────────── */}
        {/* Title/rating hug the top; amenity icons sit on the same
            bottom line as the price (pinned bottom-right) so the row's
            full height is used instead of leaving a void. */}
        <View style={[styles.content, !hasRating && styles.contentCompact]}>
          <View style={styles.topGroup}>
            {/* No rating row → let the title breathe onto a second line so a
                review-less card doesn't leave a big empty gap. */}
            <Text style={styles.title} numberOfLines={hasRating ? 1 : 2}>{title}</Text>

            {hasRating ? (
              <View style={styles.ratingRow}>
                <Star size={11} color={colors.primary} fill={colors.primary} strokeWidth={1.5} />
                <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
                <Text style={styles.ratingCount}>
                  {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Amenity icons (left) and price (right) share the bottom line. */}
          <View style={styles.bottomRow}>
            <View style={styles.featureRow}>
              {features.slice(0, 3).map((feature) => (
                <FeatureChip key={feature} label={feature} />
              ))}
              {features.length > 3 ? (
                <Text style={styles.featureMore}>+{features.length - 3}</Text>
              ) : null}
            </View>

            {isAvailable ? (
              <Text style={styles.price}>
                {priceAmount}
                {priceSuffix ? <Text style={styles.priceSuffix}> {priceSuffix}</Text> : null}
              </Text>
            ) : (
              <View style={styles.soldOutPill}>
                <Text style={styles.soldOut}>Sold out</Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.cardSmall,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 2,
    position: "absolute",
    shadowColor: "#0B1220",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    minHeight: 108,
  },
  imageWrap: {
    backgroundColor: colors.cardBgMuted,
    borderRadius: radius.cardSmall - 6,
    overflow: "hidden",
    margin: 4,
    marginRight: 0,
    width: 124,
  },
  image: {
    flex: 1,
    width: "100%",
  },
  imageFallback: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
    paddingBottom: 14,
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  topGroup: {
    gap: 6,
  },
  // No rating → center the title + icon/price cluster so a review-less
  // card doesn't stretch into a big empty gap.
  contentCompact: {
    gap: 10,
    justifyContent: "center",
  },
  title: {
    color: colors.text,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 15,
    letterSpacing: -0.3,
    lineHeight: 18,
  },
  // Circular white button floating over the top-left of the photo.
  heartBtn: {
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderRadius: radius.pill,
    height: 28,
    justifyContent: "center",
    left: 6,
    position: "absolute",
    top: 6,
    width: 28,
  },
  ratingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
  },
  ratingText: {
    color: colors.text,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 12,
    letterSpacing: -0.1,
  },
  ratingCount: {
    color: colors.textMuted,
    fontFamily: "PlusJakartaSans-Medium",
    fontSize: 11.5,
    letterSpacing: -0.1,
  },
  featureBadge: {
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderColor: "#e5e7eb",
    borderRadius: 999,
    borderWidth: 1,
    height: 22,
    justifyContent: "center",
    minWidth: 22,
    paddingHorizontal: 6,
  },
  featureChip: {
    alignItems: "center",
    justifyContent: "center",
  },
  // Overflow count when a space has more amenities than fit — tells the
  // driver there's more without listing every one.
  featureMore: {
    color: colors.textMuted,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 11,
    marginLeft: 2,
  },
  featureRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 4,
    minHeight: 22,
  },
  // Amenity icons and price share one line: icons left, price right.
  bottomRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 24,
  },
  price: {
    color: colors.text,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 19,
    letterSpacing: -0.4,
    lineHeight: 23,
    textAlign: "right",
  },
  priceSuffix: {
    color: colors.textMuted,
    fontFamily: "PlusJakartaSans-Medium",
    fontSize: 11,
    letterSpacing: -0.1,
  },
  soldOutPill: {
    alignSelf: "flex-start",
    backgroundColor: colors.cardBgMuted,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  soldOut: {
    color: colors.textMuted,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 12,
  },
});
