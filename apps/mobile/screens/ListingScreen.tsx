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
import Animated, {
  Extrapolate,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import ImageViewer from "react-native-image-zoom-viewer";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import LottieView from "lottie-react-native";
import DatePicker from "react-native-date-picker";
import MapView, { Marker } from "react-native-maps";
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
import {
  formatDateLabel,
  formatTimeLabel,
  formatDateTimeLabel,
  formatReviewDate,
} from "../utils/dateFormat";
import { Info, Star, User, Image as ImageIcon } from "lucide-react-native";

type Props = NativeStackScreenProps<RootStackParamList, "Listing">;

const getFeatureIconType = (label: string) => {
  const normalized = label.toLowerCase();
  if (normalized.includes("cctv") || normalized.includes("camera")) return "camera";
  if (normalized.includes("ev") || normalized.includes("charge")) return "bolt";
  if (normalized.includes("light") || normalized.includes("lit") || normalized.includes("lighting")) return "bulb";
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
    case "bulb":
      return (
        <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
          <Path
            d="M9 2.5a4.5 4.5 0 0 1 2.8 8.0c-.5.4-.8.9-.9 1.5H7.1c-.1-.6-.4-1.1-.9-1.5A4.5 4.5 0 0 1 9 2.5z"
            stroke={stroke}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
          <Path d="M7.2 12.5h3.6" stroke={stroke} strokeWidth={1.5} />
          <Path d="M7.8 14.5h2.4" stroke={stroke} strokeWidth={1.5} />
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
  const { id, from, to, booking } = route.params;
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
  const [showAllHours, setShowAllHours] = useState(false);
  const [startAt, setStartAt] = useState(() => new Date(from));
  const [endAt, setEndAt] = useState(() => new Date(to));
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerField, setPickerField] = useState<"start" | "end">("start");
  const [draftDate, setDraftDate] = useState<Date | null>(null);
  const streetViewLocation =
    listing?.latitude && listing?.longitude
      ? `${listing.latitude},${listing.longitude}`
      : "53.3498,-6.2603";

  // Check if current times match the booking times
  const isBookingTimes = booking &&
    startAt.toISOString() === booking.startTime &&
    endAt.toISOString() === booking.endTime;
  const showBookingMode = booking && isBookingTimes;

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
    const hours = ms / (1000 * 60 * 60);
    const roundedHours = Math.max(1, Math.ceil(hours));
    const hourlyRate = listing.price_per_day / 24;
    const total = Math.round(hourlyRate * roundedHours);

    // Format duration label
    let durationLabel: string;
    if (hours < 24) {
      durationLabel = `${roundedHours} ${roundedHours === 1 ? 'hour' : 'hours'}`;
    } else {
      const days = Math.max(1, Math.ceil(hours / 24));
      durationLabel = `${days} ${days === 1 ? 'day' : 'days'}`;
    }

    return { total, totalCents: total * 100, durationLabel };
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
    const minEnd = new Date(startAt);
    minEnd.setHours(minEnd.getHours() + 1);
    const safeEnd = next < minEnd ? minEnd : next;
    setEndAt(safeEnd);
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
  const featureLabels = useMemo(
    () =>
      featureRows.map((value) => {
        if (!value) return value;
        return value.charAt(0).toUpperCase() + value.slice(1);
      }),
    [featureRows]
  );
  const aboutText =
    listing?.description ??
    listing?.availability_text ??
    "Secure off-street parking space in a quiet residential area. The space is well-lit and monitored, with easy access from the main road. Ideal for commuters or longer stays, with clear signage and hassle-free entry.";
  const isOpen24 =
    /24\s*\/\s*7|24\s*hours|open\s*24/i.test(aboutText) ||
    /24\s*\/\s*7|24\s*hours|open\s*24/i.test(
      listing?.availability_text ?? ""
    );
  const availabilityEntries = listing?.availabilitySchedule ?? [];
  const hasWeeklyAvailability = availabilityEntries.some(
    (entry) => Array.isArray(entry.repeatWeekdays) && entry.repeatWeekdays.length > 0
  );
  const formatHour = (value: string) =>
    new Date(value).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  const weekdayOrder = [
    { label: "Monday", dow: 1 },
    { label: "Tuesday", dow: 2 },
    { label: "Wednesday", dow: 3 },
    { label: "Thursday", dow: 4 },
    { label: "Friday", dow: 5 },
    { label: "Saturday", dow: 6 },
    { label: "Sunday", dow: 0 },
  ];
  const openingHours = weekdayOrder.map(({ label, dow }) => {
    if (hasWeeklyAvailability) {
      const entry = availabilityEntries.find((item) =>
        Array.isArray(item.repeatWeekdays) && item.repeatWeekdays.includes(dow)
      );
      if (entry) {
        return {
          day: label,
          hours: `${formatHour(entry.startsAt)} - ${formatHour(entry.endsAt)}`,
        };
      }
      return { day: label, hours: "Closed" };
    }
    return {
      day: label,
      hours: isOpen24 ? "Open 24 hours" : "Check availability",
    };
  });
  const aboutPreview =
    aboutText.length > 140 ? `${aboutText.slice(0, 140).trim()}...` : aboutText;

  // Add dummy data for new fields (remove this once backend is ready)
  const description = listing?.description ?? "Secure off-street parking space in a quiet residential area. The space is well-lit and monitored 24/7 with CCTV cameras. Perfect for daily commuters or long-term parking needs. Easy access from main road with clear signage.";
  const vehicleSizeSuitability = (listing?.vehicle_size_suitability || listing?.vehicleSizeSuitability) ?? "Suitable for: Compact cars, Sedans, Small SUVs (up to 4.8m length)";
  const accessDirections = (listing?.access_directions || listing?.accessDirections) ?? "1. Enter through the main gate on Oak Street\n2. Turn left at the first intersection\n3. The parking space is number 24, located on the right side\n4. Access code will be provided after booking\n5. Gate opens automatically with the code";

  const hostName = "Andrew";
  const hostInitials = hostName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const hasReviews = (listing?.rating_count ?? 0) > 0 && typeof listing?.rating === "number";
  const spaceTypeLabel = useMemo(() => {
    const rawType =
      (listing as { space_type?: string; spaceType?: string })?.space_type ??
      (listing as { space_type?: string; spaceType?: string })?.spaceType ??
      null;
    if (rawType) return rawType;
    const title = (listing?.title ?? "").trim();
    if (/ parking$/i.test(title)) {
      return title.replace(/ parking$/i, "");
    }
    const lower = title.toLowerCase();
    if (lower.includes("driveway")) return "Private Driveway";
    if (lower.includes("garage")) return "Garage";
    if (lower.includes("car park") || lower.includes("carpark")) return "Car park";
    if (lower.includes("private road")) return "Private road";
    if (lower.includes("street")) return "Street";
    return "Parking space";
  }, [listing]);
  const hostRating = hasReviews && listing?.rating ? listing.rating.toFixed(1) : null;
  const hostReviews = hasReviews ? listing?.rating_count ?? 0 : 0;
  const heroHeight = Math.round(width * 0.72);
  const distanceLabel = listing?.distance_m
    ? `${(listing.distance_m / 1000).toFixed(1)} km`
    : "0.8 km";
  const quickChips = useMemo(() => {
    const base = featureRows.slice(0, 3);
    if (!base.some((chip) => chip.toLowerCase().includes("24/7"))) {
      base.unshift("24/7");
    }
    return base.slice(0, 4);
  }, [featureRows]);
  const extendOffer = useMemo(() => {
    const dayPrice = listing?.price_per_day != null ? Number(listing.price_per_day) : null;
    if (dayPrice == null || Number.isNaN(dayPrice)) return null;
    const endOfDay = new Date(endAt);
    endOfDay.setHours(23, 59, 0, 0);
    if (endAt >= endOfDay) return null;
    const ms = Math.max(0, endOfDay.getTime() - endAt.getTime());
    const hours = Math.max(1, Math.round(ms / (1000 * 60 * 60)));
    const hourly = dayPrice / 24;
    const extra = hourly * hours;
    const discountRate = 0.25;
    const discountedExtra = extra * (1 - discountRate);
    const savings = extra - discountedExtra;
    if (savings < 1) return null;
    const roundedExtra = Math.round(discountedExtra);
    return {
      hours,
      extra: roundedExtra.toString(),
      endOfDay,
    };
  }, [listing?.price_per_day, endAt]);

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
      navigation.navigate("Welcome");
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
            {/* Content Card */}
            <View style={[styles.heroFixed, { height: heroHeight + insets.top, top: -insets.top + 22 }]}>
              {imageUrls.length ? (
                <Image
                  source={{ uri: imageUrls[0] }}
                  style={[styles.heroImage, { width, height: heroHeight }]}
                />
              ) : (
                <View style={[styles.heroPlaceholder, { height: heroHeight }]}>
                  <Text style={styles.heroPlaceholderText}>No image</Text>
                </View>
              )}

              {imageUrls.length > 1 ? (
                <View style={styles.dotsRow}>
                  {imageUrls.map((_, index) => (
                    <View
                      key={`dot-${index}`}
                      style={[styles.dot, index === 0 && styles.dotActive]}
                    />
                  ))}
                </View>
              ) : null}
            </View>

            {/* Header Overlay */}
            <View style={styles.headerOverlay}>
              <Pressable style={styles.backButtonRound} onPress={() => navigation.goBack()}>
                <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
              </Pressable>
              <Pressable style={styles.favoriteButtonRound} onPress={handleToggleFavorite}>
                <Text style={[styles.favoriteIcon, isFavorite(id) && styles.favoriteIconActive]}>
                  {isFavorite(id) ? "♥︎" : "♡"}
                </Text>
                {showFavAnim ? (
                  <LottieView
                    source={require("../assets/Heart fav.json")}
                    autoPlay
                    loop={false}
                    onAnimationFinish={() => setShowFavAnim(false)}
                    style={styles.favAnimOverlay}
                    pointerEvents="none"
                  />
                ) : null}
              </Pressable>
            </View>

            <Pressable
              style={[
                styles.heroTapOverlay,
                { height: Math.max(0, heroHeight - 54), top: -insets.top + 54 },
              ]}
              onPress={() => {
                setViewerIndex(0);
                setShowImageViewer(true);
              }}
            />

            <ScrollView
              style={styles.scrollContainer}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingTop: heroHeight - 40 }}
            >
              <View style={styles.contentWrap}>
                <View style={styles.contentCard}>
              {/* Title Section */}
              <View style={styles.titleSection}>
                <Text style={styles.category}>{spaceTypeLabel.toUpperCase()}</Text>
                <Text style={styles.cardTitle}>{listing.title}</Text>
                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={16} color="#6B7280" />
                  <Text style={styles.location}>{listing.address}</Text>
                </View>
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={16} color="#F59E0B" />
                  <Text style={styles.rating}>
                    {hasReviews ? listing.rating?.toFixed(1) : "0.0"}
                  </Text>
                  <Text style={styles.reviewCount}>
                    ({listing.rating_count ?? 0})
                  </Text>
                </View>
                {priceSummary ? (
                  <View style={styles.summaryStrip}>
                    <View style={styles.summaryCell}>
                      <Text style={styles.summaryLabel}>Total duration</Text>
                      <Text style={styles.summaryValue}>{priceSummary.durationLabel}</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryCell}>
                      <Text style={styles.summaryLabel}>Parking fee</Text>
                      <Text style={styles.summaryValue}>€{priceSummary.total}</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryCell}>
                      <Text style={styles.summaryLabel}>To destination</Text>
                      <Text style={styles.summaryValue}>{distanceLabel}</Text>
                    </View>
                  </View>
                ) : null}
              </View>

              {/* Date/Time Picker Row */}
              <View style={styles.timePickerSection}>
                <View style={styles.timePickerWrapper}>
                  <View style={styles.timePickerCard}>
                    <Pressable style={styles.timePickerColumn} onPress={() => openPicker("start")}>
                      <View style={styles.timePickerField}>
                        <View>
                          <Text style={styles.dateTimeLabel}>From</Text>
                          <Text style={styles.dateTimeValue}>{formatDateTimeLabel(startAt)}</Text>
                        </View>
                        <Ionicons name="chevron-down" size={16} color="#0f766e" />
                      </View>
                    </Pressable>
                    <View style={styles.timePickerArrow}>
                      <Ionicons name="arrow-forward" size={18} color="#22a06b" />
                    </View>
                    <Pressable style={styles.timePickerColumn} onPress={() => openPicker("end")}>
                      <View style={styles.timePickerField}>
                        <View>
                          <Text style={styles.dateTimeLabel}>Until</Text>
                          <Text style={styles.dateTimeValue}>{formatDateTimeLabel(endAt)}</Text>
                        </View>
                        <Ionicons name="chevron-down" size={16} color="#0f766e" />
                      </View>
                    </Pressable>
                  </View>
                  {extendOffer ? (
                    <Pressable
                      style={styles.offerBar}
                      onPress={() => {
                        setEndAt(new Date(extendOffer.endOfDay));
                      }}
                    >
                      <Text style={styles.offerText}>
                        Extend to 23:59 for only €{extendOffer.extra}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>

              {/* Description */}
              <View style={[styles.sectionBlock, { paddingHorizontal: 16 }]}>
                <Text style={styles.sectionTitle}>Description</Text>
                <Text style={styles.sectionBody}>
                  {showFullAbout ? aboutText : aboutPreview}
                </Text>
                {aboutText.length > 140 ? (
                  <Pressable onPress={() => setShowFullAbout((prev) => !prev)}>
                    <Text style={styles.readMore}>
                      {showFullAbout ? "Read less →" : "Read more →"}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.sectionDivider} />

              {/* Opening Hours */}
              <Pressable
                onPress={() => setShowAllHours((prev) => !prev)}
                style={[styles.sectionBlock, { paddingHorizontal: 16 }]}
              >
                <View style={styles.hoursHeaderRow}>
                  <Text style={[styles.sectionTitle, styles.hoursSectionTitle]}>
                    Space Availability
                  </Text>
                  <Text style={styles.hoursToggleText}>
                    {showAllHours ? "Hide" : "See all"}
                  </Text>
                </View>
                {(() => {
                  const todayLabel = new Date().toLocaleDateString(undefined, {
                    weekday: "long",
                  });
                  const rows = showAllHours
                    ? openingHours
                    : openingHours.filter((row) => row.day === todayLabel);
                  return rows.map((row) => {
                    const isToday = row.day === todayLabel;
                    const label = !showAllHours && isToday ? "Today" : row.day;
                    const highlightToday = showAllHours && isToday;
                    return (
                      <View
                        key={row.day}
                        style={[styles.hoursRow, highlightToday && styles.hoursRowToday]}
                      >
                        <Text style={[styles.hoursDay, highlightToday && styles.hoursDayToday]}>
                          {label}
                        </Text>
                        <Text style={[styles.hoursValue, highlightToday && styles.hoursValueToday]}>
                          {row.hours}
                        </Text>
                      </View>
                    );
                  });
                })()}
              </Pressable>
              <View style={styles.sectionDivider} />

              {/* Features */}
              <View style={styles.featuresSection}>
                <View style={styles.featuresGrid}>
                  {featureLabels.map((feature) => (
                    <View key={feature} style={styles.featureIconCard}>
                      <FeatureIcon type={getFeatureIconType(feature)} />
                      <Text style={styles.featureIconLabel}>{feature}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View style={styles.sectionDivider} />

              {/* Content Sections */}
              <View style={styles.contentSections}>
                <View style={styles.sectionBlock}>
                  <View style={styles.reviewHeaderRow}>
                    <Text style={styles.sectionTitle}>Reviews</Text>
                    <View style={styles.reviewSummary}>
                      <Ionicons name="star" size={14} color="#F59E0B" />
                      <Text style={styles.reviewSummaryText}>
                        {hasReviews ? listing.rating?.toFixed(2) : "0.00"}
                      </Text>
                      <Text style={styles.reviewSummaryCount}>
                        • {listing.rating_count ?? 0} Reviews
                      </Text>
                    </View>
                  </View>
                  {reviewsLoading ? (
                    <View style={styles.centered}>
                      <ActivityIndicator />
                    </View>
                  ) : reviews.length ? (
                    <View style={styles.reviewCarouselWrap}>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.reviewCarousel}
                      >
                        {reviews.slice(0, 6).map((review) => (
                          <View key={review.id} style={styles.reviewCardWide}>
                            <View style={styles.reviewCardTop}>
                              <View style={styles.reviewStarsRow}>
                                {[0, 1, 2, 3, 4].map((idx) => (
                                  <Ionicons
                                    key={`${review.id}-star-${idx}`}
                                    name="star"
                                    size={14}
                                    color={idx < Math.round(review.rating) ? "#F59E0B" : "#E5E7EB"}
                                  />
                                ))}
                                <Text style={styles.reviewAge}>
                                  {formatReviewDate(
                                    new Date((review as { created_at?: string }).created_at ?? review.createdAt)
                                  )}
                                </Text>
                              </View>
                              <Text style={styles.reviewAuthor}>
                                {(review as { author_name?: string }).author_name ?? review.authorName ?? "Guest"}
                              </Text>
                            </View>
                            <Text style={styles.reviewComment}>{review.comment}</Text>
                          </View>
                        ))}
                      </ScrollView>
                      <Pressable
                        style={styles.reviewCta}
                        onPress={() =>
                          navigation.navigate("ListingReviews", {
                            id,
                            rating: listing.rating ?? 0,
                            ratingCount: listing.rating_count ?? reviews.length,
                          })
                        }
                      >
                        <Text style={styles.reviewCtaText}>
                          Show all {listing.rating_count ?? reviews.length} reviews
                        </Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Text style={styles.reviewComment}>No reviews yet.</Text>
                  )}
                </View>

                {!user && (
                  <>
                    <View style={styles.dividerLine} />

                    <View style={styles.authCard}>
                      <Text style={styles.authTitle}>Sign in to book</Text>
                      <TextInput
                        style={styles.authInput}
                        placeholder="Email"
                        placeholderTextColor="#9CA3AF"
                        autoCapitalize="none"
                        autoCorrect={false}
                        value={email}
                        onChangeText={setEmail}
                      />
                      <TextInput
                        style={styles.authInput}
                        placeholder="Password"
                        placeholderTextColor="#9CA3AF"
                        secureTextEntry
                        value={password}
                        onChangeText={setPassword}
                      />
                      {authError ? <Text style={styles.error}>{authError}</Text> : null}
                      <View style={styles.authButtons}>
                        <Pressable
                          style={styles.authButtonSecondary}
                          onPress={handleLogin}
                          disabled={authLoading}
                        >
                          <Text style={styles.authButtonSecondaryText}>Log in</Text>
                        </Pressable>
                        <Pressable
                          style={styles.authButtonPrimary}
                          onPress={handleRegister}
                          disabled={authLoading}
                        >
                          <Text style={styles.authButtonPrimaryText}>Create account</Text>
                        </Pressable>
                      </View>
                    </View>
                  </>
                )}

                {/* Extra padding for bottom button */}
                <View style={{ height: 200 }} />
              </View>
                </View>
              </View>
            </ScrollView>

            {/* Fixed Bottom Button */}
            {priceSummary && user ? (
              <View style={[styles.bottomBar, { paddingBottom: 24 + insets.bottom }]}>
                <View style={styles.priceInfo}>
                  <Text style={styles.priceAmount}>€{priceSummary.total}</Text>
                  <Text style={styles.priceDuration}>{priceSummary.durationLabel}</Text>
                </View>
                {listing?.is_available === false || showBookingMode ? (
                  <Pressable style={[styles.bookButton, styles.bookButtonDisabled]} disabled>
                    <Text style={styles.bookButtonDisabledText}>Sold out</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={styles.bookButton}
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
                    <Text style={styles.bookButtonText}>
                      {navigatingToBooking ? "Opening..." : "Book Now"}
                    </Text>
                  </Pressable>
                )}
              </View>
            ) : null}
          </>
        ) : null}
      </SafeAreaView>

      {/* Date Picker Modal */}
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
                    const picked =
                      draftDate ?? (pickerField === "start" ? startAt : endAt);
                    applyPickedDate(picked);
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
                minuteInterval={30}
                textColor={colors.accent}
                onDateChange={(date) => {
                  setDraftDate(date);
                }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {/* Image Viewer Modal */}
      <Modal
        visible={showImageViewer}
        transparent
        animationType="fade"
        onRequestClose={() => setShowImageViewer(false)}
      >
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
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#F9FAFB",
    flex: 1,
  },
  scrollContainer: {
    backgroundColor: "transparent",
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
    fontWeight: "600",
  },
  topTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
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
    fontWeight: "600",
  },
  heroPillTextDark: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  sheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderWidth: 1,
    borderColor: "#bfe2d8",
    marginTop: -28,
    paddingHorizontal: spacing.screenX,
    paddingTop: 20,
  },
  titleCard: {
    gap: 8,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "600",
    letterSpacing: -0.5,
    lineHeight: 34,
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
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
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
    color: colors.text,
    fontSize: 13,
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
    fontWeight: "600",
  },
  metricIconBadge: {
    backgroundColor: "#22c55e",
    borderRadius: 3,
    height: 8,
    width: 8,
  },
  timeRow: {
    backgroundColor: colors.cardBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#374151",
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    shadowOpacity: 0,
    elevation: 0,
  },
  timeLabel: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  dateRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateTimePill: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#374151",
    borderRadius: 6,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  dateTimeText: {
    color: "#101828",
    fontSize: 11,
    fontWeight: "600",
    flex: 1,
  },
  dateArrow: {
    color: "#94a3b8",
    fontSize: 16,
    marginHorizontal: 8,
  },
  dateArrow: {
    paddingHorizontal: 8,
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
    borderColor: "#374151",
    borderRadius: 6,
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
    paddingVertical: 20,
  },
  section: {
    paddingVertical: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },
  sectionStack: {
    marginTop: 6,
  },
  featuresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  featureItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  featureIcon: {
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderRadius: 8,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  featureText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    marginTop: 2,
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: -0.2,
    marginBottom: 8,
  },
  readMore: {
    marginTop: 6,
    color: '#16a34a',
    fontSize: 13,
    fontWeight: '600',
  },
  hostRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    marginTop: 16,
  },
  hostAvatar: {
    alignItems: "center",
    backgroundColor: "#e9fbf6",
    borderColor: "#b8efe3",
    borderRadius: 999,
    borderWidth: 1.5,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  hostInitials: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "600",
  },
  hostMeta: {
    flex: 1,
    gap: 5,
  },
  hostName: {
    color: '#111827',
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  hostSub: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  hostDetails: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  hostDetailPill: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 999,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  hostDetailText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  reviewList: {
    gap: 16,
    marginTop: 14,
  },
  reviewItem: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 12,
  },
  reviewRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  reviewRating: {
    color: "#f59e0b",
    fontSize: 14,
    fontWeight: "600",
  },
  reviewDate: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: "600",
  },
  reviewBody: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  photoScroll: {
    marginTop: 12,
  },
  sectionBody: {
    color: '#6B7280',
    fontSize: 15,
    lineHeight: 22,
  },
  summaryRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "600",
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
    fontWeight: "600",
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
    fontWeight: "600",
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
    fontWeight: "600",
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
    fontWeight: "600",
  },
  bottomSoldOut: {
    color: colors.textMuted,
    fontSize: 18,
    fontWeight: "600",
  },
  bottomExisting: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "600",
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
    fontWeight: "600",
  },
  bottomButtonDisabledText: {
    color: "#6b7280",
    fontSize: 16,
    fontWeight: "600",
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
    fontWeight: "600",
    color: colors.text,
  },
  pickerDone: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  pickerDoneText: {
    color: colors.accent,
    fontWeight: "600",
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
    fontWeight: "600",
  },

  // New Tab-Based Design Styles
  header: {
    position: 'relative',
    overflow: 'visible',
  },
  heroFixed: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    overflow: "hidden",
    zIndex: 0,
  },
  heroTapOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  headerOverlay: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  backButtonRound: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoriteButtonRound: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  favoriteIcon: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
  },
  favoriteIconActive: {
    color: '#10B981',
  },
  favAnimOverlay: {
    position: 'absolute',
    width: 62,
    height: 62,
  },
  contentCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: 120, // Extra padding for fixed bottom bar
  },
  contentWrap: {
    marginTop: -25,
    zIndex: 2,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#d1d5db",
    marginBottom: 12,
  },
  titleSection: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  category: {
    fontSize: 13,
    fontWeight: '600',
    color: '#D97706',
    letterSpacing: 1,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  location: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '400',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  summaryStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 14,
    paddingVertical: 10,
  },
  summaryCell: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
    gap: 2,
  },
  summaryLabel: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: "600",
  },
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
  },
  summaryValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  rating: {
    fontSize: 14,
    fontWeight: '700',
    color: '#16a34a',
  },
  reviewCount: {
    fontSize: 12,
    color: '#6B7280',
  },
  chipRow: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    backgroundColor: "#E7F7F0",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#ccece2",
  },
  chipText: {
    color: "#157a6e",
    fontSize: 11,
    fontWeight: "600",
  },
  timePickerSection: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  timePickerWrapper: {
    overflow: "hidden",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#374151",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  timePickerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  timePickerField: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bfe2d8",
    backgroundColor: "#f7fffb",
  },
  timePickerColumn: {
    flex: 1,
  },
  timePickerArrow: {
    width: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  dateTimeLabel: {
    fontSize: 9,
    color: '#6B7280',
    marginBottom: 4,
  },
  dateTimeValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  offerBar: {
    backgroundColor: "#1f2937",
    paddingVertical: 10,
    alignItems: "center",
  },
  offerText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  tabContent: {
    flex: 1,
  },
  tabSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  contentSections: {
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  sectionBlock: {
    paddingTop: 12,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginTop: 8,
  },
  hoursRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  hoursHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  hoursToggleText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "600",
  },
  hoursSectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  hoursRowToday: {
    backgroundColor: "#F0FDF4",
    borderRadius: 0,
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  hoursDay: {
    fontSize: 12,
    color: "#111827",
    fontWeight: "600",
  },
  hoursDayToday: {
    color: "#166534",
  },
  hoursValue: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "600",
  },
  hoursValueToday: {
    color: "#166534",
  },
  dividerLine: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  sectionBody: {
    fontSize: 14,
    lineHeight: 21,
    color: '#6B7280',
    fontWeight: '400',
  },
  readMore: {
    fontSize: 15,
    fontWeight: '600',
    color: '#10B981',
    marginTop: 6,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: "space-between",
  },
  featuresSection: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingTop: 6,
  },
  featureIconCard: {
    width: "23%",
    minHeight: 64,
    borderRadius: 12,
    borderWidth: 0,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 4,
  },
  featureIconLabel: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "600",
    textAlign: "center",
  },
  hostCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    borderRadius: 10,
    gap: 12,
    marginTop: 10,
  },
  hostInfo: {
    flex: 1,
  },
  hostDetails: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  detailLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  unavailable: {
    color: '#EF4444',
  },
  reviewList: {
    gap: 16,
    marginTop: 10,
  },
  reviewHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  reviewSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  reviewSummaryText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
  },
  reviewSummaryCount: {
    fontSize: 12,
    color: "#6B7280",
  },
  reviewCarouselWrap: {
    marginTop: 12,
  },
  reviewCarousel: {
    paddingRight: 12,
    gap: 12,
  },
  reviewCardWide: {
    width: 250,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 14,
    borderRadius: 12,
  },
  reviewCardTop: {
    marginBottom: 8,
  },
  reviewStarsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  reviewAge: {
    marginLeft: 6,
    fontSize: 11,
    color: "#6B7280",
  },
  reviewAuthor: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
  },
  reviewCta: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#F0FDF4",
  },
  reviewCtaText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "600",
  },
  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    borderRadius: 10,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewRating: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  reviewDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  reviewComment: {
    fontSize: 13,
    lineHeight: 19,
    color: '#6B7280',
  },
  mapContainer: {
    height: 180,
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 10,
  },
  map: {
    flex: 1,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  locationAddress: {
    fontSize: 13,
    color: '#374151',
    flex: 1,
  },
  locationDistance: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  authCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
    gap: 12,
  },
  authTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  authInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: '#111827',
  },
  authButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  authButtonSecondary: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  authButtonSecondaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10B981',
  },
  authButtonPrimary: {
    flex: 1,
    backgroundColor: '#10B981',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  authButtonPrimaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  vehicleSizeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  vehicleSizeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
  },
  accessDirectionsCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  accessDirectionsText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#0F172A',
    flex: 1,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingTop: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 4,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  priceInfo: {
    flex: 1,
  },
  priceFrom: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  priceAmount: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
  },
  priceDuration: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '400',
  },
  bookButton: {
    backgroundColor: '#2a9d7f',
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 14,
  },
  bookButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bookButtonDisabled: {
    backgroundColor: '#E5E7EB',
    shadowOpacity: 0,
  },
  bookButtonDisabledText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#9CA3AF',
  },
});
