import { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type MapBottomCardProps = {
  title: string;
  imageUrl?: string | null;
  rating: number;
  reviewCount: number;
  walkTime: string;
  price: string;
  isAvailable?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onReserve: () => void;
  onPress?: () => void;
  bottomOffset?: number;
  horizontalInset?: number;
  dismissing?: boolean;
};

export function MapBottomCard({
  title,
  imageUrl,
  rating,
  reviewCount,
  walkTime,
  price,
  isAvailable = true,
  isFavorite,
  onToggleFavorite,
  onReserve,
  onPress,
  bottomOffset = 0,
  horizontalInset = 0,
  dismissing = false,
}: MapBottomCardProps) {
  const translateAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const translateY = useMemo(
    () =>
      translateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 160],
      }),
    [translateAnim]
  );

  useEffect(() => {
    if (dismissing) {
      // Animate out
      Animated.parallel([
        Animated.timing(translateAnim, {
          toValue: 1,
          duration: 250,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate in
      translateAnim.setValue(1);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.timing(translateAnim, {
          toValue: 0,
          duration: 250,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [translateAnim, opacityAnim, title, dismissing]);

  return (
    <Animated.View
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
      <View style={styles.content}>
        <Pressable style={styles.bodyPress} onPress={onPress}>
          <View style={styles.topRow}>
            <View style={styles.imageColumn}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.thumbnail} resizeMode="cover" />
            ) : (
              <View style={styles.thumbnailPlaceholder}>
                <Text style={styles.thumbnailText}>No image</Text>
              </View>
            )}
          </View>
            <View style={styles.textStack}>
              {onToggleFavorite ? (
                <Pressable
                  style={styles.favButton}
                  onPress={onToggleFavorite}
                  hitSlop={8}
                >
                  <Text style={[styles.favText, isFavorite && styles.favTextActive]}>
                    {isFavorite ? "♥︎" : "♡"}
                  </Text>
                </Pressable>
              ) : null}
              <Text style={styles.title} numberOfLines={2}>
                {title}
              </Text>
              <View style={styles.metaRow}>
                {reviewCount > 0 ? (
                  <>
                    <Text style={styles.iconStar}>★</Text>
                    <Text style={styles.metaText}>{rating.toFixed(1)}</Text>
                    <Text style={styles.metaText}>({reviewCount})</Text>
                    <Text style={styles.metaSeparator}>•</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.metaText}>New listing</Text>
                    <Text style={styles.metaSeparator}>•</Text>
                  </>
                )}
                <View style={[styles.iconBlock, styles.iconWalk]} />
                <Text style={styles.metaText}>{walkTime}</Text>
              </View>
            </View>
          </View>
        </Pressable>
        <Pressable
          style={[styles.cta, !isAvailable && styles.ctaDisabled]}
          onPress={onReserve}
          disabled={!isAvailable}
        >
          <Text style={[styles.ctaText, !isAvailable && styles.ctaTextDisabled]}>
            {isAvailable ? `Reserve for ${price}` : "Sold out"}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    position: "absolute",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
    overflow: "hidden",
  },
  imageColumn: {
    width: 80,
    height: 80,
    borderRadius: 10,
    overflow: "hidden",
  },
  content: {
    padding: 12,
  },
  bodyPress: {
    marginBottom: 10,
  },
  favButton: {
    alignItems: "center",
    borderRadius: 999,
    height: 28,
    justifyContent: "center",
    position: "absolute",
    right: 0,
    top: 0,
    width: 28,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  favText: {
    color: "#d1d5db",
    fontSize: 14,
    fontWeight: "600",
  },
  favTextActive: {
    color: "#00d4aa",
  },
  topRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
  },
  thumbnail: {
    height: 80,
    width: 80,
    borderRadius: 10,
  },
  thumbnailPlaceholder: {
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    height: 80,
    width: 80,
    borderRadius: 10,
    justifyContent: "center",
  },
  thumbnailText: {
    color: "#9ca3af",
    fontSize: 9,
    fontWeight: "600",
    textAlign: "center",
  },
  textStack: {
    flex: 1,
    justifyContent: "flex-start",
    gap: 6,
    position: "relative",
  },
  title: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
    paddingRight: 24,
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
  },
  metaText: {
    color: "#6b7280",
    fontSize: 11,
    fontWeight: "500",
  },
  metaSeparator: {
    color: "#d1d5db",
    fontSize: 10,
  },
  iconStar: {
    color: "#f59e0b",
    fontSize: 11,
    fontWeight: "700",
  },
  iconBlock: {
    borderRadius: 3,
    height: 9,
    width: 9,
  },
  iconShield: {
    backgroundColor: "#10b981",
  },
  iconWalk: {
    backgroundColor: "#6b7280",
  },
  cta: {
    alignItems: "center",
    backgroundColor: "#00d4aa",
    height: 44,
    justifyContent: "center",
    marginHorizontal: -12,
    marginBottom: -12,
  },
  ctaText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  ctaDisabled: {
    backgroundColor: "#e5e7eb",
  },
  ctaTextDisabled: {
    color: "#9ca3af",
  },
});
