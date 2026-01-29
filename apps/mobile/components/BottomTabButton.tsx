import { ReactNode, useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { colors, radius } from "../styles/theme";

type Props = {
  children: ReactNode;
  onPress?: () => void;
  accessibilityState?: { selected?: boolean };
};

export function BottomTabButton({ children, onPress, accessibilityState }: Props) {
  const focused = accessibilityState?.selected;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: focused ? 1.04 : 1,
      useNativeDriver: true,
      friction: 6,
    }).start();
  }, [focused, scale]);

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.92,
      useNativeDriver: true,
      friction: 8,
      tension: 200,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: focused ? 1.04 : 1,
      useNativeDriver: true,
      friction: 6,
      tension: 100,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.pressable}
    >
      <Animated.View style={[styles.item, { transform: [{ scale }] }]}>
        {children}
        {focused ? <View style={styles.indicator} /> : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  indicator: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    height: 3,
    marginTop: 4,
    width: 18,
  },
  item: {
    alignItems: "center",
    gap: 4,
    justifyContent: "center",
  },
  pressable: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
});
