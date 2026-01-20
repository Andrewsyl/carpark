import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { getListingImageUploadUrl } from "../../api";
import { useAuth } from "../../auth";
import { useListingFlow } from "./context";
import { StepProgress } from "./StepProgress";
import { colors, spacing, textStyles } from "../../styles/theme";

type FlowStackParamList = {
  ListingPhotos: undefined;
  ListingReview: undefined;
};

type Props = NativeStackScreenProps<FlowStackParamList, "ListingPhotos">;

export function ListingPhotosScreen({ navigation }: Props) {
  const { draft, setDraft } = useListingFlow();
  const { token } = useAuth();
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const hasPhoto = draft.photos.some((photo) => photo?.trim());

  const updatePhoto = (index: number, value: string) => {
    setDraft((prev) => {
      const next = [...prev.photos];
      next[index] = value;
      return { ...prev, photos: next };
    });
  };

  const removePhoto = (index: number) => {
    setDraft((prev) => {
      const next = [...prev.photos];
      next[index] = "";
      return { ...prev, photos: next };
    });
  };

  const uploadPhoto = async (index: number) => {
    if (!token) {
      Alert.alert("Sign in required", "Please sign in to upload photos.");
      return;
    }
    setUploadError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Enable photo access to upload images.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.uri) return;
    const contentType = asset.mimeType ?? "image/jpeg";
    setUploadingIndex(index);
    try {
      const upload = await getListingImageUploadUrl({ token, contentType });
      const fileResponse = await fetch(asset.uri);
      const blob = await fileResponse.blob();
      const putResult = await fetch(upload.signedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": contentType,
        },
        body: blob,
      });
      if (!putResult.ok) {
        throw new Error("Upload failed. Try again.");
      }
      updatePhoto(index, upload.publicUrl);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploadingIndex(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>Add photos (optional)</Text>
        <StepProgress current={6} total={7} />
        <Text style={styles.title}>Show off your space</Text>
        <Text style={styles.subtitle}>
          Photos help drivers trust your listing, but you can add them later.
        </Text>

        {uploadError ? <Text style={styles.errorText}>{uploadError}</Text> : null}
        {[0, 1, 2].map((index) => {
          const uri = draft.photos[index];
          const isUploading = uploadingIndex === index;
          return (
            <View key={index} style={styles.field}>
              <Text style={styles.label}>Photo {index + 1}</Text>
              {uri ? (
                <View style={styles.previewRow}>
                  <Image source={{ uri }} style={styles.previewImage} />
                  <View style={styles.previewActions}>
                    <Pressable
                      style={styles.secondaryButton}
                      onPress={() => uploadPhoto(index)}
                      disabled={isUploading}
                    >
                      {isUploading ? (
                        <ActivityIndicator size="small" color="#00d4aa" />
                      ) : (
                        <Text style={styles.secondaryButtonText}>Replace</Text>
                      )}
                    </Pressable>
                    <Pressable style={styles.removeButton} onPress={() => removePhoto(index)}>
                      <Text style={styles.removeButtonText}>Remove</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  style={styles.uploadButton}
                  onPress={() => uploadPhoto(index)}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.uploadButtonText}>Upload from phone</Text>
                  )}
                </Pressable>
              )}
              <TextInput
                style={styles.input}
                value={uri ?? ""}
                onChangeText={(value) => updatePhoto(index, value)}
                placeholder="Or paste a URL"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
              />
            </View>
          );
        })}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable
          style={[
            styles.primaryButton,
            (!hasPhoto || uploadingIndex !== null) && styles.primaryButtonDisabled,
          ]}
          onPress={() => navigation.navigate("ListingReview")}
          disabled={!hasPhoto || uploadingIndex !== null}
        >
          <Text style={styles.primaryButtonText}>Continue</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate("ListingReview")}>
          <Text style={styles.secondaryButtonText}>Skip for now</Text>
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
  content: {
    padding: spacing.screenX,
    paddingBottom: 160,
    paddingTop: 0,
  },
  kicker: textStyles.kicker,
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "600",
    marginTop: 6,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 6,
    lineHeight: 20,
  },
  field: {
    marginTop: 16,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
    letterSpacing: 0.5,
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
  previewRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    marginBottom: 10,
  },
  previewImage: {
    borderRadius: 12,
    height: 70,
    width: 100,
  },
  previewActions: {
    flex: 1,
    gap: 8,
  },
  uploadButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 12,
    marginBottom: 10,
    minHeight: 44,
    justifyContent: "center",
  },
  uploadButtonText: {
    color: colors.cardBg,
    fontSize: 14,
    fontWeight: "600",
  },
  removeButton: {
    alignItems: "center",
    borderColor: "#fecaca",
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 8,
  },
  removeButtonText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "600",
  },
  footer: {
    backgroundColor: colors.cardBg,
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
  primaryButtonDisabled: {
    backgroundColor: "#cbd5e1",
  },
  primaryButtonText: {
    color: colors.cardBg,
    fontSize: 15,
    fontWeight: "600",
  },
  secondaryButton: {
    alignItems: "center",
    borderRadius: 14,
    marginTop: 10,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  secondaryButtonText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "600",
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 10,
  },
});
