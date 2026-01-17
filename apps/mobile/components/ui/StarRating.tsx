import React from "react";
import { Animated, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "../../theme";

interface StarRatingProps {
  rating: number;
  onRatingChange: (rating: number) => void;
  size?: number;
  disabled?: boolean;
}

export function StarRating({ rating, onRatingChange, size = 40, disabled = false }: StarRatingProps) {
  const scaleAnims = React.useRef([...Array(5)].map(() => new Animated.Value(1))).current;

  const handlePress = (index: number) => {
    if (disabled) return;

    const newRating = index + 1;
    onRatingChange(newRating);

    Animated.sequence([
      Animated.timing(scaleAnims[index], {
        toValue: 1.2,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnims[index], {
        toValue: 1,
        friction: 3,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <View style={styles.container}>
      {[...Array(5)].map((_, index) => {
        const isSelected = index < rating;
        return (
          <Animated.View key={index} style={{ transform: [{ scale: scaleAnims[index] }] }}>
            <TouchableOpacity
              onPress={() => handlePress(index)}
              disabled={disabled}
              activeOpacity={0.7}
              style={[styles.star, { width: size, height: size }]}
            >
              <Ionicons
                name={isSelected ? "star" : "star-outline"}
                size={size}
                color={isSelected ? colors.rating.active : colors.rating.inactive}
              />
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  star: {
    justifyContent: "center",
    alignItems: "center",
  },
});
