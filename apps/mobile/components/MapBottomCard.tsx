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
        outputRange: [0, 120],
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
      <Pressable onPress={onPress} style={styles.cardPress}>
        {/* Image with rating badge overlay */}
        <View style={styles.imageContainer}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderText}>No image</Text>
            </View>
          )}
          
          {/* Rating badge in top right corner of image */}
          {reviewCount > 0 ? (
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingText}>★ {rating.toFixed(1)}</Text>
            </View>
          ) : null}
          
          {/* Favorite button */}
          {onToggleFavorite ? (
            <Pressable
              style={styles.favoriteButton}
              onPress={onToggleFavorite}
              hitSlop={8}
            >
              <Text style={[styles.favoriteIcon, isFavorite && styles.favoriteIconActive]}>
                {isFavorite ? "♥︎" : "♡"}
              </Text>
            </Pressable>
          ) : null}
        </View>
        
        {/* Content section */}
        <View style={styles.contentSection}>
          {/* Title and details */}
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          
          {/* Distance and time */}
          <View style={styles.detailsRow}>
            <Text style={styles.detailText}>🚶 {walkTime}</Text>
            {reviewCount > 0 ? (
              <Text style={styles.detailText}>• {reviewCount} reviews</Text>
            ) : (
              <Text style={styles.detailText}>• New listing</Text>
            )}
          </View>
          
          {/* Dashed divider */}
          <View style={styles.dashedDivider} />
          
          {/* Price section */}
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Reserve now</Text>
            {isAvailable ? (
              <Text style={styles.currentPrice}>{price}</Text>
            ) : (
              <Text style={styles.soldOutText}>SOLD OUT</Text>
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    position: "absolute",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 12,
    overflow: "hidden",
  },
  
  cardPress: {
    width: "100%",
  },
  
  // Image section
  imageContainer: {
    width: "100%",
    height: 120,
    position: "relative",
  },
  
  image: {
    width: "100%",
    height: "100%",
  },
  
  imagePlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  
  imagePlaceholderText: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  
  // Rating badge in top right corner of image
  ratingBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 16,
  },
  
  ratingText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  
  // Favorite button
  favoriteButton: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  
  favoriteIcon: {
    fontSize: 14,
    color: "#D1D5DB",
    fontWeight: "600",
  },
  
  favoriteIconActive: {
    color: "#047857",
  },
  
  // Content section
  contentSection: {
    padding: 12,
    paddingTop: 10,
  },
  
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  
  detailsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  
  detailText: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  
  // Dashed divider (receipt style)
  dashedDivider: {
    height: 1,
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 10,
  },
  
  // Price section
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  
  priceLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },
  
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  
  originalPrice: {
    fontSize: 13,
    color: "#9CA3AF",
    textDecorationLine: "line-through",
    fontWeight: "500",
  },
  
  currentPrice: {
    fontSize: 20,
    fontWeight: "800",
    color: "#047857",
    letterSpacing: -0.5,
  },
  
  soldOutText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
