import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { getListingImageUploadUrl } from "../../api";
import { useAuth } from "../../auth";
import { useListingFlow } from "./context";
import { FlowHeader } from "./FlowHeader";
import { StepQuestion, StepSection } from "./StepQuestion";
import { FlowFooter } from "./FlowFooter";
import { hostFlowColors } from "./hostFlowTheme";
import { colors } from "../../styles/theme";
import { Camera, GripVertical, Plus, Star, X } from "lucide-react-native";
import { buildStreetViewImageUrl } from "../../utils/streetView";

const GRID_COLS = 2;
const GRID_GAP = 10;
const PHOTO_ASPECT = 1.2;

type FlowStackParamList = {
  ListingPhotos: { fromReview?: boolean } | undefined;
  ListingPrice: undefined;
  ListingReview: undefined;
};

type Props = NativeStackScreenProps<FlowStackParamList, "ListingPhotos">;

const ACCENT = hostFlowColors.accent;
const FG = hostFlowColors.text;
const MUTED = hostFlowColors.textMuted;
// No card shadow: the system separates with a rule and white space.

const MAX_PHOTO_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

// Generous because photos can be several MB on slow uplinks, but bounded so a
// stalled connection can't leave the "Uploading…" state stuck forever.
const UPLOAD_TIMEOUT_MS = 60_000;

function uploadToS3(uploadUrl: string, formData: FormData): Promise<{ ok: boolean; status: number; body: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4) return;
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, body: xhr.responseText ?? "" });
    };
    xhr.onerror = () => resolve({ ok: false, status: 0, body: "" });
    xhr.timeout = UPLOAD_TIMEOUT_MS;
    xhr.ontimeout = () => resolve({ ok: false, status: 0, body: "timeout" });
    xhr.open("POST", uploadUrl);
    xhr.send(formData);
  });
}

