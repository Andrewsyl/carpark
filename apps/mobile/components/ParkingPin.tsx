import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

interface ParkingPinProps {
  price: number;
  isSelected?: boolean;
  onPress?: () => void;
}

export function ParkingPin({ price, isSelected = false, onPress }: ParkingPinProps) {
  const scale = useSharedValue(1);
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.6);

  useEffect(() => {
    // Initial scale-in animation
    scale.value = withSpring(1, { damping: 10 });

    // Pulse animation for selected state
    if (isSelected) {
      pulseScale.value = withRepeat(withTiming(1.5, { duration: 1500 }), -1, false);
      pulseOpacity.value = withRepeat(
        withSequence(withTiming(0.6, { duration: 0 }), withTiming(0, { duration: 1500 })),
        -1,
        false
      );
    } else {
      pulseScale.value = 1;
      pulseOpacity.value = 0;
    }
  }, [isSelected]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1.1);
    setTimeout(() => {
      scale.value = withSpring(1);
    }, 100);
  };

  const label = `€${price}`;

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View style={[styles.container, animatedStyle]}>
        {/* Pulse effect for selected */}
        {isSelected && <Animated.View style={[styles.pulse, pulseStyle]} />}

        {/* Main pin container */}
        {isSelected ? (
          <LinearGradient
            colors={["#10b981", "#14b8a6"]} // emerald-500 to teal-600
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.pinContainer, styles.selectedContainer]}
          >
            <Text style={styles.selectedText}>{label}</Text>
          </LinearGradient>
        ) : (
          <View style={[styles.pinContainer, styles.unselectedContainer]}>
            <View style={styles.border} />
            <Text style={styles.unselectedText}>{label}</Text>
          </View>
        )}

        {/* Triangle pointer with border */}
        <View style={styles.triangleWrapper}>
          {/* Border triangle (larger, underneath) */}
          {!isSelected && (
            <View style={styles.triangleBorder} />
          )}
          {/* Main triangle */}
          <View
            style={[
              styles.triangle,
              isSelected ? styles.triangleSelected : styles.triangleUnselected,
            ]}
          />
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  pinContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 50,
  },
  selectedContainer: {
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  unselectedContainer: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  border: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "#a7f3d0", // emerald-200
  },
  selectedText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  unselectedText: {
    color: "#047857", // emerald-700
    fontSize: 13,
    fontWeight: "700",
  },
  triangleWrapper: {
    alignItems: "center",
    marginTop: -3,
  },
  triangleBorder: {
    position: "absolute",
    top: 0,
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftWidth: 7.5,
    borderRightWidth: 7.5,
    borderTopWidth: 8.5,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#a7f3d0", // emerald-200 border
  },
  triangle: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 7,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  triangleSelected: {
    borderTopColor: "#14b8a6", // teal-600
  },
  triangleUnselected: {
    borderTopColor: "#ffffff",
  },
  pulse: {
    position: "absolute",
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    backgroundColor: "#34d399", // emerald-400
    borderRadius: 999,
  },
});
