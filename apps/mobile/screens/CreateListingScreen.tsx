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
          <Text style={styles.backLabel}>Back</Text>
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
    backgroundColor: "#f8fafc",
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  backButton: {
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  backLabel: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "700",
  },
  topTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "700",
  },
  content: {
    padding: 18,
    paddingBottom: 120,
  },
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  kicker: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  subtitle: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 6,
  },
  notice: {
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
    borderRadius: 12,
    borderWidth: 1,
    color: "#1d4ed8",
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
    color: "#b42318",
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
    color: "#475569",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    borderColor: "#e2e8f0",
    borderRadius: 12,
    borderWidth: 1,
    color: "#0f172a",
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  footer: {
    backgroundColor: "#f8fafc",
    borderTopColor: "#e2e8f0",
    borderTopWidth: 1,
    padding: 16,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#2fa84f",
    borderRadius: 14,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
});