export function ListingPhotosScreen({ navigation, route }: Props) {
  const { draft, setDraft } = useListingFlow();
  const fromReview = route.params?.fromReview ?? false;
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const [uploading, setUploading] = useState(false);
  const [uploadLabel, setUploadLabel] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const streetViewCoverUrl = useMemo(() => {
    const { latitude, longitude } = draft.location;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return buildStreetViewImageUrl({
      coverPanoId: draft.coverPanoId,
      coverHeading: draft.coverHeading,
      coverPitch: draft.coverPitch,
      latitude,
      longitude,
      mapsKey,
    });
  }, [draft.coverHeading, draft.coverPitch, draft.coverPanoId, draft.location, mapsKey]);
  const photos = useMemo(() => draft.photos.filter((photo) => photo?.trim()), [draft.photos]);
  const photoItems = useMemo(
    () => [
      ...(streetViewCoverUrl ? [{ uri: streetViewCoverUrl, kind: "street-view" as const }] : []),
      ...photos.map((uri) => ({ uri, kind: "uploaded" as const })),
    ],
    [photos, streetViewCoverUrl]
  );
  const hasPhoto = photoItems.length > 0;
  const hasStreetView = Boolean(streetViewCoverUrl);

  const exitFlow = () => {
    const parent = navigation.getParent();
    if (parent?.canGoBack()) parent.goBack();
  };

  const removePhoto = (url: string) => {
    setDraft((prev) => ({
      ...prev,
      photos: prev.photos.filter((photo) => photo !== url),
    }));
  };

  // ── Drag-to-reorder (PanResponder + Animated, no native deps) ───────────────
  // The Street View cover stays pinned at index 0; uploaded photos reorder.
  const [gridWidth, setGridWidth] = useState(0);
  const itemW = gridWidth > 0 ? (gridWidth - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS : 0;
  const itemH = itemW > 0 ? itemW / PHOTO_ASPECT : 0;

  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);
  const pan = useRef(new Animated.ValueXY()).current;

  // Refs keep the latest geometry/state available inside PanResponder closures.
  const targetRef = useRef<number | null>(null);
  const geomRef = useRef({ itemW, itemH, count: photoItems.length, firstDraggable: hasStreetView ? 1 : 0 });
  geomRef.current = { itemW, itemH, count: photoItems.length, firstDraggable: hasStreetView ? 1 : 0 };

  const commitReorder = (fromItemsIdx: number) => {
    const to = targetRef.current;
    const offset = hasStreetView ? 1 : 0;
    setDraggingIndex(null);
    setTargetIndex(null);
    targetRef.current = null;
    pan.setValue({ x: 0, y: 0 });
    if (to == null || to === fromItemsIdx) return;
    const from = fromItemsIdx - offset;
    const dest = to - offset;
    setDraft((prev) => {
      const next = [...prev.photos];
      if (from < 0 || from >= next.length) return prev;
      const [moved] = next.splice(from, 1);
      next.splice(Math.max(0, Math.min(next.length, dest)), 0, moved);
      return { ...prev, photos: next };
    });
  };

  // One PanResponder per uploaded cell; rebuilt only when the list or cell size
  // changes. Reorder commits on release, so indices stay stable mid-drag.
  const responders = useMemo(() => {
    return photoItems.map((photo, idx) => {
      if (photo.kind !== "uploaded") return null;
      return PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        // Capture the move so the enclosing ScrollView doesn't steal the drag.
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6,
        onMoveShouldSetPanResponderCapture: (_e, g) => Math.abs(g.dx) > 8 || Math.abs(g.dy) > 8,
        onPanResponderGrant: () => {
          pan.setValue({ x: 0, y: 0 });
          targetRef.current = idx;
          setDraggingIndex(idx);
          setTargetIndex(idx);
        },
        onPanResponderMove: (_e, g) => {
          pan.setValue({ x: g.dx, y: g.dy });
          const { itemW: w, itemH: h, count, firstDraggable } = geomRef.current;
          if (w <= 0 || h <= 0) return;
          const col0 = idx % GRID_COLS;
          const row0 = Math.floor(idx / GRID_COLS);
          const cx = col0 * (w + GRID_GAP) + w / 2 + g.dx;
          const cy = row0 * (h + GRID_GAP) + h / 2 + g.dy;
          let col = Math.round((cx - w / 2) / (w + GRID_GAP));
          let row = Math.round((cy - h / 2) / (h + GRID_GAP));
          col = Math.max(0, Math.min(GRID_COLS - 1, col));
          row = Math.max(0, row);
          let t = row * GRID_COLS + col;
          t = Math.max(firstDraggable, Math.min(count - 1, t));
          if (t !== targetRef.current) {
            targetRef.current = t;
            setTargetIndex(t);
          }
        },
        onPanResponderRelease: () => commitReorder(idx),
        onPanResponderTerminate: () => commitReorder(idx),
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoItems, itemW, itemH, hasStreetView]);

  const uploadAsset = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!token) throw new Error("Sign in to upload photos.");
    const contentType = asset.mimeType ?? "image/jpeg";
    if (!ALLOWED_IMAGE_TYPES.has(contentType.toLowerCase())) {
      throw new Error("Unsupported file type. Please upload a JPG, PNG, WEBP, or HEIC image.");
    }
    const fileSize = asset.fileSize ?? 0;
    if (!fileSize || fileSize > MAX_PHOTO_UPLOAD_BYTES) {
      throw new Error("Each photo must be 10MB or smaller.");
    }
    const upload = await getListingImageUploadUrl({ token, contentType, fileSizeBytes: fileSize });
    if (!upload.uploadUrl || !upload.uploadFields) throw new Error("Upload URL is missing.");
    if (!asset.uri) throw new Error("Selected photo is missing a file URI.");

    const formData = new FormData();
    Object.entries(upload.uploadFields).forEach(([key, value]) => {
      formData.append(key, value);
    });
    formData.append("file", {
      uri: asset.uri,
      name: `listing-photo.${contentType.split("/")[1] ?? "jpg"}`,
      type: contentType,
    } as unknown as Blob);

    const result = await uploadToS3(upload.uploadUrl, formData);
    if (!result.ok) {
      if (result.body === "timeout") throw new Error("Upload timed out. Check your connection and try again.");
      if (result.body.includes("AccessDenied")) throw new Error("Image upload is currently unavailable.");
      if (result.body.includes("SignatureDoesNotMatch")) throw new Error("Image upload signature failed.");
      if (result.body.includes("InvalidAccessKeyId") || result.body.includes("InvalidToken")) throw new Error("Image upload credentials are invalid.");
      throw new Error("Upload failed. The storage service rejected the image.");
    }
    return upload.publicUrl;
  };

  const uploadPhotos = async () => {
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
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: 0,
      quality: 0.85,
      orderedSelection: true,
    });
    if (result.canceled || !result.assets?.length) return;
    setUploading(true);
    const nextUrls: string[] = [];
    try {
      for (let i = 0; i < result.assets.length; i += 1) {
        setUploadLabel(`Uploading ${i + 1} of ${result.assets.length}…`);
        const asset = result.assets[i];
        if (!asset) continue;
        const url = await uploadAsset(asset);
        if (url) nextUrls.push(url);
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      if (nextUrls.length > 0) {
        setDraft((prev) => {
          const merged = [...prev.photos, ...nextUrls];
          const deduped = Array.from(new Set(merged.filter((v) => v?.trim())));
          return { ...prev, photos: deduped };
        });
      }
      setUploading(false);
      setUploadLabel(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <FlowHeader current={7} onClose={exitFlow} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 104 + Math.max(insets.bottom, 0) }]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={draggingIndex === null}
      >
        {/* Header card */}
        <StepQuestion
            title={"Show off your space"}
          hint={"The first photo is your cover — drag to reorder."}
/>

        {/* Photos card */}
        <View style={styles.section}>
          <StepSection title="Your photos" />
          <View style={styles.cardBody}>
            {uploadError ? <Text style={styles.errorText}>{uploadError}</Text> : null}

            {!hasPhoto ? (
              <Pressable
                style={[styles.emptyZone, uploading && styles.emptyZoneDisabled]}
                onPress={uploadPhotos}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="large" color={ACCENT} />
                ) : (
                  <>
                    <View style={styles.emptyIconWrap}>
                      <Camera size={28} color={ACCENT} strokeWidth={1.8} />
                    </View>
                    <Text style={styles.emptyTitle}>Add photos</Text>
                    <Text style={styles.emptyHint}>JPG, PNG, WEBP or HEIC · max 10MB each</Text>
                  </>
                )}
              </Pressable>
            ) : (
              <>
                {photoItems.length > 1 ? (
                  <Text style={styles.reorderHint}>Hold and drag a photo to reorder. The first photo is your cover.</Text>
                ) : null}
                <View
                  style={styles.grid}
                  onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}
                >
                  {photoItems.map((photo, index) => {
                    const isDragging = draggingIndex === index;
                    const isTarget = targetIndex === index && draggingIndex !== index;
                    const sizeStyle = itemW > 0 ? { width: itemW, height: itemH } : styles.photoCardFallback;
                    const responder = responders[index];
                    return (
                      <Animated.View
                        key={`${photo.kind}:${photo.uri}`}
                        {...(responder ? responder.panHandlers : {})}
                        style={[
                          styles.photoCard,
                          sizeStyle,
                          isTarget && styles.photoCardTarget,
                          isDragging && {
                            zIndex: 20,
                            transform: [...pan.getTranslateTransform(), { scale: 1.05 }],
                            ...styles.photoCardLifted,
                          },
                        ]}
                      >
                        <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                        {index === 0 ? (
                          <View style={styles.coverBadge}>
                            <Star size={10} color={colors.textInverse} strokeWidth={2.5} fill={colors.textInverse} />
                            <Text style={styles.coverBadgeText}>Cover</Text>
                          </View>
                        ) : null}
                        {photo.kind === "uploaded" ? (
                          <View style={styles.dragHandle} pointerEvents="none">
                            <GripVertical size={13} color={colors.textInverse} strokeWidth={2.5} />
                          </View>
                        ) : null}
                        <Pressable
                          style={styles.removeBtn}
                          onPress={() =>
                            photo.kind === "street-view"
                              ? setDraft((prev) => ({ ...prev, coverHeading: null, coverPitch: null, coverPanoId: null }))
                              : removePhoto(photo.uri)
                          }
                          hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                        >
                          <X size={12} color={colors.textInverse} strokeWidth={2.8} />
                        </Pressable>
                      </Animated.View>
                    );
                  })}
                </View>

                <Pressable
                  style={[styles.addMoreBtn, uploading && styles.addMoreBtnDisabled]}
                  onPress={uploadPhotos}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <ActivityIndicator size="small" color={ACCENT} />
                      {uploadLabel ? <Text style={styles.addMoreText}>{uploadLabel}</Text> : null}
                    </>
                  ) : (
                    <>
                      <Plus size={16} color={ACCENT} strokeWidth={2.2} />
                      <Text style={styles.addMoreText}>Add more photos</Text>
                    </>
                  )}
                </Pressable>
              </>
            )}

            {!hasPhoto ? (
              <Text style={styles.noPhotoNote}>
                Listings without a photo are easy for drivers to scroll past.
              </Text>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <FlowFooter
        current={7}
        total={9}
        onBack={() => (fromReview ? navigation.navigate("ListingReview") : navigation.goBack())}
        primaryLabel={fromReview ? "Save changes" : hasPhoto ? "Continue" : "Skip for now"}
        onPrimary={() => navigation.navigate(fromReview ? "ListingReview" : "ListingPrice")}
        primaryDisabled={uploading}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: hostFlowColors.bg },
  content: {
    paddingHorizontal: 24,
    paddingTop: 28,
    gap: 14,
  },

  // ── Header card (matches location screen style) ──────────────

  // ── Photos card ──────────────────────────────────────────────
  section: { paddingTop: 14 },
  // No inset of its own: the 24px gutter belongs to the step's content
  // container, and a second padding here pushed photos off that shared edge.
  cardBody: {},
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontFamily: "PlusJakartaSans-SemiBold",
    marginBottom: 12,
  },

  emptyZone: {
    borderWidth: 1.5,
    borderColor: hostFlowColors.accentSoftBorder,
    borderStyle: "dashed",
    borderRadius: 14,
    paddingVertical: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: hostFlowColors.accentSoft,
    gap: 10,
  },
  emptyZoneDisabled: {
    opacity: 0.6,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: hostFlowColors.accentSoftBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    color: FG,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 15,
    letterSpacing: -0.3,
  },
  emptyHint: {
    color: MUTED,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12,
    lineHeight: 18,
  },

  reorderHint: {
    color: MUTED,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
  },
  photoCard: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: hostFlowColors.accentSoft,
    position: "relative",
    borderWidth: 2,
    borderColor: "transparent",
  },
  photoCardFallback: {
    width: "48%",
    aspectRatio: 1.2,
  },
  photoCardTarget: {
    borderColor: ACCENT,
  },
  photoCardLifted: {
    shadowColor: colors.viewerBackdrop,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
  },
  photoImage: {
    width: "100%",
    height: "100%",
  },
  dragHandle: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  coverBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(10, 128, 80, 0.88)",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  coverBadgeText: {
    color: colors.textInverse,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 11,
    letterSpacing: 0.2,
  },
  removeBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    alignItems: "center",
    justifyContent: "center",
  },

  addMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 10,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: hostFlowColors.accentSoftBorder,
    backgroundColor: hostFlowColors.accentSoft,
  },
  addMoreBtnDisabled: {
    opacity: 0.5,
  },
  addMoreText: {
    color: ACCENT,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14,
  },
  noPhotoNote: {
    color: MUTED,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 10,
    textAlign: "center",
  },

  // ── Tips card ────────────────────────────────────────────────
});
