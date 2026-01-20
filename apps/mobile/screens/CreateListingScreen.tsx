import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { createListing } from "../api";
import { useAuth } from "../auth";
import type { RootStackParamList } from "../types";
import { cardShadow, colors, radius, spacing, textStyles } from "../styles/theme";
import { Ionicons } from "@expo/vector-icons";

type Props = NativeStackScreenProps<RootStackParamList, "CreateListing">;

export function CreateListingScreen({ navigation }: Props) {
  const { token, user } = useAuth();
  const [title, setTitle] = useState("");
  const [address, setAddress] = useState("");
  const [pricePerDay, setPricePerDay] = useState("");
  const [availabilityText, setAvailabilityText] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!token) {
      setError("Sign in to create a listing.");
      return;
    }
    if (!title.trim() || !address.trim() || !pricePerDay.trim()) {
      setError("Title, address, and price are required.");
      return;
    }
    const price = Number.parseFloat(pricePerDay);
    const lat = Number.parseFloat(latitude);
    const lng = Number.parseFloat(longitude);
    if (!Number.isFinite(price) || price <= 0) {
      setError("Enter a valid price per day.");
      return;
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setError("Latitude and longitude are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createListing({
        token,
        title: title.trim(),
        address: address.trim(),
        pricePerDay: price,
        availabilityText: availabilityText.trim() || "Available now",
        latitude: lat,
        longitude: lng,
        imageUrls: imageUrl.trim() ? [imageUrl.trim()] : [],
      });
      navigation.replace("Listings");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Listing creation failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>List a space</Text>
        <View style={styles.backButton} />
      </View>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.kicker}>Host details</Text>
            <Text style={styles.subtitle}>
              Add the essentials so drivers can find and book your space.
            </Text>
            {user?.email ? <Text style={styles.notice}>Listing as {user.email}</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.field}>
              <Text style={styles.label}>Title</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Private driveway near city centre"
                placeholderTextColor="#94a3b8"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Address</Text>
              <TextInput
                style={styles.input}
                value={address}
                onChangeText={setAddress}
                placeholder="123 Example Street, Dublin"
                placeholderTextColor="#94a3b8"
              />
            </View>
            <View style={styles.row}>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>Price / day</Text>
                <TextInput
                  style={styles.input}
                  value={pricePerDay}
                  onChangeText={setPricePerDay}
                  keyboardType="decimal-pad"
                  placeholder="22"
                  placeholderTextColor="#94a3b8"
                />
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>Availability</Text>
                <TextInput
                  style={styles.input}
                  value={availabilityText}
                  onChangeText={setAvailabilityText}
                  placeholder="Available now"
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>Latitude</Text>
                <TextInput
                  style={styles.input}
                  value={latitude}
                  onChangeText={setLatitude}
                  keyboardType="decimal-pad"
                  placeholder="53.3498"
                  placeholderTextColor="#94a3b8"
                />
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>Longitude</Text>
                <TextInput
                  style={styles.input}
                  value={longitude}
                  onChangeText={setLongitude}
                  keyboardType="decimal-pad"
                  placeholder="-6.2603"
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Image URL (optional)</Text>
              <TextInput
                style={styles.input}
                value={imageUrl}
                onChangeText={setImageUrl}
                placeholder="https://..."
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={styles.footer}>
        <Pressable style={styles.primaryButton} onPress={handleCreate} disabled={submitting}>
          <Text style={styles.primaryButtonText}>
            {submitting ? "Creating..." : "Publish listing"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.appBg,
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.screenX,
    paddingTop: 8,
  },
  backButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  backCircle: {
    alignItems: "center",
    justifyContent: "center",
    height: 32,
    width: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBg,
  },
  backIcon: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 14,
    textAlign: "center",
    fontWeight: "600",
  },
  topTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  content: {
    padding: spacing.screenX,
    paddingBottom: 120,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.card,
    ...cardShadow,
  },
  kicker: textStyles.kicker,
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 6,
  },
  notice: {
    backgroundColor: "#ecfeff",
    borderColor: "#99f6e4",
    borderRadius: 12,
    borderWidth: 1,
    color: colors.text,
    fontSize: 12,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  error: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderRadius: 12,
    borderWidth: 1,
    color: colors.danger,
    fontSize: 12,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  field: {
    marginTop: 14,
  },
  fieldHalf: {
    flex: 1,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.text,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  footer: {
    backgroundColor: colors.appBg,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    padding: 16,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: colors.cardBg,
    fontSize: 15,
    fontWeight: "600",
  },
});
