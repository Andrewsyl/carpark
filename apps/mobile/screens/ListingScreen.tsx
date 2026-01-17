import { CommonActions } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  InteractionManager,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import ImageViewer from "react-native-image-zoom-viewer";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import LottieView from "lottie-react-native";
import DatePicker from "react-native-date-picker";
import { cardShadow, colors, radius, spacing, textStyles } from "../styles/theme";
import { useStripe } from "@stripe/stripe-react-native";
import * as Notifications from "expo-notifications";
import {
  confirmBookingPayment,
  createBookingPaymentIntent,
  getListing,
  listListingReviews,
  type ListingReview,
} from "../api";
import { useAuth } from "../auth";
import { useFavorites } from "../favorites";
import { logError, logInfo } from "../logger";
import type { ListingDetail, RootStackParamList } from "../types";
import { Ionicons } from "@expo/vector-icons";

type Props = NativeStackScreenProps<RootStackParamList, "Listing">;

const formatDateLabel = (date: Date) =>
  date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

const formatTimeLabel = (date: Date) =>
  date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

const formatDateTimeLabel = (date: Date) => `${formatDateLabel(date)} · ${formatTimeLabel(date)}`;

const snapTo5Minutes = (date: Date) => {
  const next = new Date(date);
  const minutes = next.getMinutes();
  const snapped = Math.round(minutes / 5) * 5;
  next.setMinutes(snapped, 0, 0);
  return next;
};

const getFeatureIconType = (label: string) => {
  const normalized = label.toLowerCase();
  if (normalized.includes("cctv") || normalized.includes("camera")) return "camera";
  if (normalized.includes("ev") || normalized.includes("charge")) return "bolt";
  if (normalized.includes("gate") || normalized.includes("gated")) return "lock";
  if (normalized.includes("permit")) return "ticket";
  if (normalized.includes("covered") || normalized.includes("roof")) return "roof";
  return "pin";
};

const FeatureIcon = ({ type }: { type: string }) => {
  const stroke = "#0f172a";
  switch (type) {
    case "camera":
      return (
        <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
          <Rect x={2.5} y={5} width={13} height={9} rx={2} stroke={stroke} strokeWidth={1.5} />
          <Circle cx={9} cy={9.5} r={2.2} stroke={stroke} strokeWidth={1.5} />
          <Path d="M6 5l1.2-2h3.6L12 5" stroke={stroke} strokeWidth={1.5} />
        </Svg>
      );
    case "bolt":
      return (
        <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
          <Path
            d="M10.5 1.5L5 9h3l-1 7.5L13 8.5h-3l.5-7z"
            stroke={stroke}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        </Svg>
      );
    case "lock":
      return (
        <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
          <Rect x={4} y={8} width={10} height={7} rx={2} stroke={stroke} strokeWidth={1.5} />
          <Path d="M6.5 8V6.2A2.5 2.5 0 0 1 9 3.7a2.5 2.5 0 0 1 2.5 2.5V8" stroke={stroke} strokeWidth={1.5} />
        </Svg>
      );
    case "ticket":
      return (
        <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
          <Rect x={2.5} y={4} width={13} height={10} rx={2} stroke={stroke} strokeWidth={1.5} />
          <Path d="M6 4v10" stroke={stroke} strokeWidth={1.5} strokeDasharray="2 2" />
        </Svg>
      );
    case "roof":
      return (
        <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
          <Path d="M2.5 9l6.5-5 6.5 5" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" />
          <Rect x={4.5} y={9} width={9} height={5.5} rx={1.5} stroke={stroke} strokeWidth={1.5} />
        </Svg>
      );
    case "pin":
    default:
      return (
        <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
          <Path
            d="M9 2.5a4 4 0 0 1 4 4c0 3-4 7-4 7s-4-4-4-7a4 4 0 0 1 4-4z"
            stroke={stroke}
            strokeWidth={1.5}
          />
          <Circle cx={9} cy={6.5} r={1.3} stroke={stroke} strokeWidth={1.5} />
        </Svg>
      );
  }
};

