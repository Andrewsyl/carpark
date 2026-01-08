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
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onReserve: () => void;
  onPress?: () => void;
  bottomOffset?: number;
  horizontalInset?: number;
};

export function MapBottomCard({
  title,
  imageUrl,
  rating,
  reviewCount,
  walkTime,
  price,
  isFavorite,
  onToggleFavorite,
  onReserve,
  onPress,
  bottomOffset = 0,
  horizontalInset = 0,
}: MapBottomCardProps) {
  const translateAnim = useRef(new Animated.Value(1)).current;
  const translateY = useMemo(
    () =>
      translateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 140],
      }),
    [translateAnim]
  );

  useEffect(() => {
    translateAnim.setValue(1);
    Animated.timing(translateAnim, {
      toValue: 0,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [translateAnim, title]);

  return (
    <Animated.View
      style={[
        styles.card,
        {
          bottom: bottomOffset,
          left: horizontalInset,
          right: horizontalInset,
          transform: [{ translateY }],
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
                <Text style={styles.thumbnailText}>Awaiting images</Text>
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
                  </>
                ) : (
                  <Text style={styles.metaText}>New listing</Text>
                )}
              </View>
              <View style={styles.metaRow}>
                <View style={[styles.iconBlock, styles.iconShield]} />
                <Text style={styles.metaText}>Best Price Guarantee</Text>
                <Text style={styles.metaSeparator}>•</Text>
                <View style={[styles.iconBlock, styles.iconWalk]} />
                <Text style={styles.metaText}>{walkTime}</Text>
              </View>
            </View>
          </View>
        </Pressable>
        <Pressable style={styles.cta} onPress={onReserve}>
          <Text style={styles.ctaText}>Reserve for {price}</Text>
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
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    height: 140,
  },
  imageColumn: {
    marginLeft: -16,
    marginTop: -10,
    marginBottom: 0,
    width: 76,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 0,
  },
  bodyPress: {
    flex: 1,
  },
  favButton: {
    alignItems: "center",
    borderRadius: 999,
    height: 30,
    justifyContent: "center",
    position: "absolute",
    right: 0,
    top: 0,
    width: 30,
  },
  favText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  favTextActive: {
    color: "#00d4aa",
  },
  topRow: {
    alignItems: "stretch",
    flexDirection: "row",
    flex: 1,
    gap: 12,
  },
  thumbnail: {
    borderTopLeftRadius: 16,
    height: "100%",
    width: 76,
  },
  thumbnailPlaceholder: {
    alignItems: "center",
    backgroundColor: "#e5e7eb",
    borderTopLeftRadius: 16,
    height: "100%",
    justifyContent: "center",
    width: 76,
  },
  thumbnailText: {
    color: "#6b7280",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  textStack: {
    flex: 1,
    justifyContent: "space-between",
    paddingVertical: 4,
    position: "relative",
  },
  title: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "600",
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  metaText: {
    color: "#6b7280",
    fontSize: 11,
  },
  metaSeparator: {
    color: "#9ca3af",
    fontSize: 11,
  },
  iconStar: {
    color: "#f5a623",
    fontSize: 11,
    fontWeight: "700",
  },
  iconBlock: {
    borderRadius: 3,
    height: 10,
    width: 10,
  },
  iconShield: {
    backgroundColor: "#22c55e",
  },
  iconWalk: {
    backgroundColor: "#6b7280",
  },
  cta: {
    alignItems: "center",
    backgroundColor: "#00d4aa",
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    height: 40,
    justifyContent: "center",
    marginTop: "auto",
    marginHorizontal: -16,
  },
  ctaText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
});
