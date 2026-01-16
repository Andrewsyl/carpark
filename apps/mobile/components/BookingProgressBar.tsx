import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

type BookingProgressBarProps = {
  currentStep: 1 | 2 | 3;
};

export function BookingProgressBar({ currentStep }: BookingProgressBarProps) {
  const steps = [
    { number: 1, label: "Select" },
    { number: 2, label: "Confirm" },
    { number: 3, label: "Pay" },
  ];

  const getStepStatus = (stepNumber: number) => {
    if (stepNumber < currentStep) return "completed";
    if (stepNumber === currentStep) return "active";
    return "upcoming";
  };

  return (
    <View style={styles.container}>
      <View style={styles.progressRow}>
        {steps.map((step, index) => {
          const status = getStepStatus(step.number);

          return (
            <React.Fragment key={step.number}>
              <View style={styles.stepWrapper}>
                <View
                  style={[
                    styles.circle,
                    status === "completed" && styles.circleCompleted,
                    status === "active" && styles.circleActive,
                    status === "upcoming" && styles.circleUpcoming,
                  ]}
                >
                  {status === "completed" ? (
                    <Svg width={16} height={12} viewBox="0 0 16 12">
                      <Path
                        d="M1 6l4 4 10-9"
                        stroke="#10B981"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                    </Svg>
                  ) : (
                    <Text
                      style={[
                        styles.stepNumber,
                        status === "upcoming" && styles.stepNumberUpcoming,
                      ]}
                    >
                      {step.number}
                    </Text>
                  )}
                </View>
                <Text
                  style={[
                    styles.label,
                    status === "upcoming" && styles.labelUpcoming,
                  ]}
                >
                  {step.label}
                </Text>
              </View>

              {index < steps.length - 1 ? (
                <View
                  style={[
                    styles.line,
                    (status === "completed" || status === "active") &&
                      styles.lineActive,
                    status === "upcoming" && styles.lineUpcoming,
                  ]}
                />
              ) : null}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  stepWrapper: {
    alignItems: "center",
    minWidth: 48,
  },
  circle: {
    width: 27,
    height: 27,
    borderRadius: 13.5,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  circleCompleted: {
    backgroundColor: "#E6F9F2",
    borderColor: "#10B981",
    borderWidth: 2,
  },
  circleActive: {
    backgroundColor: "#FFF2E7",
    borderColor: "#F97316",
    borderWidth: 2,
  },
  circleUpcoming: {
    backgroundColor: "#F3F4F6",
    borderColor: "#9CA3AF",
    borderWidth: 2,
  },
  checkmark: {
    color: "#10B981",
    fontSize: 12,
    fontWeight: "800",
  },
  stepNumber: {
    color: "#F97316",
    fontSize: 11,
    fontWeight: "700",
  },
  stepNumberUpcoming: {
    color: "#9CA3AF",
  },
  label: {
    fontSize: 11,
    fontWeight: "500",
    color: "#111827",
    textAlign: "center",
  },
  labelUpcoming: {
    color: "#9CA3AF",
  },
  line: {
    height: 2,
    flex: 1,
    marginTop: 13.5,
    marginHorizontal: 3,
  },
  lineActive: {
    backgroundColor: "#10B981",
  },
  lineUpcoming: {
    backgroundColor: "#D1D5DB",
  },
});
