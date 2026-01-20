import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { deleteListing, getListing, updateListing } from "../api";
import { useAuth } from "../auth";
import { Toast } from "../components/Toast";
import type { RootStackParamList } from "../types";
import { colors, radius, spacing } from "../styles/theme";
import { Ionicons } from "@expo/vector-icons";

type Props = NativeStackScreenProps<RootStackParamList, "EditListing">;

export function EditListingScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [address, setAddress] = useState("");
  const [pricePerDay, setPricePerDay] = useState("");
  const [availabilityText, setAvailabilityText] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const listing = await getListing(id);
        setTitle(listing.title ?? "");
        setAddress(listing.address ?? "");
        setPricePerDay(String(listing.price_per_day ?? ""));
        setAvailabilityText(listing.availability_text ?? "");
        setImageUrl(listing.image_urls?.[0] ?? "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load listing");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id]);

  const handleSave = async () => {
    if (!token) {
      setError("Sign in to edit listings.");
      return;
    }
    const price = Number.parseFloat(pricePerDay);
    if (!title.trim() || !address.trim()) {
      setError("Title and address are required.");
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setError("Enter a valid price per day.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateListing({
        token,
        listingId: id,
        title: title.trim(),
        address: address.trim(),
        pricePerDay: price,
        availabilityText: availabilityText.trim(),
        imageUrls: imageUrl.trim() ? [imageUrl.trim()] : [],
      });
      setToast("Listing updated.");
      setTimeout(() => navigation.goBack(), 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save listing");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!token) {
      setError("Sign in to delete listings.");
      return;
    }
    Alert.alert("Delete listing", "This will permanently remove the listing.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteListing({ token, listingId: id });
            await AsyncStorage.setItem("searchRefreshToken", Date.now().toString());
            setToast("Listing deleted.");
            setTimeout(() => navigation.goBack(), 1600);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not delete listing");
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <Toast message={toast ?? ""} variant="success" visible={!!toast} />
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Edit listing</Text>
        <View style={styles.backButton} />
      </View>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.field}>
            <Text style={styles.label}>Title</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Address</Text>
            <TextInput style={styles.input} value={address} onChangeText={setAddress} />
          </View>
          <View style={styles.row}>
            <View style={styles.fieldHalf}>
              <Text style={styles.label}>Price / day</Text>
              <TextInput
                style={styles.input}
                value={pricePerDay}
                onChangeText={setPricePerDay}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.label}>Availability</Text>
              <TextInput
                style={styles.input}
                value={availabilityText}
                onChangeText={setAvailabilityText}
                placeholder="Available every day"
                placeholderTextColor="#94a3b8"
              />
            </View>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Image URL</Text>
            <TextInput
              style={styles.input}
              value={imageUrl}
              onChangeText={setImageUrl}
              autoCapitalize="none"
            />
          </View>
          <Pressable style={styles.primaryButton} onPress={handleSave} disabled={saving}>
            <Text style={styles.primaryButtonText}>
              {saving ? "Saving..." : "Save changes"}
            </Text>
          </Pressable>
          <Pressable style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>Delete listing</Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.appBg,
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
  },
  field: {
    marginTop: 14,
  },
  fieldHalf: {
    flex: 1,
  },
  row: {
    flexDirection: "row",
    gap: 12,
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
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 14,
    marginTop: 20,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: colors.cardBg,
    fontSize: 15,
    fontWeight: "600",
  },
  deleteButton: {
    alignItems: "center",
    borderRadius: 12,
    marginTop: 12,
    paddingVertical: 12,
  },
  deleteButtonText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "600",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  error: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderRadius: 12,
    borderWidth: 1,
    color: colors.danger,
    fontSize: 12,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
