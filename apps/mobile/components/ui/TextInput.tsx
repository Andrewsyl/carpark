import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import { borderRadius, colors, spacing, typography } from "../../theme";

interface CustomTextInputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export function TextInput({ label, error, containerStyle, ...props }: CustomTextInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <RNTextInput
        {...props}
        style={[styles.input, isFocused && styles.inputFocused, error && styles.inputError, props.style]}
        onFocus={(event) => {
          setIsFocused(true);
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          setIsFocused(false);
          props.onBlur?.(event);
        }}
        placeholderTextColor={colors.text.tertiary}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.bodySmall,
    fontWeight: "600",
    marginBottom: spacing.sm,
    color: colors.text.primary,
  },
  input: {
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    fontSize: 16,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputFocused: {
    backgroundColor: colors.background.secondary,
    borderColor: colors.primary.main,
    borderWidth: 2,
  },
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
  },
});
