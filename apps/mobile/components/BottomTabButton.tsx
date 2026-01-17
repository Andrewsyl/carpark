import { ReactNode, useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { colors, radius, spacing } from "../styles/theme";

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

  return (
    <Pressable onPress={onPress} style={styles.pressable}>
      <Animated.View style={[styles.item, { transform: [{ scale }] }]}>
        {children}
        {focused ? <View style={styles.indicator} /> : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  item: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    gap: 4,
  },
  indicator: {
    marginTop: 4,
    height: 3,
    width: 18,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
});