export function ListingScreen({ navigation, route }: Props) {
  const { id, from, to } = route.params;
  const { token, login, register, loading: authLoading, user } = useAuth();
  const { isFavorite, toggle } = useFavorites();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showFullAbout, setShowFullAbout] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [showFavAnim, setShowFavAnim] = useState(false);
  const [reviews, setReviews] = useState<ListingReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [navigatingToBooking, setNavigatingToBooking] = useState(false);
  const [startAt, setStartAt] = useState(() => new Date(from));
  const [endAt, setEndAt] = useState(() => new Date(to));
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerField, setPickerField] = useState<"start" | "end">("start");
  const [draftDate, setDraftDate] = useState<Date | null>(null);
  const streetViewLocation =
    listing?.latitude && listing?.longitude
      ? `${listing.latitude},${listing.longitude}`
      : "53.3498,-6.2603";

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getListing(id, {
          from: startAt.toISOString(),
          to: endAt.toISOString(),
        });
        setListing(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Listing failed";
        setError(message);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id, startAt, endAt]);

  useEffect(() => {
    setStartAt(new Date(from));
    setEndAt(new Date(to));
  }, [from, to]);

  useEffect(() => {
    let active = true;
    const loadReviews = async () => {
      if (!id) return;
      setReviewsLoading(true);
      try {
        const data = await listListingReviews(id);
        if (!active) return;
        setReviews(data);
      } catch {
        if (!active) return;
        setReviews([]);
      } finally {
        if (active) setReviewsLoading(false);
      }
    };
    void loadReviews();
    return () => {
      active = false;
    };
  }, [id]);

  const priceSummary = useMemo(() => {
    if (!listing) return null;
    const ms = Math.max(0, endAt.getTime() - startAt.getTime());
    const days = Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
    const total = listing.price_per_day * days;
    return { days, total, totalCents: Math.round(total * 100) };
  }, [listing, startAt, endAt]);

  const openPicker = (field: "start" | "end") => {
    setPickerField(field);
    const current = field === "start" ? startAt : endAt;
    setDraftDate(current);
    setPickerVisible(true);
  };

  const applyPickedDate = (next: Date) => {
    if (pickerField === "start") {
      let nextEnd = endAt;
      if (next > endAt) {
        const bumped = new Date(next);
        bumped.setHours(bumped.getHours() + 2);
        nextEnd = bumped;
        setEndAt(bumped);
      }
      setStartAt(next);
      return;
    }
    setEndAt(next);
  };

  const imageUrls = useMemo(() => {
    if (listing?.image_urls?.length) return listing.image_urls;
    if (mapsKey) {
      return [
        `https://maps.googleapis.com/maps/api/streetview?size=1280x720&location=${streetViewLocation}&fov=65&key=${mapsKey}`,
      ];
    }
    return [];
  }, [listing?.image_urls, mapsKey, streetViewLocation]);

  const amenities = listing?.amenities ?? [];
  const featureRows = amenities.length
    ? amenities
    : ["CCTV", "EV charging", "Gated", "Permit required"];
  const aboutText = listing?.availability_text ?? "No description yet.";
  const aboutPreview =
    aboutText.length > 140 ? `${aboutText.slice(0, 140).trim()}...` : aboutText;
  const hostName = "Andrew";
  const hostInitials = hostName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const hasReviews = (listing?.rating_count ?? 0) > 0 && typeof listing?.rating === "number";
  const hostRating = hasReviews && listing?.rating ? listing.rating.toFixed(1) : null;
  const hostReviews = hasReviews ? listing?.rating_count ?? 0 : 0;
  const heroHeight = Math.round(width * 0.75);
  const distanceLabel = listing?.distance_m
    ? `${(listing.distance_m / 1000).toFixed(1)} km`
    : "0.8 km";

  const handleLogin = async () => {
    setAuthError(null);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Login failed");
    }
  };

  const handleRegister = async () => {
    setAuthError(null);
    try {
      await register(email.trim(), password, {
        termsVersion: "2026-01-10",
        privacyVersion: "2026-01-10",
      });
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Sign up failed");
    }
  };

  // Booking now happens on the summary screen.

  const handleToggleFavorite = async () => {
    if (!listing) return;
    if (!user) {
      navigation.navigate("SignIn");
      return;
    }
    const wasFavorite = isFavorite(id);
    await toggle(listing);
    if (!wasFavorite) {
      setShowFavAnim(true);
    }
  };

  return (
    <>
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Listing</Text>
        <View style={styles.backButton} />
      </View>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : listing ? (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={[styles.hero, { height: heroHeight }]}>
              {imageUrls.length ? (
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={(event) => {
                    const index = Math.round(event.nativeEvent.contentOffset.x / width);
                    setActiveImageIndex(index);
                  }}
                >
                  {imageUrls.map((url, index) => (
                    <Pressable
                      key={`${url}-${index}`}
                      onPress={() => {
                        setViewerIndex(index);
                        setShowImageViewer(true);
                      }}
                    >
                      <Image
                        source={{ uri: url }}
                        style={[styles.heroImage, { width, height: heroHeight }]}
                      />
                    </Pressable>
                  ))}
      </ScrollView>

              ) : (
                <View style={[styles.heroPlaceholder, { height: heroHeight }]}>
                  <Text style={styles.heroPlaceholderText}>No image</Text>
                </View>
              )}
              <View style={styles.heroOverlay}>
                <View style={styles.heroPillDark}>
                  <Text style={styles.heroPillText}>€{listing.price_per_day} / day</Text>
                </View>
                <Pressable style={styles.heroFav} onPress={handleToggleFavorite}>
                  <Text style={[styles.heroFavText, isFavorite(id) && styles.heroFavTextActive]}>
                    {isFavorite(id) ? "♥︎" : "♡"}
                  </Text>
                  {showFavAnim ? (
                    <LottieView
                      source={require("../assets/Heart fav.json")}
                      autoPlay
                      loop={false}
                      onAnimationFinish={() => setShowFavAnim(false)}
                      style={styles.heroFavLottie}
                      pointerEvents="none"
                    />
                  ) : null}
                </Pressable>
              </View>
              {imageUrls.length > 1 ? (
                <View style={styles.dotsRow}>
                  {imageUrls.map((_, index) => (
                    <View
                      key={`dot-${index}`}
                      style={[styles.dot, index === activeImageIndex && styles.dotActive]}
                    />
                  ))}
                </View>
              ) : null}
            </View>
            <View style={styles.sheet}>
              <View style={styles.titleCard}>
                <Text style={styles.title}>{listing.title}</Text>
                <View style={styles.addressRow}>
                  <View style={styles.addressDot} />
                  <Text style={styles.address}>{listing.address}</Text>
                </View>
                <View style={styles.metricsRow}>
                  <View style={styles.metricPill}>
                    <View style={styles.metricIcon} />
                    <Text style={styles.metricText}>{distanceLabel} away</Text>
                  </View>
                  <View style={styles.metricPill}>
                    {hasReviews ? (
                      <>
                        <Text style={styles.metricStar}>★</Text>
                        <Text style={styles.metricText}>
                          {listing.rating?.toFixed(1)} ({listing.rating_count})
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.metricText}>New listing</Text>
                    )}
                  </View>
                  <View style={styles.metricPill}>
                    <View style={styles.metricIconBadge} />
                    <Text style={styles.metricText}>Verified host</Text>
                  </View>
                </View>
              </View>
              <View style={styles.timeRow}>
                <Text style={styles.timeLabel}>Selected times</Text>
                <View style={styles.dateRow}>
                  <Pressable style={styles.dateTimePill} onPress={() => openPicker("start")}>
                    <Text style={styles.dateTimeText}>{formatDateTimeLabel(startAt)}</Text>
                  </Pressable>
                  <View style={styles.dateArrow}>
                    <Text style={styles.dateArrowText}>→</Text>
                  </View>
                  <Pressable style={styles.dateTimePill} onPress={() => openPicker("end")}>
                    <Text style={styles.dateTimeText}>{formatDateTimeLabel(endAt)}</Text>
                  </Pressable>
                </View>
              </View>
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>About this space</Text>
                <Text style={styles.sectionBody}>
                  {showFullAbout ? aboutText : aboutPreview}
                </Text>
                {aboutText.length > 140 ? (
                  <Pressable onPress={() => setShowFullAbout((prev) => !prev)}>
                    <Text style={styles.readMore}>
                      {showFullAbout ? "Read less" : "Read more"}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Host</Text>
                <View style={styles.hostRow}>
                  <View style={styles.hostAvatar}>
                    <Text style={styles.hostInitials}>{hostInitials}</Text>
                  </View>
                  <View style={styles.hostMeta}>
                    <Text style={styles.hostName}>{hostName}</Text>
                    <Text style={styles.hostSub}>
                      {hasReviews
                        ? `Superhost • ${hostRating} rating • ${hostReviews} reviews`
                        : "New host • No reviews yet"}
                    </Text>
                  </View>
                </View>
                <View style={styles.hostDetailRow}>
                  <Text style={styles.hostDetailLabel}>Response time</Text>
                  <Text style={styles.hostDetailValue}>Within an hour</Text>
                </View>
                <View style={styles.hostDetailRow}>
                  <Text style={styles.hostDetailLabel}>Verified</Text>
                  <Text style={styles.hostDetailValue}>Identity + phone</Text>
                </View>
              </View>
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Features</Text>
                <View style={styles.featuresGrid}>
                  {featureRows.map((feature) => (
                    <View key={feature} style={styles.featureItem}>
                      <View style={styles.featureIcon}>
                        <FeatureIcon type={getFeatureIconType(feature)} />
                      </View>
                      <Text style={styles.featureText}>{feature}</Text>
                    </View>
                  ))}
                </View>
              </View>
              {imageUrls.length > 1 ? (
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>More photos</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {imageUrls.map((url, index) => (
                      <Image
                        key={`thumb-${index}`}
                        source={{ uri: url }}
                        style={styles.photoThumb}
                      />
                    ))}
                  </ScrollView>
                </View>
              ) : null}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Reviews</Text>
                {reviewsLoading ? (
                  <Text style={styles.sectionBody}>Loading reviews…</Text>
                ) : reviews.length === 0 ? (
                  <Text style={styles.sectionBody}>No reviews yet.</Text>
                ) : (
                  <View style={styles.reviewList}>
                    {reviews.map((review) => (
                      <View key={review.id} style={styles.reviewItem}>
                        <View style={styles.reviewRow}>
                          <Text style={styles.reviewRating}>★ {review.rating.toFixed(1)}</Text>
                          <Text style={styles.reviewDate}>
                            {new Date(review.createdAt).toLocaleDateString()}
                          </Text>
                        </View>
                        {review.comment ? (
                          <Text style={styles.reviewBody}>{review.comment}</Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                )}
              </View>
      {!user ? (
        <View style={styles.ctaCard}>
                  <Text style={styles.ctaTitle}>Sign in to book</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor="#98a2b3"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={email}
                    onChangeText={setEmail}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor="#98a2b3"
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                  />
                  {authError ? <Text style={styles.error}>{authError}</Text> : null}
                  <View style={styles.authButtons}>
                    <Pressable
                      style={styles.secondaryButton}
                      onPress={handleLogin}
                      disabled={authLoading}
                    >
                      <Text style={styles.secondaryButtonText}>Log in</Text>
                    </Pressable>
                    <Pressable
                      style={styles.primaryButton}
                      onPress={handleRegister}
                      disabled={authLoading}
                    >
                      <Text style={styles.primaryButtonText}>Create account</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </View>
          </ScrollView>
          {priceSummary && user ? (
            <View style={[styles.bottomBar, { paddingBottom: 14 + insets.bottom }]}>
              <View>
                <Text style={styles.bottomPrice}>€{priceSummary.total.toFixed(2)}</Text>
                <Text style={styles.bottomMeta}>{priceSummary.days} day(s)</Text>
              </View>
              {listing?.is_available === false ? (
                <Pressable style={[styles.bottomButton, styles.bottomButtonDisabled]} disabled>
                  <Text style={styles.bottomButtonDisabledText}>Sold out</Text>
                </Pressable>
              ) : (
              <Pressable
                style={styles.bottomButton}
                onPress={() => {
                  if (navigatingToBooking) return;
                  setNavigatingToBooking(true);
                  navigation.navigate("BookingSummary", {
                    id,
                    from: startAt.toISOString(),
                    to: endAt.toISOString(),
                  });
                  setTimeout(() => setNavigatingToBooking(false), 800);
                }}
                disabled={authLoading}
              >
                <Text style={styles.bottomButtonText}>
                  {navigatingToBooking ? "Opening..." : "Reserve"}
                </Text>
              </Pressable>
              )}
            </View>
          ) : null}
          {pickerVisible ? (
            <Modal transparent animationType="fade" visible>
              <Pressable
                style={styles.pickerBackdrop}
                onPress={() => {
                  setPickerVisible(false);
                  setDraftDate(null);
                }}
              >
                <Pressable style={styles.pickerSheet} onPress={() => undefined}>
                  <View style={styles.pickerHeader}>
                    <Text style={styles.pickerTitle}>
                      {pickerField === "start" ? "Start" : "End"}
                    </Text>
                    <Pressable
                      style={styles.pickerDone}
                      onPress={() => {
                        setPickerVisible(false);
                        setDraftDate(null);
                      }}
                    >
                      <Text style={styles.pickerDoneText}>Done</Text>
                    </Pressable>
                  </View>
                  <DatePicker
                    date={draftDate ?? (pickerField === "start" ? startAt : endAt)}
                    mode="datetime"
                    androidVariant="iosClone"
                    minuteInterval={5}
                    textColor={colors.accent}
                    onDateChange={(date) => {
                      const snapped = snapTo5Minutes(date);
                      setDraftDate(snapped);
                      applyPickedDate(snapped);
                    }}
                  />
                </Pressable>
              </Pressable>
            </Modal>
          ) : null}
          <Modal visible={showImageViewer} transparent animationType="fade">
            <View style={styles.viewerBackdrop}>
              <ImageViewer
                imageUrls={imageUrls.map((url) => ({ url }))}
                index={viewerIndex}
                enableSwipeDown
                onSwipeDown={() => setShowImageViewer(false)}
                onCancel={() => setShowImageViewer(false)}
                onClick={() => setShowImageViewer(false)}
                onChange={(index) => setViewerIndex(index ?? 0)}
                renderIndicator={() => null}
                renderHeader={() => (
                  <Pressable
                    style={[styles.viewerClose, { top: insets.top + 12 }]}
                    onPress={() => setShowImageViewer(false)}
                  >
                    <Text style={styles.viewerCloseText}>Close</Text>
                  </Pressable>
                )}
              />
            </View>
          </Modal>
        </>
      ) : null}
    </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.appBg,
    flex: 1,
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
    alignItems: "center",
    justifyContent: "center",

    paddingVertical: 6,
    width: 56,
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
    fontWeight: "700",
  },
  topTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  centered: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  content: {
    paddingBottom: 140,
    backgroundColor: colors.appBg,
  },
  hero: {
    overflow: "hidden",
    position: "relative",
  },
  heroImage: {
    height: 240,
    width: "100%",
  },
  heroPlaceholder: {
    alignItems: "center",
    backgroundColor: colors.border,
    height: 240,
    justifyContent: "center",
  },
  heroPlaceholderText: {
    color: colors.textMuted,
  },
  heroOverlay: {
    flexDirection: "row",
    gap: 8,
    left: 12,
    position: "absolute",
    top: 12,
    right: 12,
    justifyContent: "space-between",
  },
  heroFav: {
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    borderRadius: 999,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    width: 34,
    position: "relative",
  },
  heroFavText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 18,
  },
  heroFavTextActive: {
    color: colors.accent,
  },
  heroFavLottie: {
    position: "absolute",
    width: 62,
    height: 62,
  },
  dotsRow: {
    bottom: 12,
    flexDirection: "row",
    gap: 6,
    left: 0,
    position: "absolute",
    right: 0,
    justifyContent: "center",
  },
  dot: {
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  dotActive: {
    backgroundColor: colors.cardBg,
    width: 16,
  },
  heroPillDark: {
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  heroPillLight: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroPillText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  heroPillTextDark: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
  },
  sheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -28,
    paddingHorizontal: spacing.screenX,
    paddingTop: 20,
  },
  titleCard: {
    gap: 8,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  addressRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  addressDot: {
    backgroundColor: colors.textSoft,
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  address: {
    color: colors.textMuted,
    fontSize: 13,
  },
  headerBlock: {
    marginBottom: 6,
  },
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  metricPill: {
    alignItems: "center",
    backgroundColor: colors.appBg,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metricText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  metricIcon: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  metricStar: {
    color: "#f59e0b",
    fontSize: 12,
    fontWeight: "700",
  },
  metricIconBadge: {
    backgroundColor: "#22c55e",
    borderRadius: 3,
    height: 8,
    width: 8,
  },
  timeRow: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  timeLabel: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  dateRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  dateTimePill: {
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  dateTimeText: {
    color: "#101828",
    fontSize: 12,
    fontWeight: "600",
  },
  dateArrow: {
    alignItems: "center",
    justifyContent: "center",
    width: 16,
  },
  dateArrowText: {
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: "700",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  metaStrip: {
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  metaStripText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  metaDivider: {
    backgroundColor: colors.border,
    height: 12,
    width: 1,
  },
  chip: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    ...cardShadow,
  },
  chipStrong: {
    backgroundColor: colors.text,
  },
  chipText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  chipTextStrong: {
    color: "#ffffff",
  },
  sectionCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    borderColor: colors.border,
    borderWidth: 1,
    marginTop: 12,
    padding: 16,
  },
  sectionStack: {
    marginTop: 6,
  },
  featuresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10,
  },
  featureItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#e9fbf6",
    borderColor: "#ccf5eb",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  featureIcon: {
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderColor: "#b8efe3",
    borderRadius: 10,
    borderWidth: 1,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  featureText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  hostRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
  },
  hostAvatar: {
    alignItems: "center",
    backgroundColor: "#e9fbf6",
    borderColor: "#b8efe3",
    borderRadius: 999,
    borderWidth: 1,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  hostInitials: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  hostMeta: {
    flex: 1,
    gap: 4,
  },
  hostName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  hostSub: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  hostDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  hostDetailLabel: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  hostDetailValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  reviewList: {
    gap: 12,
    marginTop: 8,
  },
  reviewItem: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: 10,
  },
  reviewRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  reviewRating: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
  },
  reviewDate: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: "600",
  },
  reviewBody: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 6,
  },
  sectionBody: {
    color: colors.textMuted,
    marginTop: 6,
  },
  summaryRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  ctaCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    marginTop: 18,
    padding: 18,
    ...cardShadow,
  },
  ctaTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  input: {
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.appBg,
  },
  authButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 6,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 14,
    flex: 1,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: colors.appBg,
    borderRadius: 14,
    flex: 1,
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: colors.textMuted,
    fontWeight: "600",
  },
  error: {
    color: "#b42318",
    marginBottom: 8,
  },
  readMore: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 8,
  },
  photoThumb: {
    borderRadius: 12,
    height: 96,
    marginRight: 10,
    width: 140,
  },
  bottomBar: {
    alignItems: "center",
    backgroundColor: colors.cardBg,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
  },
  bottomPrice: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
  },
  bottomMeta: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  bottomButton: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: 40,
    paddingVertical: 14,
  },
  bottomButtonDisabled: {
    backgroundColor: "#e5e7eb",
  },
  bottomButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  bottomButtonDisabledText: {
    color: "#6b7280",
    fontSize: 16,
    fontWeight: "700",
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  pickerSheet: {
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    width: "100%",
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  pickerDone: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  pickerDoneText: {
    color: colors.accent,
    fontWeight: "700",
  },
  viewerBackdrop: {
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    flex: 1,
    justifyContent: "center",
  },
  viewerClose: {
    position: "absolute",
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 999,
  },
  viewerCloseText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
});
