import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import type { RootStackParamList } from "../types";
import { colors, radius, spacing } from "../styles/theme";

type Props = NativeStackScreenProps<RootStackParamList, "VehicleType">;

const VEHICLE_MAKE_KEY = "vehicle.make";
const VEHICLE_COLOR_KEY = "vehicle.color";
const VEHICLE_MAKES = [
  "Audi",
  "BMW",
  "Citroen",
  "Cupra",
  "Dacia",
  "Fiat",
  "Ford",
  "Honda",
  "Hyundai",
  "Kia",
  "Land Rover",
  "Mazda",
  "Mercedes-Benz",
  "Mini",
  "Nissan",
  "Opel",
  "Peugeot",
  "Renault",
  "Seat",
  "Skoda",
  "Tesla",
  "Toyota",
  "Volkswagen",
  "Volvo",
  "Other",
];

const VEHICLE_COLORS = [
  "Black",
  "White",
  "Silver",
  "Grey",
  "Blue",
  "Red",
  "Green",
  "Yellow",
  "Orange",
  "Brown",
  "Gold",
  "Other",
];

export function VehicleTypeScreen({ navigation }: Props) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const [selectedColor, setSelectedColor] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [savedMake, savedColor] = await Promise.all([
          AsyncStorage.getItem(VEHICLE_MAKE_KEY),
          AsyncStorage.getItem(VEHICLE_COLOR_KEY),
        ]);
        if (!active) return;
        if (savedMake) setSelected(savedMake);
        if (savedColor) setSelectedColor(savedColor);
      } catch {
        // ignore
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return VEHICLE_MAKES;
    return VEHICLE_MAKES.filter((make) => make.toLowerCase().includes(term));
  }, [query]);

  const handleSelect = (type: string) => {
    setSelected(type);
  };

  const handleSave = async () => {
    if (!selected) return;
    await AsyncStorage.setItem(VEHICLE_MAKE_KEY, selected);
    if (selectedColor) {
      await AsyncStorage.setItem(VEHICLE_COLOR_KEY, selectedColor);
    } else {
      await AsyncStorage.removeItem(VEHICLE_COLOR_KEY);
    }
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Vehicle make</Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.searchCard}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search vehicle make"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [
              styles.optionRow,
              selected === item && styles.optionRowSelected,
              pressed && styles.optionRowPressed,
            ]}
            onPress={() => handleSelect(item)}
          >
            <Text style={styles.optionText}>{item}</Text>
            {selected === item ? (
              <Ionicons name="checkmark" size={18} color={colors.accent} />
            ) : null}
          </Pressable>
        )}
        ListFooterComponent={
          <View style={styles.colorSection}>
            <Text style={styles.colorTitle}>Color</Text>
            <View style={styles.colorGrid}>
              {VEHICLE_COLORS.map((color) => {
                const active = selectedColor === color;
                return (
                  <Pressable
                    key={color}
                    onPress={() => setSelectedColor(color)}
                    style={[styles.colorChip, active && styles.colorChipActive]}
                  >
                    <Text style={[styles.colorText, active && styles.colorTextActive]}>
                      {color}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
      />

      <View style={styles.footer}>
        <Pressable
          style={[styles.saveButton, !selected && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!selected}
        >
          <Text style={styles.saveButtonText}>Save vehicle</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.appBg,
  },
  topBar: {
    alignItems: "center",
    backgroundColor: colors.headerTint,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.screenX,
    paddingVertical: 10,
  },
  backButton: {
    width: 40,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  searchCard: {
    marginHorizontal: spacing.screenX,
    marginTop: 14,
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: spacing.screenX,
    paddingVertical: 12,
    paddingBottom: 120,
  },
  optionRow: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  optionRowSelected: {
    borderColor: colors.accent,
  },
  optionRowPressed: {
    opacity: 0.85,
  },
  optionText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  colorSection: {
    marginTop: 16,
  },
  colorTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 10,
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  colorChip: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.cardBg,
  },
  colorChipActive: {
    borderColor: colors.accent,
    backgroundColor: "#E7F4F6",
  },
  colorText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  colorTextActive: {
    color: colors.accent,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.screenX,
    paddingVertical: 14,
    backgroundColor: colors.appBg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveButtonDisabled: {
    backgroundColor: "#cbd5e1",
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
});
