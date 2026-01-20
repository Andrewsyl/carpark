import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export function PricePin({ label, selected }: { label?: string; selected?: boolean }) {
  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.hitArea} />
      <View style={styles.pinWrapper}>
        {/* Main pin container */}
        {selected ? (
          <LinearGradient
            colors={["#10b981", "#14b8a6"]} // emerald-500 to teal-600
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.pinContainer, styles.selectedContainer]}
          >
            <Text style={styles.selectedText}>{label ?? ""}</Text>
          </LinearGradient>
        ) : (
          <View style={[styles.pinContainer, styles.unselectedContainer]}>
            <View style={styles.border} />
            <Text style={styles.unselectedText}>{label ?? ""}</Text>
          </View>
        )}

        {/* Triangle pointer with border */}
        <View style={styles.triangleWrapper}>
          {/* Border triangle (larger, underneath) */}
          {!selected && (
            <View style={styles.triangleBorder} />
          )}
          {/* Main triangle */}
          <View
            style={[
              styles.triangle,
              selected ? styles.triangleSelected : styles.triangleUnselected,
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    position: "relative",
  },
  hitArea: {
    position: "absolute",
    width: 64,
    height: 64,
    top: -16,
    left: -16,
    zIndex: -1,
  },
  pinWrapper: {
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
    fontWeight: "600",
  },
  unselectedText: {
    color: "#047857", // emerald-700
    fontSize: 13,
    fontWeight: "600",
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
});
