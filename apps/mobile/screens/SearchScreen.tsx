import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Slider } from "@miblanchard/react-native-slider";
import LottieView from "lottie-react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import type MapView from "react-native-maps";
import DatePicker from "../components/AdaptiveDatePicker";
import { DrumRollPicker, type DrumRollPickerHandle } from "../components/DrumRollPicker";
import { roundUpToMinuteInterval } from "../components/ModernTimePickerSheet";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../auth";
import { useFavorites } from "../favorites";
import { useGlobalToast } from "../components/GlobalToast";
import MapSection from "../components/MapSection";
import { MapBottomCard } from "../components/MapBottomCard";
import { RollingSwap } from "../components/RollingSwap";
import { PulseDots } from "../components/PulseDots";
import { LIGHT_MAP_STYLE } from "../components/mapStyles";
import { applyServiceFee, calculateListingTotal, formatPriceValue, getMonthlyGrossEuro } from "../utils/pricing";
import { publicAddress } from "../utils/address";
import { useGlobalLoading } from "../components/GlobalLoading";
import { getListing, searchListings } from "../api";
import { trackEvent } from "../analytics";
import { colors, primaryButtonShadow, radius, spacing, textStyles } from "../styles/theme";
import { motion } from "../styles/motion";
import {
  ArrowLeft,
  BatteryCharging,
  Cctv,
  ChevronDown,
  ChevronRight,
  CircleX,
  Clock,
  Heart,
  House,
  Info,
  LocateFixed,
  Lock,
  MapPin as MapPinIcon,
  RefreshCw,
  Route,
  Search,
  SlidersHorizontal,
  SquareParking,
  Warehouse,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react-native";
import { logError, logInfo } from "../logger";
import type {
  ListingSummary,
  RootStackParamList,
  SearchParams,
  SecurityLevel,
  VehicleSize,
} from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Search">;

function formatAddressDisplay(address: string): string {
  return address
    .replace(/,?\s*[A-Z]\d{2}\s[A-Z0-9]{4}\b/g, "")  // strip Eircode e.g. D02 VX67
    .replace(/,?\s*Ireland\s*$/i, "")                    // strip trailing ", Ireland"
    .replace(/,\s*$/, "")                                // strip trailing comma
    .trim();
}

function getListingDisplayTitle(listing: { title: string; address?: string | null; spaceType?: string | null; space_type?: string | null }): string {
  const rawType = listing.space_type ?? listing.spaceType ?? null;
  let spaceType = rawType ?? (() => {
    const title = listing.title.trim();
    if (/ parking$/i.test(title)) return title.replace(/ parking$/i, "");
    const lower = title.toLowerCase();
    if (lower.includes("driveway")) return "Private driveway";
    if (lower.includes("garage")) return "Garage";
    if (lower.includes("car park") || lower.includes("carpark")) return "Car park";
    if (lower.includes("private road")) return "Private road";
    if (lower.includes("street")) return "Street parking";
    return "Parking space";
  })();
  const street = listing.address
    ? listing.address.split(",")[0].replace(/^\d+[A-Za-z0-9\-\/]*\s+/, "").trim()
    : "";
  return street ? `${spaceType} on ${street}` : listing.title;
}

type PlaceSuggestion = {
  description: string;
  place_id: string;
};

type PlaceDetailsResponse = {
  result?: {
    formatted_address?: string;
    geometry?: { location?: { lat: number; lng: number } };
  };
};

type SearchHistoryItem = {
  label: string;
  lat: string;
  lng: string;
  timestamp: number;
};

type SearchPinCoordinate = {
  latitude: number;
  longitude: number;
};

const DEFAULT_PRICE_MIN = 0;
const DEFAULT_PRICE_MAX = 60;
const DEFAULT_PRICE_STEP = 5;
const PRICE_BUCKET_COUNT = 18;
const EMPTY_PRICE_HISTOGRAM = [4, 6, 8, 12, 18, 26, 34, 42, 48, 44, 38, 31, 28, 24, 20, 16, 13, 10];

const VEHICLE_SIZE_OPTIONS: Array<{ label: string; value: VehicleSize | "" }> = [
  { label: "Any", value: "" },
  { label: "Motorcycle", value: "motorcycle" },
  { label: "Car", value: "car" },
  { label: "Van", value: "van" },
];

const SPACE_TYPE_OPTIONS: Array<{ label: string; value: string; icon: LucideIcon }> = [
  { label: "Driveway", value: "Private Driveway", icon: House },
  { label: "Garage", value: "Garage", icon: Warehouse },
  { label: "Car park", value: "Car park", icon: SquareParking },
  { label: "Private road", value: "Private road", icon: Route },
];

type FilterChipProps = {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: LucideIcon;
  small?: boolean;
};

function FilterChip({ label, selected = false, onPress, icon, small = false }: FilterChipProps) {
  const Icon = icon;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChipButton,
        small && styles.filterChipButtonSmall,
        selected && styles.filterChipButtonActive,
        pressed && styles.filterChipButtonPressed,
      ]}
    >
      {Icon ? (
        <Icon
          size={14}
          color={selected ? colors.textInverse : colors.text}
          strokeWidth={2.1}
          style={{ marginRight: 6 }}
        />
      ) : null}
      <Text style={[styles.filterChipButtonText, selected && styles.filterChipButtonTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function FilterSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.filterSection}>
      <View style={styles.filterSectionHeader}>
        <Text style={styles.filterSectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.filterSectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

type PriceScale = {
  min: number;
  max: number;
  step: number;
  bars: number[];
  count: number;
  observedMin: number;
  observedMax: number;
};

function parsePriceRangeValue(value: string, fallback: number, scale: PriceScale) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? clamp(parsed, scale.min, scale.max) : fallback;
}

function priceValueToFilter(value: number, edge: "min" | "max", scale: PriceScale) {
  if (edge === "min" && value <= scale.min) return "";
  if (edge === "max" && value >= scale.max) return "";
  return formatPriceValueForFilter(value);
}

function formatPriceValueForFilter(value: number) {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.?0+$/, "");
}

function buildPriceScale(values: number[]): PriceScale {
  const cleanValues = values.filter((value) => Number.isFinite(value) && value > 0);

  if (cleanValues.length === 0) {
    return {
      min: DEFAULT_PRICE_MIN,
      max: DEFAULT_PRICE_MAX,
      step: DEFAULT_PRICE_STEP,
      bars: EMPTY_PRICE_HISTOGRAM,
      count: 0,
      observedMin: DEFAULT_PRICE_MIN,
      observedMax: DEFAULT_PRICE_MAX,
    };
  }

  const observedMin = Math.min(...cleanValues);
  const observedMax = Math.max(...cleanValues);
  const paddedMax = Math.max(observedMax + Math.max(2, observedMax * 0.25), 10);
  const step = getPriceStep(paddedMax);
  const max = Math.max(step, Math.ceil(paddedMax / step) * step);

  return {
    min: DEFAULT_PRICE_MIN,
    max,
    step,
    bars: buildPriceHistogram(cleanValues, DEFAULT_PRICE_MIN, max),
    count: cleanValues.length,
    observedMin,
    observedMax,
  };
}

function buildPriceHistogram(values: number[], min: number, max: number) {
  if (values.length === 0 || max <= min) return EMPTY_PRICE_HISTOGRAM;
  const counts = Array.from({ length: PRICE_BUCKET_COUNT }, () => 0);

  values.forEach((value) => {
    const ratio = (value - min) / (max - min);
    const bucket = Math.min(PRICE_BUCKET_COUNT - 1, Math.max(0, Math.floor(ratio * PRICE_BUCKET_COUNT)));
    counts[bucket] += 1;
  });

  const maxCount = Math.max(...counts, 1);
  return counts.map((count) => (count === 0 ? 8 : 16 + Math.round((count / maxCount) * 64)));
}

function getPriceStep(max: number) {
  if (max <= 20) return 1;
  if (max <= 80) return 5;
  if (max <= 250) return 10;
  if (max <= 600) return 25;
  return 50;
}

function getSearchPriceForParams(listing: ListingSummary, params: SearchParams) {
  const start = new Date(params.from);
  const end = new Date(params.to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return applyServiceFee(Number(listing.price_per_day));
  }
  return calculateListingTotal(listing, start, end).grossTotal;
}

function listingSearchText(listing: ListingSummary) {
  return [
    listing.title,
    listing.address,
    listing.availability_text,
    listing.vehicle_size_suitability,
    listing.vehicleSizeSuitability,
    ...(listing.amenities ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesSpaceType(listing: ListingSummary, spaceType?: string) {
  if (!spaceType) return true;
  const text = listingSearchText(listing);
  const value = spaceType.toLowerCase();
  if (value.includes("driveway")) return text.includes("driveway");
  if (value.includes("garage")) return text.includes("garage");
  if (value.includes("car park") || value.includes("carpark")) {
    return text.includes("car park") || text.includes("carpark") || text.includes("lot");
  }
  if (value.includes("road")) return text.includes("road") || text.includes("street");
  return text.includes(value);
}

function matchesSearchFilters(listing: ListingSummary, params: SearchParams) {
  const price = getSearchPriceForParams(listing, params);
  const min = params.priceMin ? Number(params.priceMin) : null;
  const max = params.priceMax ? Number(params.priceMax) : null;
  const text = listingSearchText(listing);
  const amenities = (listing.amenities ?? []).map((amenity) => amenity.toLowerCase());

  if (min !== null && Number.isFinite(min) && Number.isFinite(price) && price < min) return false;
  if (max !== null && Number.isFinite(max) && Number.isFinite(price) && price > max) return false;
  if (!matchesSpaceType(listing, params.spaceType)) return false;
  if (params.coveredParking && !amenities.some((amenity) => ["covered", "garage", "indoor"].includes(amenity)) && !text.includes("covered") && !text.includes("garage")) return false;
  if (params.evCharging && !amenities.some((amenity) => ["ev_charging", "ev charging", "ev"].includes(amenity)) && !text.includes("ev charging")) return false;
  if (params.securityLevel === "cctv" && !amenities.includes("cctv") && !text.includes("cctv")) return false;
  if (params.securityLevel === "gated" && !amenities.some((amenity) => ["gated", "security"].includes(amenity)) && !text.includes("gated") && !text.includes("secure")) return false;
  if (params.vehicleSize === "van") {
    const capacity = Number(listing.capacity ?? 1);
    if ((!Number.isFinite(capacity) || capacity < 2) && !text.includes("van")) return false;
  }
  if (params.vehicleSize === "motorcycle" && text.includes("van only")) return false;
  if (params.instantBook && listing.is_available === false) return false;

  return true;
}

function PriceRangeSlider({
  minValue,
  maxValue,
  priceValues,
  onMinChange,
  onMaxChange,
}: {
  minValue: string;
  maxValue: string;
  priceValues: number[];
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
}) {
  const scale = useMemo(
    () => buildPriceScale(priceValues),
    [priceValues]
  );

  const numericMin = parsePriceRangeValue(minValue, scale.min, scale);
  const numericMax = parsePriceRangeValue(maxValue, scale.max, scale);
  const safeMin = clamp(
    Math.min(numericMin, numericMax - scale.step),
    scale.min,
    scale.max - scale.step
  );
  const safeMax = clamp(
    Math.max(numericMax, safeMin + scale.step),
    safeMin + scale.step,
    scale.max
  );

  const minLabel = `€${formatPriceValueForFilter(safeMin)}`;
  const maxLabel = safeMax >= scale.max ? `€${formatPriceValueForFilter(scale.max)}+` : `€${formatPriceValueForFilter(safeMax)}`;
  const rangeHint =
    scale.count > 0
      ? `Current spaces range from €${formatPriceValueForFilter(scale.observedMin)} to €${formatPriceValueForFilter(scale.observedMax)}.`
      : "No current price data yet.";

  const handleRangeChange = useCallback(
    (values: number[]) => {
      const rawMin = values[0] ?? safeMin;
      const rawMax = values[1] ?? safeMax;
      const orderedMin = Math.min(rawMin, rawMax);
      const orderedMax = Math.max(rawMin, rawMax);
      const nextMin = clamp(orderedMin, scale.min, scale.max - scale.step);
      const nextMax = clamp(orderedMax, nextMin + scale.step, scale.max);

      onMinChange(priceValueToFilter(nextMin, "min", scale));
      onMaxChange(priceValueToFilter(nextMax, "max", scale));
    },
    [onMaxChange, onMinChange, safeMax, safeMin, scale]
  );

  return (
    <View style={styles.priceSlider}>
      <Text style={styles.priceRangeHint}>{rangeHint}</Text>
      <View style={styles.priceRangeGraph}>
        <View pointerEvents="none" style={styles.priceHistogram}>
          {scale.bars.map((height, index) => {
            const barValue =
              scale.min +
              (index / Math.max(1, scale.bars.length - 1)) *
                (scale.max - scale.min);
            const selected = barValue >= safeMin && barValue <= safeMax;
            return (
              <View
                key={`price-bar-${index}`}
                style={[
                  styles.priceHistogramBar,
                  { height },
                  selected && styles.priceHistogramBarSelected,
                ]}
              />
            );
          })}
        </View>
        <Slider
          animateTransitions={false}
          containerStyle={styles.priceRangeSlider}
          maximumTrackTintColor="#dfe3e8"
          maximumValue={scale.max}
          minimumTrackTintColor={colors.text}
          minimumValue={scale.min}
          minimumTrackStyle={styles.priceRangeSliderSelectedTrack}
          onSlidingComplete={handleRangeChange}
          onValueChange={handleRangeChange}
          renderThumbComponent={() => (
            <View style={styles.priceRangeThumb}>
              <View style={styles.priceRangeThumbDot} />
            </View>
          )}
        step={scale.step}
        thumbTouchSize={{ width: 54, height: 54 }}
        trackClickable
        trackStyle={styles.priceRangeSliderTrack}
        value={[safeMin, safeMax]}
      />
      </View>
      <View style={styles.priceRangeValueRow}>
        <View>
          <Text style={styles.priceValueLabel}>Minimum</Text>
          <Text style={styles.priceRangeValue}>{minLabel}</Text>
        </View>
        <View style={styles.priceRangeDivider} />
        <View style={styles.priceRangeValueRight}>
          <Text style={styles.priceValueLabel}>Maximum</Text>
          <Text style={styles.priceRangeValue}>{maxLabel}</Text>
        </View>
      </View>
    </View>
  );
}

const pad2 = (value: number) => value.toString().padStart(2, "0");
const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const MAX_SEARCH_RADIUS_KM = 50;
const MIN_SEARCH_RADIUS_KM = 0.5;
// Radius for searches centred on a picked destination (address, history item,
// current location). Must not derive from the live map region: the map is still
// animating to the destination when the search fires, so the region reflects
// the previous viewport. Generous enough to absorb off-centre geocoding.
const DESTINATION_SEARCH_RADIUS_KM = "3.00";

const ordinalSuffix = (value: number) => {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return "th";
  switch (value % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
};

const formatDateLabel = (date: Date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateToCheck = new Date(date);
  dateToCheck.setHours(0, 0, 0, 0);

  if (dateToCheck.getTime() === today.getTime()) {
    return "Today";
  }

  return `${date.getDate()} ${monthNames[date.getMonth()]}`;
};

const formatTimeLabel = (date: Date) => `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

const formatDateTimeLabel = (date: Date) => `${formatDateLabel(date)} · ${formatTimeLabel(date)}`;
const formatMapCardMetaLine = (fromIso: string, toIso: string, distanceM?: number | null) => {
  const fromDate = new Date(fromIso);
  const toDate = new Date(toIso);
  const dayLabel = formatDateLabel(fromDate);
  const distanceLabel =
    typeof distanceM === "number" && Number.isFinite(distanceM)
      ? `${(distanceM < 1000 ? Math.round(distanceM) : distanceM / 1000).toFixed(distanceM < 1000 ? 0 : 1)} ${distanceM < 1000 ? "m" : "km"}`
      : null;
  return `${dayLabel}: ${formatTimeLabel(fromDate)} - ${formatTimeLabel(toDate)}${distanceLabel ? ` | ${distanceLabel}` : ""}`;
};

export function SearchScreen({ navigation }: Props) {
  const today = useMemo(() => {
    const now = new Date();
    now.setMinutes(Math.ceil(now.getMinutes() / 5) * 5, 0, 0);
    const end = new Date(now);
    end.setHours(end.getHours() + 2);
    return {
      from: now.toISOString(),
      to: end.toISOString(),
    };
  }, []);

  const [lat, setLat] = useState("53.3498");
  const [lng, setLng] = useState("-6.2603");
  const [radiusKm, setRadiusKm] = useState("5");
  const [from, setFrom] = useState(today.from);
  const [to, setTo] = useState(today.to);
  const [loading, setLoading] = useState(false);
  const [isStaggerPending, setIsStaggerPending] = useState(false);
  const [searchGeneration, setSearchGeneration] = useState(0);
  const pillOpacity = useRef(new Animated.Value(0)).current;
  // Search card breathes: full two-row card while composing a search, a
  // single-row pill once attention moves to the map. 1 = expanded.
  const [cardCollapsed, setCardCollapsed] = useState(false);
  const cardAnim = useRef(new Animated.Value(1)).current;
  const [timeStripHeight, setTimeStripHeight] = useState(0);
  const { show: showGlobalLoading, hide: hideGlobalLoading } = useGlobalLoading();
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ListingSummary[]>([]);
  const [pendingResults, setPendingResults] = useState<ListingSummary[] | null>(null);
  const [isRefreshingPins, setIsRefreshingPins] = useState(false);
  const resultsRef = useRef<ListingSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSelectedCard, setShowSelectedCard] = useState(false);
  const [dismissingCard, setDismissingCard] = useState(false);
  const [addressQuery, setAddressQuery] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<PlaceSuggestion[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [selectedCardAmenities, setSelectedCardAmenities] = useState<string[] | null>(null);
  const [startAt, setStartAt] = useState(new Date(today.from));
  const [endAt, setEndAt] = useState(new Date(today.to));
  // Monthly term end shown alongside the start date (start + 1 calendar month),
  // matching the listing page. Display-only — a single month is always the term.
  const monthlyEndDate = useMemo(() => {
    const d = new Date(startAt);
    d.setMonth(d.getMonth() + 1);
    return d;
  }, [startAt]);
  const [pickerField, setPickerField] = useState<"start" | "end">("start");
  const [pickerVisible, setPickerVisible] = useState(false);
  const [draftDate, setDraftDate] = useState<Date | null>(null);
  const pickerSheetAnim = useRef(new Animated.Value(400)).current;
  const mapOverlayOpacity = useRef(new Animated.Value(1)).current;
  const [mapOverlayVisible, setMapOverlayVisible] = useState(true);

  useEffect(() => {
    if (pickerVisible) {
      pickerSheetAnim.setValue(400);
      Animated.spring(pickerSheetAnim, {
        toValue: 0,
        useNativeDriver: true,
        ...motion.spring,
      }).start();
    }
  }, [pickerVisible, pickerSheetAnim]);
  useEffect(() => {
    const busy = loading || isStaggerPending;
    // Show the "Finding spaces" pill only while a search is in flight; once it
    // resolves the pill just fades out (no results-count payoff beat).
    Animated.timing(pillOpacity, {
      toValue: busy ? 1 : 0,
      duration: busy ? motion.duration.standard : motion.duration.fast,
      useNativeDriver: true,
    }).start();
  }, [loading, isStaggerPending, pillOpacity]);

  const setCardCollapsedAnimated = useCallback(
    (_next: boolean) => {
      // The search card stays fully expanded at all times (user preference: no
      // collapsing search bar). Collapse requests are intentionally ignored so
      // the destination + time strip are always visible.
    },
    []
  );

  const [emptyNotice, setEmptyNotice] = useState<string | null>(null);
  const emptyNoticeOpacity = useRef(new Animated.Value(0)).current;
  const emptyNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideEmptyNotice = useCallback(() => {
    if (emptyNoticeTimerRef.current) {
      clearTimeout(emptyNoticeTimerRef.current);
      emptyNoticeTimerRef.current = null;
    }
    Animated.timing(emptyNoticeOpacity, {
      toValue: 0,
      duration: motion.duration.fast,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setEmptyNotice(null);
    });
  }, [emptyNoticeOpacity]);

  const showEmptyNotice = useCallback(
    (message: string) => {
      if (emptyNoticeTimerRef.current) clearTimeout(emptyNoticeTimerRef.current);
      setEmptyNotice(message);
      Animated.timing(emptyNoticeOpacity, {
        toValue: 1,
        duration: motion.duration.standard,
        useNativeDriver: true,
      }).start();
      emptyNoticeTimerRef.current = setTimeout(() => {
        emptyNoticeTimerRef.current = null;
        hideEmptyNotice();
      }, 4000);
    },
    [emptyNoticeOpacity, hideEmptyNotice]
  );

  useEffect(() => {
    return () => {
      if (emptyNoticeTimerRef.current) clearTimeout(emptyNoticeTimerRef.current);
    };
  }, []);

  const timeSearchPendingRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  // Bumped on screen focus to force a marker remount so pins repaint after
  // react-native-screens blanks the map's native views on a stack push (listing).
  const [mapResumeNonce, setMapResumeNonce] = useState(0);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [securityLevel, setSecurityLevel] = useState<SecurityLevel | "">("");
  const [vehicleSize, setVehicleSize] = useState<VehicleSize | "">("");
  const [spaceType, setSpaceType] = useState<string>("");
  const [overlappingPins, setOverlappingPins] = useState<ListingSummary[]>([]);
  const [coveredParking, setCoveredParking] = useState(false);
  const [evCharging, setEvCharging] = useState(false);
  const [instantBook, setInstantBook] = useState(false);
  // Hourly (short-term booking) vs Monthly (one month, paid up front) search. Monthly maps
  // to the API's `mode=monthly`, which filters to listings that carry a monthly
  // price. The map is the only monthly surface for now — see monthly roadmap.
  const [searchMode, setSearchMode] = useState<"hourly" | "monthly">("hourly");
  const [modePickerVisible, setModePickerVisible] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [searchSheetVisible, setSearchSheetVisible] = useState(false);
  const [searchSheetOpen, setSearchSheetOpen] = useState(false);
  // Composing a new search — bring the full card back so the booking window
  // is editable the moment the sheet closes.
  useEffect(() => {
    if (searchSheetOpen) setCardCollapsedAnimated(false);
  }, [searchSheetOpen, setCardCollapsedAnimated]);
  const [activeSearchTab, setActiveSearchTab] = useState<"recents" | "favourites">("recents");
  const [pendingSearch, setPendingSearch] = useState<{
    lat: string;
    lng: string;
    radiusKm: string;
  } | null>(null);
  const [showSearchArea, setShowSearchArea] = useState(false);
  const [renderSearchArea, setRenderSearchArea] = useState(false);
  const isProgrammaticMoveRef = useRef(false);
  useAuth();
  const { favorites, isFavorite, toggle } = useFavorites();
  const toast = useGlobalToast();
  const handleToggleFavorite = useCallback(
    (listing: ListingSummary) => {
      const wasFavorite = isFavorite(listing.id);
      void (async () => {
        try {
          await toggle(listing);
          if (wasFavorite) toast.show("Removed from favourites");
          else toast.showSuccess("Saved to favourites");
        } catch {
          // toggle surfaces its own errors; don't show a success toast on failure
        }
      })();
    },
    [isFavorite, toggle, toast]
  );
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const searchAnim = useRef(new Animated.Value(0)).current;
  const searchAreaOpacity = useRef(new Animated.Value(0)).current;
  const searchAreaTranslateY = useRef(new Animated.Value(8)).current;
  const showAreaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchOverlayOpacity = useMemo(
    () =>
      searchAnim.interpolate({
        inputRange: [0, 40],
        outputRange: [1, 0],
      }),
    [searchAnim]
  );
  const backdropOpacity = useMemo(
    () =>
      slideAnim.interpolate({
        inputRange: [0, windowHeight],
        outputRange: [1, 0],
      }),
    [slideAnim, windowHeight]
  );
  const searchRequestIdRef = useRef(0);
  const searchStartedAtRef = useRef(0);
  const mapReadyEventsRef = useRef({ ready: false, loaded: false });
  const mapReadyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapReadyFailSafeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialSearchTriggeredRef = useRef(false);
  const currentRegionRef = useRef<typeof mapRegion | null>(null);
  const mapRegionSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialRegionHandledRef = useRef(false);
  const cardHeightRef = useRef(0);
  const suppressRegionSearchRef = useRef(false);
  const suppressRegionSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requireUserPanForRegionSearchRef = useRef(false);

  const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

  useEffect(() => {
    navigation.setParams({ hideTabBar: searchSheetOpen || filtersVisible });
  }, [navigation, searchSheetOpen, filtersVisible]);

  const parsedLat = Number.parseFloat(lat);
  const parsedLng = Number.parseFloat(lng);
  const mapRegion = {
    latitude: Number.isFinite(parsedLat) ? parsedLat : 53.3498,
    longitude: Number.isFinite(parsedLng) ? parsedLng : -6.2603,
    latitudeDelta: 0.025, // Wider area view
    longitudeDelta: 0.025,
  };
  const [mapInitialRegion, setMapInitialRegion] = useState<typeof mapRegion | null>(null);
  const [searchPinCoordinate, setSearchPinCoordinate] = useState<SearchPinCoordinate | null>({
    latitude: Number.isFinite(parsedLat) ? parsedLat : 53.3498,
    longitude: Number.isFinite(parsedLng) ? parsedLng : -6.2603,
  });
  const ignoreNextRegionChangeRef = useRef(false);
  const lastSearchCenterRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastSearchRadiusRef = useRef<number | null>(null);
  const mapRef = useRef<MapView | null>(null);
  const skipAutocompleteRef = useRef(0);
  // Monotonic id so a slow earlier autocomplete response can't overwrite the
  // suggestions for a newer query.
  const autocompleteSeqRef = useRef(0);
  const historyLoadedRef = useRef(false);
  const filtersLoadedRef = useRef(false);
  const [filtersReady, setFiltersReady] = useState(false);
  const HISTORY_KEY = "searchHistory";
  const MAP_REGION_KEY = "search.mapRegion";
  const MAP_RESULTS_KEY = "search.lastResults";
  const FILTERS_KEY = "search.filters";

  const searchAreaVisible = showSearchArea && !!pendingSearch;

  useEffect(() => {
    if (searchAreaVisible) {
      setRenderSearchArea(true);
      // Start below its resting position so it slides up into view
      searchAreaTranslateY.setValue(24);
      searchAreaOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(searchAreaOpacity, {
          toValue: 1,
          duration: motion.duration.standard,
          easing: motion.easing.out,
          useNativeDriver: true,
        }),
        Animated.spring(searchAreaTranslateY, {
          toValue: 0,
          ...motion.spring,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.timing(searchAreaOpacity, {
        toValue: 0,
        duration: motion.duration.fast,
        easing: motion.easing.in,
        useNativeDriver: true,
      }),
      Animated.timing(searchAreaTranslateY, {
        toValue: 20,
        duration: motion.duration.fast,
        easing: motion.easing.in,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setRenderSearchArea(false);
      }
    });
  }, [searchAreaVisible, searchAreaOpacity, searchAreaTranslateY]);

  // Instant-open: hydrate the last session's results so the map is never a
  // bare basemap. Pins reprice client-side for the current times, and a
  // silent refresh replaces them as soon as the live search lands.
  useEffect(() => {
    let active = true;
    const loadCachedResults = async () => {
      try {
        const cached = await AsyncStorage.getItem(MAP_RESULTS_KEY);
        if (!active || !cached) return;
        const parsed = JSON.parse(cached) as { savedAt?: number; listings?: ListingSummary[] };
        const fresh =
          Array.isArray(parsed?.listings) &&
          parsed.listings.length > 0 &&
          typeof parsed.savedAt === "number" &&
          Date.now() - parsed.savedAt < 7 * 24 * 60 * 60 * 1000;
        // Only hydrate if a live search hasn't already beaten us to it.
        if (fresh && resultsRef.current.length === 0) {
          resultsRef.current = parsed.listings!;
          setResults(parsed.listings!);
        }
      } catch {
        // Corrupt cache — first-launch experience is the fallback.
      }
    };
    void loadCachedResults();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem(MAP_REGION_KEY);
        if (!active) return;
        if (stored) {
          const parsed = JSON.parse(stored) as typeof mapRegion;
          if (
            typeof parsed?.latitude === "number" &&
            typeof parsed?.longitude === "number" &&
            typeof parsed?.latitudeDelta === "number" &&
            typeof parsed?.longitudeDelta === "number"
          ) {
            setMapInitialRegion(parsed);
            setLat(parsed.latitude.toFixed(6));
            setLng(parsed.longitude.toFixed(6));
            setSearchPinCoordinate({
              latitude: parsed.latitude,
              longitude: parsed.longitude,
            });
            return;
          }
        }

        const permissions = await Location.getForegroundPermissionsAsync();
        if (!active || permissions.status !== "granted") return;

        let position: Location.LocationObject | null = null;
        try {
          position = await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
          ]);
        } catch {
          position = null;
        }

        if (!position) {
          position = await Location.getLastKnownPositionAsync({
            maxAge: 10 * 60 * 1000,
            requiredAccuracy: 500,
          });
        }

        if (!active || !position) return;

        const nextRegion = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        };
        setMapInitialRegion(nextRegion);
        setLat(nextRegion.latitude.toFixed(6));
        setLng(nextRegion.longitude.toFixed(6));
        setSearchPinCoordinate({
          latitude: nextRegion.latitude,
          longitude: nextRegion.longitude,
        });
        setAddressQuery("Current location");
        currentRegionRef.current = nextRegion;
        await AsyncStorage.setItem(MAP_REGION_KEY, JSON.stringify(nextRegion));
        if (active) {
          lastSearchCenterRef.current = {
            lat: nextRegion.latitude,
            lng: nextRegion.longitude,
          };
        }
      } catch {
        // Ignore persisted region errors.
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    resultsRef.current = results;
  }, [results]);

  const isWithinRadius = useCallback(
    (listing: ListingSummary, center: { lat: number; lng: number }, radiusM: number) => {
      if (typeof listing.latitude !== "number" || typeof listing.longitude !== "number") {
        return false;
      }
      const toRad = (value: number) => (value * Math.PI) / 180;
      const R = 6371000;
      const dLat = toRad(listing.latitude - center.lat);
      const dLng = toRad(listing.longitude - center.lng);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(center.lat)) *
          Math.cos(toRad(listing.latitude)) *
          Math.sin(dLng / 2) ** 2;
      const distanceM = 2 * R * Math.asin(Math.sqrt(a));
      return distanceM <= radiusM;
    },
    []
  );

  const radiusKmForRegion = useCallback((region: typeof mapRegion) => {
    const diagDelta = Math.sqrt(
      region.latitudeDelta ** 2 + region.longitudeDelta ** 2
    );
    const rawRadiusKm =
      Math.max(MIN_SEARCH_RADIUS_KM, (diagDelta * 111) / 2) * 1.2;
    return Math.min(MAX_SEARCH_RADIUS_KM, rawRadiusKm);
  }, []);

  const buildSearchParams = useCallback(
    (overrides?: Partial<SearchParams>): SearchParams => {
      const region = currentRegionRef.current;
      const nextLat = region ? region.latitude.toFixed(6) : lat;
      const nextLng = region ? region.longitude.toFixed(6) : lng;
      const nextRadiusKm = region
        ? radiusKmForRegion(region).toFixed(2)
        : radiusKm;
      const next: SearchParams = {
        lat: nextLat,
        lng: nextLng,
        radiusKm: nextRadiusKm,
        from,
        to,
        includeUnavailable: true,
        mode: searchMode === "monthly" ? "monthly" : "daily",
      };
      if (priceMin.trim()) next.priceMin = priceMin.trim();
      if (priceMax.trim()) next.priceMax = priceMax.trim();
      if (securityLevel) next.securityLevel = securityLevel;
      if (vehicleSize) next.vehicleSize = vehicleSize;
      if (spaceType) next.spaceType = spaceType;
      if (coveredParking) next.coveredParking = true;
      if (evCharging) next.evCharging = true;
      if (instantBook) next.instantBook = true;
      return { ...next, ...overrides };
    },
    [
      lat,
      lng,
      radiusKm,
      from,
      to,
      radiusKmForRegion,
      searchMode,
      priceMin,
      priceMax,
      securityLevel,
      vehicleSize,
      spaceType,
      coveredParking,
      evCharging,
      instantBook,
    ]
  );

  useEffect(() => {
    if (!mapsKey) return;
    if (skipAutocompleteRef.current > 0) {
      skipAutocompleteRef.current -= 1;
      return;
    }
    if (addressQuery.trim().length < 3) {
      setAddressSuggestions([]);
      return;
    }
    const handle = setTimeout(() => {
      void fetchAutocomplete(addressQuery);
    }, 300);
    return () => clearTimeout(handle);
  }, [addressQuery, mapsKey]);


  const runSearch = useCallback(
    async (
      paramsOverride?: Partial<SearchParams>,
      options?: { showGlobal?: boolean; preserveSelection?: boolean; silent?: boolean }
    ) => {
      if (showAreaTimerRef.current) {
        clearTimeout(showAreaTimerRef.current);
        showAreaTimerRef.current = null;
      }
      setShowSearchArea(false);
      setPendingSearch(null);
      hideEmptyNotice();
      let nextResultsSnapshot: ListingSummary[] | null = null;
      const requestId = searchRequestIdRef.current + 1;
      searchRequestIdRef.current = requestId;
      searchStartedAtRef.current = Date.now();
      const preserveSelection = options?.preserveSelection ?? false;
      // Silent refreshes swap results in place under pins the user is already
      // looking at — no stagger re-reveal, no artificial minimum wait.
      const silent = options?.silent ?? false;
      setLoading(true);
      if (!silent) {
        setIsStaggerPending(true);
        setSearchGeneration(prev => prev + 1);
        setIsRefreshingPins(true);
      }
      setError(null);
      const params = buildSearchParams(paramsOverride);
      logInfo("Search started", params);
      const nextCenter = {
        lat: Number.parseFloat(params.lat),
        lng: Number.parseFloat(params.lng),
      };
      if (Number.isFinite(nextCenter.lat) && Number.isFinite(nextCenter.lng)) {
        lastSearchCenterRef.current = nextCenter;
      }
      const currentRegion = currentRegionRef.current;
      if (currentRegion) {
        lastSearchRadiusRef.current = radiusKmForRegion(currentRegion);
      }
      try {
        const spaces = await searchListings(params);
        void trackEvent("mobile_search_completed", {
          resultCount: spaces.length,
          radiusKm: params.radiusKm,
        });
        if (searchRequestIdRef.current !== requestId) return;
        const center = {
          lat: Number.parseFloat(params.lat),
          lng: Number.parseFloat(params.lng),
        };
        const radiusM = Math.max(0.5, Number(params.radiusKm)) * 1000;
        const nextIds = new Set(spaces.map((listing) => listing.id));
        const carryOver = resultsRef.current.filter(
          (listing) => !nextIds.has(listing.id) && isWithinRadius(listing, center, radiusM)
        );
        nextResultsSnapshot = [...spaces, ...carryOver].filter((listing) =>
          matchesSearchFilters(listing, params)
        );
        // If preserving selection, keep the selected listing in results so the card stays visible
        if (preserveSelection) {
          setSelectedId((prev) => {
            if (prev && !nextResultsSnapshot!.some((l) => l.id === prev)) {
              const kept = resultsRef.current.find((l) => l.id === prev);
              if (kept && matchesSearchFilters(kept, params)) nextResultsSnapshot!.push(kept);
            }
            return prev;
          });
        } else {
          setSelectedId((prev) => {
            if (prev && spaces.some((l) => l.id === prev && l.is_available !== false))
              return prev;
            return null;
          });
        }
        setPendingResults(nextResultsSnapshot);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Search failed";
        logError("Search error", { message });
        void trackEvent("mobile_search_failed", {
          radiusKm: params.radiusKm,
          message,
        });
        // Only surface the failure if this is still the latest search; a stale
        // request erroring shouldn't toast over a newer one's results.
        if (searchRequestIdRef.current === requestId) {
          setError(message);
          setPendingResults([]);
        }
      } finally {
        const elapsed = Date.now() - searchStartedAtRef.current;
        const remaining = silent ? 0 : Math.max(0, 1000 - elapsed);
        setTimeout(() => {
          if (searchRequestIdRef.current !== requestId) return;
          setLoading(false);
          if (nextResultsSnapshot) {
            setResults(nextResultsSnapshot);
            setPendingResults(null);
            // Instant-open cache: next session opens on these results instead
            // of a loading screen.
            void AsyncStorage.setItem(
              MAP_RESULTS_KEY,
              JSON.stringify({ savedAt: Date.now(), listings: nextResultsSnapshot.slice(0, 50) })
            ).catch(() => undefined);
            if (nextResultsSnapshot.length === 0) {
              showEmptyNotice("No spaces in this area — try zooming out");
            } else if (nextResultsSnapshot.every((l) => l.is_available === false)) {
              showEmptyNotice("All spaces are booked for these times");
            }
          }
          setIsRefreshingPins(false);
        }, remaining);
      }
    },
    [buildSearchParams, pendingResults, hideEmptyNotice, showEmptyNotice]
  );

  const scheduleMapReady = useCallback(() => {
    if (!mapReadyEventsRef.current.ready || !mapReadyEventsRef.current.loaded) return;
    if (mapReadyTimerRef.current) {
      clearTimeout(mapReadyTimerRef.current);
    }
    mapReadyTimerRef.current = setTimeout(() => {
      setMapReady(true);
    }, 620);
  }, []);

  const handleMapReady = (type: "ready" | "loaded") => {
    mapReadyEventsRef.current[type] = true;
    scheduleMapReady();
    initialRegionHandledRef.current = true;
    if (!currentRegionRef.current) {
      currentRegionRef.current = mapInitialRegion ?? mapRegion;
    }
    if (!loading && type === "ready" && !initialSearchTriggeredRef.current) {
      initialSearchTriggeredRef.current = true;
      isProgrammaticMoveRef.current = true;
      // Cached results are already visible — refresh under them silently
      // instead of re-staggering pins the user is looking at.
      void runSearch(
        undefined,
        results.length ? { silent: true, preserveSelection: true } : undefined
      );
    }
  };
  // Stable callbacks for MapSection so memo() actually holds. A latest-ref keeps
  // the identity fixed while still running the newest logic (handleMapReady
  // closes over results/loading, which change often).
  const handleMapReadyRef = useRef(handleMapReady);
  handleMapReadyRef.current = handleMapReady;
  const onMapLoaded = useCallback(() => handleMapReadyRef.current("loaded"), []);
  const onMapReadyEvent = useCallback(() => handleMapReadyRef.current("ready"), []);
  const onAllPinsRevealed = useCallback(() => setIsStaggerPending(false), []);
  const mapPaddingValue = useMemo(
    () => ({ top: insets.top + 120, bottom: 180 + insets.bottom + 16, left: 16, right: 16 }),
    [insets.top, insets.bottom]
  );

  useEffect(() => {
    setFrom(startAt.toISOString());
    setTo(endAt.toISOString());
  }, [startAt, endAt]);

  useEffect(() => {
    if (!currentRegionRef.current && mapInitialRegion) {
      currentRegionRef.current = mapInitialRegion;
    }
  }, [mapInitialRegion]);

  useEffect(() => {
    if (!timeSearchPendingRef.current) return;
    timeSearchPendingRef.current = false;
    void runSearch({ lat, lng, radiusKm });
  }, [endAt, lat, lng, radiusKm, runSearch]);

  // Re-run the search whenever the Hourly/Monthly mode flips so pins swap to the
  // right listing set + pricing. Skip the very first render (initial search is
  // driven by the map-ready path).
  const modeSearchReadyRef = useRef(false);
  useEffect(() => {
    if (!modeSearchReadyRef.current) {
      modeSearchReadyRef.current = true;
      return;
    }
    setSelectedId(null);
    setShowSelectedCard(false);
    void runSearch(undefined, { showGlobal: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchMode]);

  useEffect(() => {
    if (typeof navigation.addListener !== "function") {
      return;
    }
    // We dropped the old on-blur JPEG snapshot overlay (150–620ms of UI-thread
    // work per exit, measured) — the synchronous vector pin fallback covers the
    // repaint gap well enough without it.
    //
    // We must still bump the resume nonce on focus, though: a listing is a
    // native-stack push over the whole tab navigator, so react-native-screens
    // detaches the Tabs screen (and its Google map) on push and blanks the frozen
    // marker native views. On pop-back the markers are frozen bitmaps
    // (tracksViewChanges=false) and don't repaint on their own — they come back
    // gone or as the default red pin. Bumping the nonce folds into each marker's
    // key so they remount and repaint from scratch. (This also fires on plain tab
    // switches, where the map stayed attached and a remount is redundant; the cost
    // is a cheap remount on tab-return, which we accept to keep pins reliable.)
    const unsubscribeFocus = navigation.addListener("focus", () => {
      setMapResumeNonce((prev) => prev + 1);
      suppressRegionSearchRef.current = true;
      requireUserPanForRegionSearchRef.current = true;
      if (suppressRegionSearchTimerRef.current) clearTimeout(suppressRegionSearchTimerRef.current);
      suppressRegionSearchTimerRef.current = setTimeout(() => {
        suppressRegionSearchRef.current = false;
        suppressRegionSearchTimerRef.current = null;
      }, 1200);
    });
    return () => {
      unsubscribeFocus();
      if (suppressRegionSearchTimerRef.current) clearTimeout(suppressRegionSearchTimerRef.current);
    };
  }, [navigation]);

  const applyPickedDate = (picked: Date) => {
    // Never allow a past time — snap to the next 5-minute slot from now.
    const floor = roundUpToMinuteInterval(new Date(), 5);
    const next = picked.getTime() < floor.getTime() ? floor : picked;
    if (pickerField === "start") {
      if (next > endAt) {
        const bumped = new Date(next);
        bumped.setHours(bumped.getHours() + 2);
        setEndAt(bumped);
      }
      setStartAt(next);
    } else {
      const minEnd = new Date(startAt);
      minEnd.setHours(minEnd.getHours() + 1);
      const safeEnd = next < minEnd ? minEnd : next;
      setEndAt(safeEnd);
    }
  };

  useEffect(() => {
    const show = !mapReady || (loading && results.length === 0);
    if (show) {
      mapOverlayOpacity.setValue(1);
      setMapOverlayVisible(true);
    } else {
      Animated.timing(mapOverlayOpacity, {
        toValue: 0,
        duration: motion.duration.standard,
        easing: motion.easing.out,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMapOverlayVisible(false);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, loading, results.length]);

  const openPicker = (field: "start" | "end") => {
    setPickerField(field);
    const current = field === "start" ? startAt : endAt;
    setDraftDate(current);
    setPickerVisible(true);
  };

  const closePicker = useCallback(() => {
    Animated.timing(pickerSheetAnim, {
      toValue: 400,
      duration: motion.duration.standard,
      easing: motion.easing.in,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setPickerVisible(false);
        setDraftDate(null);
      }
    });
  }, [pickerSheetAnim]);

  const drumPickerRef = useRef<DrumRollPickerHandle>(null);

  const applyQuickDuration = (hours: number) => {
    const nextEnd = new Date(startAt);
    nextEnd.setHours(nextEnd.getHours() + hours);
    setDraftDate(nextEnd);
    drumPickerRef.current?.setTime(nextEnd);
  };


  const fetchAutocomplete = async (query: string) => {
    if (!mapsKey) return;
    const seq = ++autocompleteSeqRef.current;
    setAddressLoading(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const params = new URLSearchParams({
        input: query,
        key: mapsKey,
        components: "country:ie",
      });
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`,
        { signal: controller.signal }
      );
      const payload = (await response.json()) as { predictions?: PlaceSuggestion[] };
      // Drop the result if a newer query has been issued since this one started.
      if (seq !== autocompleteSeqRef.current) return;
      setAddressSuggestions(payload.predictions ?? []);
    } catch {
      if (seq === autocompleteSeqRef.current) setAddressSuggestions([]);
    } finally {
      clearTimeout(timeout);
      if (seq === autocompleteSeqRef.current) setAddressLoading(false);
    }
  };

  const handleSelectSuggestion = async (suggestion: PlaceSuggestion) => {
    setAddressQuery(formatAddressDisplay(suggestion.description));
    setAddressSuggestions([]);
    skipAutocompleteRef.current = 2;
    if (!mapsKey) return;
    try {
      const params = new URLSearchParams({
        place_id: suggestion.place_id,
        key: mapsKey,
        fields: "geometry,formatted_address",
      });
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`
      );
      const payload = (await response.json()) as PlaceDetailsResponse;
      if (payload.result?.formatted_address) {
        setAddressQuery(formatAddressDisplay(payload.result.formatted_address));
      }
      const location = payload.result?.geometry?.location;
      if (location) {
        const nextLat = location.lat.toFixed(6);
        const nextLng = location.lng.toFixed(6);
        const label = formatAddressDisplay(payload.result?.formatted_address ?? suggestion.description);
        addToHistory({
          label,
          lat: nextLat,
          lng: nextLng,
          timestamp: Date.now(),
        });
        setLat(nextLat);
        setLng(nextLng);
        setRadiusKm(DESTINATION_SEARCH_RADIUS_KM);
        setSearchPinCoordinate({
          latitude: location.lat,
          longitude: location.lng,
        });
        lastSearchCenterRef.current = { lat: location.lat, lng: location.lng };
        setSelectedId(null);
        isProgrammaticMoveRef.current = true;
        const destinationRegion = {
          latitude: location.lat,
          longitude: location.lng,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        };
        // Set optimistically — the animation hasn't completed when the search
        // below builds its params from this ref.
        currentRegionRef.current = destinationRegion;
        mapRef.current?.animateToRegion(destinationRegion, 280);
        void runSearch({ lat: nextLat, lng: nextLng, radiusKm: DESTINATION_SEARCH_RADIUS_KM });
      }
    } catch {
      // Ignore lookup errors.
    }
  };

  const handleUseCurrentLocation = async () => {
    setLocationError(null);
    setLocating(true);
    const loadingTimer = setTimeout(() => {
      showGlobalLoading("Locating...");
    }, 120);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setLocationError("Location permission needed.");
        if (!permission.canAskAgain) {
          // The OS won't show the prompt again (user previously denied), so a
          // bare error leaves this button permanently dead. Route to Settings.
          Alert.alert(
            "Location is off",
            "Enable location access for FreeSpace in Settings to find parking near you.",
            [
              { text: "Not now", style: "cancel" },
              { text: "Open Settings", onPress: () => void Linking.openSettings() },
            ]
          );
        }
        return;
      }
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setLocationError("Location services are off.");
        Alert.alert(
          "Location services are off",
          "Turn on Location Services in Settings so we can find parking near you.",
          [
            { text: "Not now", style: "cancel" },
            { text: "Open Settings", onPress: () => void Linking.openSettings() },
          ]
        );
        return;
      }
      const withTimeout = async <T,>(promise: Promise<T>, ms: number) =>
        Promise.race([
          promise,
          new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error("Location timeout")), ms)
          ),
        ]);
      let position: Location.LocationObject | null = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        8000
      );
      if (!position) {
        position = await Location.getLastKnownPositionAsync({
          maxAge: 5 * 60 * 1000,
          requiredAccuracy: 200,
        });
      }
      if (!position) {
        setLocationError("Unable to fetch location.");
        return;
      }
      const nextLat = position.coords.latitude.toFixed(6);
      const nextLng = position.coords.longitude.toFixed(6);
      setLat(nextLat);
      setLng(nextLng);
      setRadiusKm(DESTINATION_SEARCH_RADIUS_KM);
      setSearchPinCoordinate({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      setAddressQuery("Current location");
      setAddressSuggestions([]);
      skipAutocompleteRef.current = 2;
      lastSearchCenterRef.current = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      setSelectedId(null);
      isProgrammaticMoveRef.current = true;
      const destinationRegion = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      };
      currentRegionRef.current = destinationRegion;
      mapRef.current?.animateToRegion(destinationRegion, 280);
      setSearchSheetOpen(false);
      clearTimeout(loadingTimer);
      hideGlobalLoading();
      void runSearch(
        { lat: nextLat, lng: nextLng, radiusKm: DESTINATION_SEARCH_RADIUS_KM },
        { showGlobal: true }
      );
    } catch {
      setLocationError("Unable to fetch location.");
    } finally {
      clearTimeout(loadingTimer);
      hideGlobalLoading();
      setLocating(false);
    }
  };

  const handleSelectHistoryItem = (item: SearchHistoryItem) => {
    const nextLat = item.lat;
    const nextLng = item.lng;
    setAddressQuery(item.label);
    setAddressSuggestions([]);
    skipAutocompleteRef.current = 2;
    setLat(nextLat);
    setLng(nextLng);
    setRadiusKm(DESTINATION_SEARCH_RADIUS_KM);
    setSearchPinCoordinate({
      latitude: Number.parseFloat(nextLat),
      longitude: Number.parseFloat(nextLng),
    });
    lastSearchCenterRef.current = {
      lat: Number.parseFloat(nextLat),
      lng: Number.parseFloat(nextLng),
    };
    setSelectedId(null);
    isProgrammaticMoveRef.current = true;
    const destinationRegion = {
      latitude: Number.parseFloat(nextLat),
      longitude: Number.parseFloat(nextLng),
      latitudeDelta: 0.012,
      longitudeDelta: 0.012,
    };
    currentRegionRef.current = destinationRegion;
    mapRef.current?.animateToRegion(destinationRegion, 280);
    setSearchSheetOpen(false);
    void runSearch({ lat: nextLat, lng: nextLng, radiusKm: DESTINATION_SEARCH_RADIUS_KM });
  };

  const selectedListing = selectedId
    ? results.find((listing) => listing.id === selectedId) ?? null
    : null;
  const visibleSelectedListing = showSelectedCard ? selectedListing : null;

  const selectedListingImage =
    visibleSelectedListing?.image_urls?.[0] ??
    visibleSelectedListing?.imageUrls?.[0] ??
    (visibleSelectedListing?.latitude &&
    visibleSelectedListing?.longitude &&
    mapsKey
      ? `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${visibleSelectedListing.latitude},${visibleSelectedListing.longitude}&source=outdoor&key=${mapsKey}`
      : null);

  useEffect(() => {
    let cancelled = false;
    if (!visibleSelectedListing) {
      setSelectedCardAmenities(null);
      return;
    }
    const summaryAmenities = visibleSelectedListing.amenities ?? [];
    if (summaryAmenities.length > 0) {
      setSelectedCardAmenities(summaryAmenities);
      return;
    }
    void (async () => {
      try {
        const detail = await getListing(visibleSelectedListing.id, { from, to });
        if (!cancelled) {
          setSelectedCardAmenities(detail.amenities ?? []);
        }
      } catch {
        if (!cancelled) {
          setSelectedCardAmenities([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visibleSelectedListing?.id, visibleSelectedListing?.amenities, from, to]);

  const handleSelectListing = useCallback((id: string | null) => {
    ignoreNextRegionChangeRef.current = true;
    if (id !== null) setCardCollapsedAnimated(true);
    if (cardDismissTimerRef.current) {
      clearTimeout(cardDismissTimerRef.current);
      cardDismissTimerRef.current = null;
    }
    if (id === null && selectedId !== null) {
      setDismissingCard(true);
      cardDismissTimerRef.current = setTimeout(() => {
        setShowSelectedCard(false);
        setSelectedId(null);
        setDismissingCard(false);
        cardDismissTimerRef.current = null;
      }, 250);
      return;
    }

    setSelectedId(id);
    setShowSelectedCard(Boolean(id));
    setDismissingCard(false);
    if (!id || !mapRef.current) return;

    const listing = results.find((r) => r.id === id);
    if (!listing?.latitude || !listing?.longitude) return;

    const region = currentRegionRef.current;
    const latDelta = region?.latitudeDelta ?? 0.012;
    const lngDelta = region?.longitudeDelta ?? 0.012;
    const centerLat = region?.latitude ?? listing.latitude;
    const centerLng = region?.longitude ?? listing.longitude;

    // mapPadding shifts the visual centre and shrinks the visible height — account for both.
    const mapPaddingTop = insets.top + 120;
    const mapPaddingBottom = 180 + insets.bottom + 16;
    const visibleHeight = windowHeight - mapPaddingTop - mapPaddingBottom;
    const mapVisualCenterY = mapPaddingTop + visibleHeight / 2;

    const latPerPixel = latDelta / visibleHeight;
    const lngPerPixel = lngDelta / windowWidth;
    const pinY = mapVisualCenterY + (centerLat - listing.latitude) / latPerPixel;
    const pinX = windowWidth / 2 + (listing.longitude - centerLng) / lngPerPixel;

    const offScreen = pinX < 0 || pinX > windowWidth || pinY < 0 || pinY > windowHeight;

    const bottomOffset = 82 + insets.bottom;
    const cardHeight = cardHeightRef.current || 220;
    const cardTop = windowHeight - bottomOffset - cardHeight;

    if (offScreen || pinY > cardTop) {
      const targetY = cardTop - 4;
      const newCenterLat = listing.latitude + (targetY - mapVisualCenterY) * latPerPixel;
      ignoreNextRegionChangeRef.current = true;
      isProgrammaticMoveRef.current = true;
      mapRef.current.animateToRegion(
        { latitude: newCenterLat, longitude: listing.longitude, latitudeDelta: latDelta, longitudeDelta: lngDelta },
        480
      );
    }
    // Pin is already visible above the card zone — no pan needed
  }, [selectedId, results, windowHeight, windowWidth, insets.bottom, setCardCollapsedAnimated]);

  useFocusEffect(
    useCallback(() => {
      // Keep the selected pin/card on return from a listing — clearing it here
      // remounts the marker mid-transition and the pin visibly flickers.
      setSearchSheetOpen(false);
      // Don't reset mapReady when switching tabs - keep map mounted
      // setMapReady(false);
      // mapReadyEventsRef.current = { ready: false, loaded: false };
      if (mapReadyTimerRef.current) {
        clearTimeout(mapReadyTimerRef.current);
        mapReadyTimerRef.current = null;
      }
      void (async () => {
        const deletedListingId = await AsyncStorage.getItem("deletedListingId");
        if (deletedListingId) {
          setResults((prev) => prev.filter((listing) => listing.id !== deletedListingId));
          await AsyncStorage.removeItem("deletedListingId");
        }
        const refreshToken = await AsyncStorage.getItem("searchRefreshToken");
        if (!refreshToken) return;
        await AsyncStorage.removeItem("searchRefreshToken");
        setSelectedId(null);
        setShowSelectedCard(false);
        void runSearch(undefined, { showGlobal: false, preserveSelection: false });
      })();
      return () => {
        if (showAreaTimerRef.current) {
          clearTimeout(showAreaTimerRef.current);
          showAreaTimerRef.current = null;
        }
      };
    }, [runSearch])
  );

  useEffect(() => {
    if (!mapReady) {
      if (mapReadyFailSafeRef.current) clearTimeout(mapReadyFailSafeRef.current);
      mapReadyFailSafeRef.current = setTimeout(() => {
        setMapReady(true);
      }, 1200);
    } else {
      if (mapReadyFailSafeRef.current) {
        clearTimeout(mapReadyFailSafeRef.current);
        mapReadyFailSafeRef.current = null;
      }
    }
    return () => {
      if (mapReadyFailSafeRef.current) {
        clearTimeout(mapReadyFailSafeRef.current);
        mapReadyFailSafeRef.current = null;
      }
    };
  }, [mapReady]);

  useEffect(() => {
    if (!mapReady || loading || results.length > 0) return;
    if (initialSearchTriggeredRef.current) return;
    initialSearchTriggeredRef.current = true;
    void runSearch();
  }, [mapReady, loading, results.length, runSearch]);

  useEffect(() => {
    if (showFilters) {
      setFiltersVisible(true);
      slideAnim.setValue(windowHeight);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: motion.duration.standard,
        easing: motion.easing.out,
        useNativeDriver: true,
      }).start();
    } else if (filtersVisible) {
      Animated.timing(slideAnim, {
        toValue: windowHeight,
        duration: motion.duration.standard,
        easing: motion.easing.in,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setFiltersVisible(false);
      });
    }
  }, [showFilters, filtersVisible, slideAnim, windowHeight]);

  useEffect(() => {
    if (searchSheetOpen) {
      setSearchSheetVisible(true);
      setAddressQuery("");
      setAddressSuggestions([]);
      setLocationError(null);
      searchAnim.setValue(40);
      Animated.parallel([
        Animated.timing(searchAnim, {
          toValue: 0,
          duration: motion.duration.standard,
          easing: motion.easing.out,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (searchSheetVisible) {
      Animated.timing(searchAnim, {
        toValue: 40,
        duration: motion.duration.fast,
        easing: motion.easing.in,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setSearchSheetVisible(false);
      });
    }
  }, [searchSheetOpen, searchSheetVisible, searchAnim]);

  useEffect(() => {
    if (historyLoadedRef.current) return;
    historyLoadedRef.current = true;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(HISTORY_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as SearchHistoryItem[];
        if (Array.isArray(parsed)) setSearchHistory(parsed);
      } catch {
        // Ignore history load errors.
      }
    })();
  }, []);

  useEffect(() => {
    if (filtersLoadedRef.current) return;
    filtersLoadedRef.current = true;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(FILTERS_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as Partial<{
            priceMin: string; priceMax: string;
            securityLevel: SecurityLevel | ""; vehicleSize: VehicleSize | "";
            spaceType: string; coveredParking: boolean; evCharging: boolean; instantBook: boolean;
          }>;
          if (saved.priceMin) setPriceMin(saved.priceMin);
          if (saved.priceMax) setPriceMax(saved.priceMax);
          if (saved.securityLevel) setSecurityLevel(saved.securityLevel);
          if (saved.vehicleSize) setVehicleSize(saved.vehicleSize);
          if (saved.spaceType) setSpaceType(saved.spaceType);
          if (typeof saved.coveredParking === "boolean") setCoveredParking(saved.coveredParking);
          if (typeof saved.evCharging === "boolean") setEvCharging(saved.evCharging);
          if (typeof saved.instantBook === "boolean") setInstantBook(saved.instantBook);
        }
      } catch {
        // Ignore filter load errors.
      } finally {
        setFiltersReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!filtersReady) return;
    void AsyncStorage.setItem(
      FILTERS_KEY,
      JSON.stringify({ priceMin, priceMax, securityLevel, vehicleSize, spaceType, coveredParking, evCharging, instantBook })
    );
  }, [filtersReady, priceMin, priceMax, securityLevel, vehicleSize, spaceType, coveredParking, evCharging, instantBook]);

  const addToHistory = (item: SearchHistoryItem) => {
    setSearchHistory((prev) => {
      const next = [
        item,
        ...prev.filter(
          (entry) =>
            !(entry.label === item.label && entry.lat === item.lat && entry.lng === item.lng)
        ),
      ].slice(0, 6);
      void AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  };

  const removeFromHistory = (item: SearchHistoryItem) => {
    setSearchHistory((prev) => {
      const next = prev.filter(
        (entry) =>
          !(entry.label === item.label && entry.lat === item.lat && entry.lng === item.lng)
      );
      void AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  };

  const closeFilters = () => setShowFilters(false);

  const handleRegionChanging = useCallback(() => {
    if (showAreaTimerRef.current) {
      clearTimeout(showAreaTimerRef.current);
      showAreaTimerRef.current = null;
    }
    if (selectedId && showSelectedCard && !isProgrammaticMoveRef.current) {
      if (cardDismissTimerRef.current) return;
      setDismissingCard(true);
      cardDismissTimerRef.current = setTimeout(() => {
        setShowSelectedCard(false);
        setDismissingCard(false);
        cardDismissTimerRef.current = null;
      }, 250);
    }
  }, [selectedId, showSelectedCard]);

  const handleMapPanDrag = useCallback(() => {
    requireUserPanForRegionSearchRef.current = false;
    hideEmptyNotice();
    // Attention has moved to the map — the chrome recedes.
    setCardCollapsedAnimated(true);
  }, [hideEmptyNotice, setCardCollapsedAnimated]);

  const handleRegionChange = useCallback((nextRegion: typeof mapRegion) => {
    currentRegionRef.current = nextRegion;
    if (ignoreNextRegionChangeRef.current) {
      ignoreNextRegionChangeRef.current = false;
      return;
    }
    if (!initialRegionHandledRef.current) {
      initialRegionHandledRef.current = true;
      return;
    }
    if (mapRegionSaveTimerRef.current) {
      clearTimeout(mapRegionSaveTimerRef.current);
    }
    mapRegionSaveTimerRef.current = setTimeout(() => {
      void AsyncStorage.setItem(MAP_REGION_KEY, JSON.stringify(nextRegion));
    }, 350);

    if (isProgrammaticMoveRef.current) {
      isProgrammaticMoveRef.current = false;
      if (showAreaTimerRef.current) {
        clearTimeout(showAreaTimerRef.current);
        showAreaTimerRef.current = null;
      }
      return;
    }

    const last = lastSearchCenterRef.current ?? {
      lat: mapRegion.latitude,
      lng: mapRegion.longitude,
    };
    const toRad = (value: number) => (value * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(nextRegion.latitude - last.lat);
    const dLng = toRad(nextRegion.longitude - last.lng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(last.lat)) *
        Math.cos(toRad(nextRegion.latitude)) *
        Math.sin(dLng / 2) ** 2;
    const distanceM = 2 * R * Math.asin(Math.sqrt(a));

    const visibleRadiusKm = radiusKmForRegion(nextRegion);
    const visibleRadiusM = visibleRadiusKm * 1000;
    const lastRadius = lastSearchRadiusRef.current;
    const radiusChangedSignificantly =
      lastRadius != null && Math.abs(visibleRadiusKm - lastRadius) / lastRadius > 0.3;

    if (distanceM < visibleRadiusM * 0.3 && !radiusChangedSignificantly) {
      if (showAreaTimerRef.current) {
        clearTimeout(showAreaTimerRef.current);
        showAreaTimerRef.current = null;
      }
      if (showSearchArea || pendingSearch) {
        setShowSearchArea(false);
        setPendingSearch(null);
      }
      return;
    }

    // Suppress region-change searches briefly after returning to the screen.
    if (suppressRegionSearchRef.current) return;
    if (requireUserPanForRegionSearchRef.current) return;

    // Show "Search this area" button — search only fires when the user taps it.
    if (showAreaTimerRef.current) {
      clearTimeout(showAreaTimerRef.current);
    }
    const nextLat = nextRegion.latitude.toFixed(6);
    const nextLng = nextRegion.longitude.toFixed(6);
    const nextRadius = radiusKmForRegion(nextRegion).toFixed(2);
    showAreaTimerRef.current = setTimeout(() => {
      showAreaTimerRef.current = null;
      setPendingSearch({ lat: nextLat, lng: nextLng, radiusKm: nextRadius });
      setShowSearchArea(true);
    }, 350);
  }, [mapRegion, showSearchArea, pendingSearch]);

  const priceForListing = useCallback(
    (listing: ListingSummary) => {
      if (searchMode === "monthly") {
        // Monthly is now bookable (one-off single month), so the buyer-facing
        // price must be fee-inclusive like the hourly path — the number on the
        // map is the number at checkout. Host still earns the raw monthly rate.
        const monthly = Number(listing.price_per_month);
        return Number.isFinite(monthly) && monthly > 0 ? getMonthlyGrossEuro(monthly) : 0;
      }
      return calculateListingTotal(listing, startAt, endAt).grossTotal;
    },
    [endAt, startAt, searchMode]
  );
  const filterPriceValues = useMemo(
    () =>
      results
        .map((listing) => priceForListing(listing))
        .filter((value) => Number.isFinite(value) && value > 0),
    [priceForListing, results]
  );
  const priceKey = useMemo(
    () =>
      searchMode === "monthly"
        ? "monthly"
        : `${startAt.getTime()}-${endAt.getTime()}`,
    [startAt, endAt, searchMode]
  );

  const clearFilters = () => {
    setPriceMin("");
    setPriceMax("");
    setSecurityLevel("");
    setVehicleSize("");
    setSpaceType("");
    setCoveredParking(false);
    setEvCharging(false);
    setInstantBook(false);
    void AsyncStorage.removeItem(FILTERS_KEY);
  };

  const clearFiltersAndSearch = () => {
    clearFilters();
    void runSearch({
      priceMin: undefined,
      priceMax: undefined,
      securityLevel: undefined,
      vehicleSize: undefined,
      spaceType: undefined,
      coveredParking: undefined,
      evCharging: undefined,
      instantBook: undefined,
    });
  };

  // Labels for the chip row — same set the badge counts, worded for display.
  const activeFilterChips = useMemo(() => {
    const chips: string[] = [];
    if (spaceType) chips.push(spaceType);
    if (coveredParking) chips.push("Covered");
    if (evCharging) chips.push("EV charging");
    if (instantBook) chips.push("Instant book");
    if (securityLevel === "cctv") chips.push("CCTV");
    if (securityLevel === "gated") chips.push("Gated");
    if (vehicleSize) chips.push(vehicleSize);
    if (priceMin.trim() || priceMax.trim()) {
      const min = priceMin.trim();
      const max = priceMax.trim();
      chips.push(min && max ? `€${min}–€${max}` : min ? `From €${min}` : `Up to €${max}`);
    }
    return chips;
  }, [
    spaceType,
    coveredParking,
    evCharging,
    instantBook,
    securityLevel,
    vehicleSize,
    priceMin,
    priceMax,
  ]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (priceMin.trim()) count += 1;
    if (priceMax.trim()) count += 1;
    if (securityLevel) count += 1;
    if (vehicleSize) count += 1;
    if (spaceType) count += 1;
    if (coveredParking) count += 1;
    if (evCharging) count += 1;
    if (instantBook) count += 1;
    return count;
  }, [
    priceMin,
    priceMax,
    securityLevel,
    vehicleSize,
    spaceType,
    coveredParking,
    evCharging,
    instantBook,
  ]);

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <View style={styles.mapShell}>
        <MapSection
            initialRegion={mapInitialRegion ?? mapRegion}
            results={results}
            style={styles.map}
            searchPinCoordinate={searchPinCoordinate}
            mapPadding={mapPaddingValue}
            provider="google"
            customMapStyle={LIGHT_MAP_STYLE}
            onSelect={handleSelectListing}
            onRegionChange={handleRegionChanging}
            onRegionChangeComplete={handleRegionChange}
            onPanDrag={handleMapPanDrag}
            selectedId={selectedId}
            mapRef={mapRef}
            freezeMarkers={loading || isRefreshingPins}
            onMapLoaded={onMapLoaded}
            onMapReady={onMapReadyEvent}
            onOverlappingPins={setOverlappingPins}
            priceForListing={priceForListing}
            priceKey={priceKey}
            priceSuffix={searchMode === "monthly" ? "/mo" : ""}
            resumeNonce={mapResumeNonce}
            searchGeneration={searchGeneration}
            onAllPinsRevealed={onAllPinsRevealed}
          />
        {mapOverlayVisible ? (
          <Animated.View style={[styles.mapLoadingOverlay, { opacity: mapOverlayOpacity }]}>
            <LottieView
              source={require("../assets/Insider-loading.json")}
              autoPlay
              loop
              style={styles.mapLoadingLottie}
            />
            <Text style={styles.mapLoadingText}>
              {mapReady ? "Finding spaces…" : "Loading map…"}
            </Text>
          </Animated.View>
        ) : null}
        <View style={[styles.overlay, { top: insets.top + 12 }]}>

          {/* ── Search pill + filter button, then a chip row of what's set ──
              Two surfaces rather than one card: the destination is the primary
              action and reads as its own field, while everything that narrows
              the search sits beneath it as chips that can grow with more
              filters. ── */}
          <View>
            <View style={styles.searchBarRow}>
              <Pressable
                style={({ pressed }) => [styles.searchPill, pressed && styles.searchCardRowPressed]}
                onPress={() => {
                  // Collapsed pill: first tap restores the chip row; editing
                  // comes on the next tap.
                  if (cardCollapsed) {
                    setCardCollapsedAnimated(false);
                    return;
                  }
                  setSearchSheetOpen(true);
                }}
                testID="search-bar"
              >
                <Search size={19} color={colors.primary} strokeWidth={2.4} />
                <Text style={[styles.searchPillText, !addressQuery && styles.searchCardPlaceholder]} numberOfLines={1}>
                  {addressQuery || "Where to?"}
                </Text>
                {cardCollapsed ? (
                  <Animated.View
                    pointerEvents="none"
                    style={{
                      opacity: cardAnim.interpolate({
                        inputRange: [0, 0.35],
                        outputRange: [1, 0],
                        extrapolate: "clamp",
                      }),
                    }}
                  >
                    <Text style={styles.searchCardTimesCompact}>
                      {formatTimeLabel(startAt)}–{formatTimeLabel(endAt)}
                    </Text>
                  </Animated.View>
                ) : addressQuery ? (
                  <Pressable onPress={() => { setAddressQuery(""); setAddressSuggestions([]); }} hitSlop={10}>
                    <CircleX size={16} color={colors.textDisabled} strokeWidth={2.1} />
                  </Pressable>
                ) : null}
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.filterCircle, pressed && styles.searchCardRowPressed]}
                onPress={() => setShowFilters((prev) => !prev)}
                accessibilityLabel="Filters"
              >
                <SlidersHorizontal size={19} color={colors.text} strokeWidth={2.1} />
                {activeFilterCount > 0 ? (
                  <View style={styles.filterBtnBadge}>
                    <Text style={styles.filterBtnBadgeText}>{activeFilterCount}</Text>
                  </View>
                ) : null}
              </Pressable>
            </View>

            <Animated.View
              style={[
                styles.timeStripCollapse,
                timeStripHeight > 0
                  ? {
                      height: cardAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, timeStripHeight],
                      }),
                      opacity: cardAnim,
                    }
                  : null,
              ]}
            >
              <View
                onLayout={(e) => {
                  const h = e.nativeEvent.layout.height;
                  if (h > 0 && Math.abs(h - timeStripHeight) > 1) setTimeStripHeight(h);
                }}
              >
            {/* Horizontal so the row can keep growing as filters are added
                without wrapping into a second line over the map. */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.chipRowContent}
              style={styles.chipRow}
            >
              <Pressable
                style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
                onPress={() => openPicker("start")}
                accessibilityRole="button"
                accessibilityLabel="Change times"
              >
                <Clock size={15} color={colors.primary} strokeWidth={2.3} />
                <Text style={styles.chipText}>
                  {searchMode === "monthly"
                    ? `${formatDateLabel(startAt)} – ${formatDateLabel(monthlyEndDate)}`
                    : `${formatTimeLabel(startAt)} – ${formatTimeLabel(endAt)}`}
                </Text>
                <ChevronDown size={15} color={colors.textMuted} strokeWidth={2.4} />
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
                onPress={() => setModePickerVisible(true)}
                accessibilityRole="button"
                accessibilityLabel={`Search mode: ${searchMode === "monthly" ? "Monthly" : "Hourly"}`}
              >
                <RollingSwap swapKey={searchMode}>
                  <Text style={styles.chipText}>
                    {searchMode === "monthly" ? "Monthly" : "Hourly"}
                  </Text>
                </RollingSwap>
                <ChevronDown size={15} color={colors.textMuted} strokeWidth={2.4} />
              </Pressable>

              {/* Only filters actually applied get a chip — the row states what
                  is narrowing the results, so an empty filter set adds nothing
                  to scan past. */}
              {activeFilterChips.map((label) => (
                <Pressable
                  key={label}
                  style={({ pressed }) => [styles.chip, styles.chipActive, pressed && styles.chipPressed]}
                  onPress={() => setShowFilters(true)}
                  accessibilityRole="button"
                  accessibilityLabel={`Filter: ${label}`}
                >
                  <Text style={[styles.chipText, styles.chipTextActive]}>{label}</Text>
                </Pressable>
              ))}
            </ScrollView>
              </View>
            </Animated.View>
          </View>

          {error ? (
            <View style={styles.errorRow}>
              <Text style={styles.error}>{error}</Text>
              <Pressable onPress={() => void runSearch()} style={styles.retryBtn}>
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </View>
          ) : null}

          {/* ── Finding spaces pill ─────────────────── */}
          <Animated.View
            pointerEvents="none"
            style={[styles.findingPill, { opacity: pillOpacity }]}
          >
            <View style={styles.findingSpinner}>
              <PulseDots />
            </View>
            <Text style={styles.findingText}>Finding spaces</Text>
          </Animated.View>
        </View>

        {/* ── Search this area — floating bottom-center pill ─────────────── */}
        {renderSearchArea && !visibleSelectedListing && (
          <Animated.View
            pointerEvents="box-none"
            style={[
              styles.searchAreaFloat,
              { bottom: 96 + insets.bottom, opacity: searchAreaOpacity, transform: [{ translateY: searchAreaTranslateY }] },
            ]}
          >
            <Pressable
              style={({ pressed }) => [styles.searchAreaPill, pressed && styles.searchAreaPillPressed]}
              onPress={() => {
                // Cancel any pending debounce — coordinates come from the
                // current map position at tap time, not the stale debounce snapshot.
                if (showAreaTimerRef.current) {
                  clearTimeout(showAreaTimerRef.current);
                  showAreaTimerRef.current = null;
                }
                const region = currentRegionRef.current;
                if (!region) return;
                const nextLat = region.latitude.toFixed(6);
                const nextLng = region.longitude.toFixed(6);
                const nextRadius = radiusKmForRegion(region).toFixed(2);
                setLat(nextLat);
                setLng(nextLng);
                setRadiusKm(nextRadius);
                void runSearch(
                  { lat: nextLat, lng: nextLng, radiusKm: nextRadius },
                  { showGlobal: false, preserveSelection: true }
                );
              }}
            >
              <RefreshCw size={14} color={colors.primary} strokeWidth={2.2} />
              <Text style={styles.searchAreaPillText}>Search this area</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* ── No spaces notice — floating bottom-center pill ──────────── */}
        {emptyNotice ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.searchAreaFloat,
              { bottom: 96 + insets.bottom, opacity: emptyNoticeOpacity },
            ]}
          >
            <View style={styles.emptyNoticePill}>
              <Info size={15} color={colors.textSoft} strokeWidth={2.2} />
              <Text style={styles.emptyNoticeText}>{emptyNotice}</Text>
            </View>
          </Animated.View>
        ) : null}

        {visibleSelectedListing ? (
          <MapBottomCard
            title={getListingDisplayTitle(visibleSelectedListing)}
            imageUrl={selectedListingImage ?? undefined}
            rating={visibleSelectedListing.rating ?? 0}
            reviewCount={visibleSelectedListing.rating_count ?? 0}
            price={
              searchMode === "monthly"
                ? `€${formatPriceValue(priceForListing(visibleSelectedListing))}/mo`
                : `€${formatPriceValue(priceForListing(visibleSelectedListing))}`
            }
            amenities={selectedCardAmenities ?? visibleSelectedListing.amenities ?? null}
            isAvailable={visibleSelectedListing.is_available !== false}
            isFavorite={isFavorite(visibleSelectedListing.id)}
            onToggleFavorite={() => handleToggleFavorite(visibleSelectedListing)}
            onPress={() => {
              // Leave the pin selected — clearing it remounts the marker
              // mid-transition and it visibly flickers behind the push.
              navigation.navigate("Listing", {
                id: visibleSelectedListing.id,
                from,
                to,
                mode: searchMode === "monthly" ? "monthly" : undefined,
              });
            }}
            bottomOffset={82 + insets.bottom}
            horizontalInset={16}
            dismissing={dismissingCard}
            onHeightChange={(h) => { cardHeightRef.current = h; }}
          />
        ) : null}
        {filtersVisible ? (
          <View style={styles.filtersOverlay}>
            <Animated.View style={[styles.filtersBackdrop, { opacity: backdropOpacity }]}>
              <Pressable style={StyleSheet.absoluteFillObject} onPress={closeFilters} />
            </Animated.View>
            <KeyboardAvoidingView
              style={styles.filtersSheetHost}
              behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
              <Animated.View
                style={[
                  styles.filtersPanel,
                  {
                    height: Math.min(windowHeight * 0.88, 760),
                    paddingBottom: Math.max(14, insets.bottom + 10),
                    transform: [{ translateY: slideAnim }],
                  },
                ]}
              >
                <View style={styles.filtersTopBar}>
                  <Pressable style={styles.filtersIconButton} onPress={closeFilters} hitSlop={8}>
                    <X size={22} color={colors.text} strokeWidth={2.2} />
                  </Pressable>
                  <Text style={styles.filtersTitle}>Filters</Text>
                  <Pressable
                    style={[styles.filtersClearAction, activeFilterCount === 0 && styles.filtersClearActionDisabled]}
                    onPress={clearFiltersAndSearch}
                    disabled={activeFilterCount === 0}
                  >
                    <Text style={styles.filtersHeaderActionText}>
                      Clear
                    </Text>
                  </Pressable>
                </View>

                <ScrollView
                  style={styles.filtersScroll}
                  contentContainerStyle={styles.filtersContent}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  <FilterSection title="Popular">
                    <View style={styles.filterChipGrid}>
                      <FilterChip
                        label="Instant"
                        icon={Zap}
                        selected={instantBook}
                        onPress={() => setInstantBook((prev) => !prev)}
                      />
                      <FilterChip
                        label="Covered"
                        icon={House}
                        selected={coveredParking}
                        onPress={() => setCoveredParking((prev) => !prev)}
                      />
                      <FilterChip
                        label="EV charging"
                        icon={BatteryCharging}
                        selected={evCharging}
                        onPress={() => setEvCharging((prev) => !prev)}
                      />
                      <FilterChip
                        label="Gated"
                        icon={Lock}
                        selected={securityLevel === "gated"}
                        onPress={() => setSecurityLevel(securityLevel === "gated" ? "" : "gated")}
                      />
                      <FilterChip
                        label="CCTV"
                        icon={Cctv}
                        selected={securityLevel === "cctv"}
                        onPress={() => setSecurityLevel(securityLevel === "cctv" ? "" : "cctv")}
                      />
                    </View>
                  </FilterSection>

                  <FilterSection title="Price shown">
                    <PriceRangeSlider
                      minValue={priceMin}
                      maxValue={priceMax}
                      priceValues={filterPriceValues}
                      onMinChange={setPriceMin}
                      onMaxChange={setPriceMax}
                    />
                  </FilterSection>

                  <FilterSection title="Parking type">
                    <View style={styles.filterTileGrid}>
                      {SPACE_TYPE_OPTIONS.map((type) => {
                        const TypeIcon = type.icon;
                        return (
                          <Pressable
                            key={type.value}
                            style={({ pressed }) => [
                              styles.filterTile,
                              spaceType === type.value && styles.filterTileActive,
                              pressed && styles.filterChipButtonPressed,
                            ]}
                            onPress={() => setSpaceType(spaceType === type.value ? "" : type.value)}
                          >
                            <TypeIcon
                              size={18}
                              color={spaceType === type.value ? colors.primary : colors.textMuted}
                              strokeWidth={2}
                            />
                            <Text
                              style={[
                                styles.filterTileText,
                                spaceType === type.value && styles.filterTileTextActive,
                              ]}
                            >
                              {type.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </FilterSection>

                  <FilterSection title="Vehicle size">
                    <View style={styles.filterChipGrid}>
                      {VEHICLE_SIZE_OPTIONS.map((option) => (
                        <FilterChip
                          key={option.label}
                          label={option.label}
                          selected={vehicleSize === option.value}
                          onPress={() => setVehicleSize(vehicleSize === option.value ? "" : option.value)}
                        />
                      ))}
                    </View>
                  </FilterSection>
                </ScrollView>
                <View style={styles.filterFooter}>
                  <Pressable
                    style={styles.applyButton}
                    onPress={() => {
                      closeFilters();
                      void runSearch();
                    }}
                  >
                    <Text style={styles.applyButtonText}>Show spaces</Text>
                  </Pressable>
                </View>
              </Animated.View>
            </KeyboardAvoidingView>
          </View>
        ) : null}
        {searchSheetVisible ? (
          <KeyboardAvoidingView
            style={styles.searchOverlay}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <Animated.View
              style={[
                styles.searchPanel,
                { transform: [{ translateY: searchAnim }], opacity: searchOverlayOpacity },
              ]}
            >
              {/* ── Search bar (back + input in one row) ── */}
              <View style={[styles.searchTopBar, { paddingTop: insets.top + 10 }]}>
                <Pressable onPress={() => setSearchSheetOpen(false)} hitSlop={10} style={styles.searchBackBtn}>
                  <ArrowLeft size={22} color={colors.text} strokeWidth={2.2} />
                </Pressable>
                <View style={styles.searchInputShell}>
                  <Search size={16} color={colors.textMuted} strokeWidth={2.1} style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.searchInputField}
                    value={addressQuery}
                    onChangeText={(value) => {
                      setAddressQuery(value);
                      if (!value.trim()) setAddressSuggestions([]);
                    }}
                    placeholder="Area, address or landmark"
                    placeholderTextColor={colors.textDisabled}
                    returnKeyType="search"
                    autoFocus
                  />
                  {addressQuery ? (
                    <Pressable
                      onPress={() => { setAddressQuery(""); setAddressSuggestions([]); }}
                      hitSlop={8}
                    >
                      <CircleX size={16} color={colors.textDisabled} strokeWidth={2.1} />
                    </Pressable>
                  ) : null}
                </View>
              </View>

              {/* ── Body ─────────────────────────────── */}
              <ScrollView
                style={styles.searchBody}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.searchList}>
                  {addressQuery.trim() ? (
                    /* ── Autocomplete results ── */
                    addressLoading ? (
                      <View style={styles.searchEmptyRow}>
                        <Text style={styles.searchEmptyText}>Searching…</Text>
                      </View>
                    ) : addressSuggestions.length > 0 ? (
                      addressSuggestions.slice(0, 6).map((suggestion, index) => {
                        const commaIdx = suggestion.description.indexOf(",");
                        const mainText = commaIdx > -1 ? suggestion.description.slice(0, commaIdx) : suggestion.description;
                        const secondaryText = commaIdx > -1 ? suggestion.description.slice(commaIdx + 1).trim() : "";
                        return (
                          <Pressable
                            key={suggestion.place_id}
                            style={({ pressed }) => [styles.searchRow, pressed && styles.searchRowPressed]}
                            onPress={() => { setSearchSheetOpen(false); void handleSelectSuggestion(suggestion); }}
                          >
                            <View style={styles.searchRowIcon}>
                              <MapPinIcon size={16} color={colors.primary} strokeWidth={2.2} />
                            </View>
                            <View style={styles.searchRowCopy}>
                              <Text style={styles.searchRowTitle} numberOfLines={1}>{mainText}</Text>
                              {secondaryText ? <Text style={styles.searchRowSub} numberOfLines={1}>{secondaryText}</Text> : null}
                            </View>
                          </Pressable>
                        );
                      })
                    ) : (
                      <View style={styles.searchEmptyRow}>
                        <Text style={styles.searchEmptyText}>No results found.</Text>
                      </View>
                    )
                  ) : (
                    <>
                      {/* ── Use current location ── */}
                      <Pressable
                        style={({ pressed }) => [styles.searchRow, styles.searchRowLocation, pressed && styles.searchRowPressed]}
                        onPress={handleUseCurrentLocation}
                        disabled={locating}
                      >
                        <View style={[styles.searchRowIcon, styles.searchRowIconLocate]}>
                          <LocateFixed size={17} color={colors.cardBg} strokeWidth={2.2} />
                        </View>
                        <View style={styles.searchRowCopy}>
                          <Text style={styles.searchLocationTitle}>
                            {locating ? "Finding your location…" : "Use current location"}
                          </Text>
                          {locationError
                            ? <Text style={styles.searchRowSub}>{locationError}</Text>
                            : <Text style={styles.searchRowSub}>Use GPS to find spaces near you</Text>
                          }
                        </View>
                      </Pressable>

                      {/* ── Section header with inline tab toggle ── */}
                      <View style={styles.searchSectionHeader}>
                        <Text style={styles.searchSectionLabel}>
                          {activeSearchTab === "recents" ? "Recent searches" : "Favourites"}
                        </Text>
                        <View style={styles.searchToggle}>
                          {(["recents", "favourites"] as const).map((tab) => (
                            <Pressable
                              key={tab}
                              style={[styles.searchToggleBtn, activeSearchTab === tab && styles.searchToggleBtnActive]}
                              onPress={() => setActiveSearchTab(tab)}
                            >
                              <Text style={[styles.searchToggleText, activeSearchTab === tab && styles.searchToggleTextActive]}>
                                {tab === "recents" ? "Recent" : "Saved"}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>

                      {/* ── List items ── */}
                      {activeSearchTab === "recents" ? (
                        searchHistory.length > 0 ? (
                          searchHistory.map((item) => (
                            <View key={`${item.label}-${item.lat}-${item.lng}`} style={styles.searchRow}>
                              <Pressable style={styles.searchRowPress} onPress={() => handleSelectHistoryItem(item)}>
                                <View style={styles.searchRowIcon}>
                                  <Clock size={16} color={colors.textMuted} strokeWidth={2.1} />
                                </View>
                                <Text style={styles.searchRowTitle} numberOfLines={1}>{item.label}</Text>
                              </Pressable>
                              <Pressable style={styles.searchRemoveBtn} onPress={() => removeFromHistory(item)} hitSlop={10}>
                                <X size={14} color={colors.textDisabled} strokeWidth={2.2} />
                              </Pressable>
                            </View>
                          ))
                        ) : (
                          <View style={styles.searchEmptyState}>
                            <Text style={styles.searchEmptyStateText}>No recent searches yet</Text>
                          </View>
                        )
                      ) : (
                        favorites.length > 0 ? (
                          favorites.map((item) => {
                            const favImage = item.image_urls?.[0];
                            return (
                              <Pressable
                                key={`fav-${item.id}`}
                                style={({ pressed }) => [styles.searchRow, pressed && styles.searchRowPressed]}
                                onPress={() => navigation.navigate("Listing", { id: item.id, from, to })}
                              >
                                {favImage ? (
                                  <Image source={{ uri: favImage }} style={styles.searchRowThumb} />
                                ) : (
                                  <View style={[styles.searchRowIcon, styles.searchRowIconHeart]}>
                                    <Heart size={14} color={colors.primary} fill={colors.primary} strokeWidth={2.1} />
                                  </View>
                                )}
                                <View style={styles.searchRowCopy}>
                                  <Text style={styles.searchRowTitle} numberOfLines={1}>{getListingDisplayTitle(item)}</Text>
                                  <Text style={styles.searchRowSub} numberOfLines={1}>{publicAddress(item.address)}</Text>
                                </View>
                                <ChevronRight size={16} color={colors.textMuted} strokeWidth={2.2} />
                              </Pressable>
                            );
                          })
                        ) : (
                          <View style={styles.searchEmptyState}>
                            <Text style={styles.searchEmptyStateText}>No favourites saved yet</Text>
                          </View>
                        )
                      )}
                    </>
                  )}
                </View>
              </ScrollView>
            </Animated.View>
          </KeyboardAvoidingView>
        ) : null}
        {Platform.OS !== "web" ? (
          Platform.OS === "android" && pickerVisible ? (
            <Modal transparent animationType="fade" visible>
              <View style={styles.pickerBackdrop}>
                <Pressable style={StyleSheet.absoluteFillObject} onPress={closePicker} />
                <Animated.View style={[styles.pickerSheet, { paddingBottom: Math.max(24, insets.bottom + 12), transform: [{ translateY: pickerSheetAnim }] }]}>

                  <View style={styles.pickerHandle} />

                  <View style={styles.pickerHeader}>
                    <Text style={styles.pickerTitle}>
                      {searchMode === "monthly"
                        ? "Arrive from"
                        : pickerField === "start"
                          ? "Arrival time"
                          : "Departure time"}
                    </Text>
                    {searchMode !== "monthly" && pickerField === "end" ? (
                      <Text style={styles.pickerSubtitle}>arriving {formatTimeLabel(startAt)}</Text>
                    ) : null}
                  </View>

                  {/* Quick duration pills — end picker only */}
                  {pickerField === "end" ? (() => {
                    const activeHours = draftDate
                      ? Math.round((draftDate.getTime() - startAt.getTime()) / 3_600_000)
                      : null;
                    return (
                      <View style={styles.pickerQuickRow}>
                        {([1, 2, 4, 8] as const).map((hours) => {
                          const active = activeHours === hours;
                          return (
                            <Pressable
                              key={hours}
                              style={[styles.pickerQuickPill, active && styles.pickerQuickPillActive]}
                              onPress={() => applyQuickDuration(hours)}
                            >
                              <Text style={[styles.pickerQuickText, active && styles.pickerQuickTextActive]}>{hours}h</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    );
                  })() : null}

                  {/* Drum wheel */}
                  <DrumRollPicker
                    date={draftDate ?? (pickerField === "start" ? startAt : endAt)}
                    minuteInterval={5}
                    dateOnly={searchMode === "monthly"}
                    onChange={(date) => setDraftDate(date)}
                    drumRef={drumPickerRef}
                  />

                  {/* Button row */}
                  <View style={styles.pickerFooter}>
                    <Pressable
                      style={styles.pickerBackBtn}
                      onPress={() => {
                        if (pickerField === "end" && searchMode !== "monthly") {
                          setPickerField("start");
                          setDraftDate(startAt);
                        } else {
                          closePicker();
                        }
                      }}
                    >
                      <Text style={styles.pickerBackBtnText}>
                        {pickerField === "end" && searchMode !== "monthly" ? "Back" : "Cancel"}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.pickerFooterPrimary, pressed && { opacity: 0.88 }]}
                      onPress={() => {
                        const next = draftDate ?? (pickerField === "start" ? startAt : endAt);
                        // Monthly picks a single "arrive from" date — no Leave step.
                        if (searchMode === "monthly") {
                          applyPickedDate(next);
                          closePicker();
                          return;
                        }
                        if (pickerField === "start") {
                          applyPickedDate(next);
                          const suggestedEnd = new Date(next);
                          suggestedEnd.setHours(suggestedEnd.getHours() + 2);
                          setPickerField("end");
                          setDraftDate(suggestedEnd);
                          return;
                        }
                        timeSearchPendingRef.current = true;
                        applyPickedDate(next);
                        closePicker();
                      }}
                    >
                      <Text style={styles.pickerFooterPrimaryText}>
                        {searchMode === "monthly" || pickerField === "end" ? "Done" : "Next"}
                      </Text>
                    </Pressable>
                  </View>

                </Animated.View>
              </View>
            </Modal>
          ) : (
            <DatePicker
              modal
              open={pickerVisible}
              date={draftDate ?? (pickerField === "start" ? startAt : endAt)}
              mode={searchMode === "monthly" ? "date" : "datetime"}
              minuteInterval={5}
              onConfirm={(date) => {
                setDraftDate(date);
                // Monthly picks a single "arrive from" date — no Leave step.
                if (searchMode === "monthly") {
                  applyPickedDate(date);
                  setPickerVisible(false);
                  setDraftDate(null);
                  return;
                }
                if (pickerField === "start") {
                  applyPickedDate(date);
                  const suggestedEnd = new Date(date);
                  suggestedEnd.setHours(suggestedEnd.getHours() + 2);
                  setPickerField("end");
                  setDraftDate(suggestedEnd);
                  setTimeout(() => setPickerVisible(true), 0);
                  return;
                }
                timeSearchPendingRef.current = true;
                applyPickedDate(date);
                setPickerVisible(false);
                setDraftDate(null);
              }}
              onCancel={() => {
                setPickerVisible(false);
                setDraftDate(null);
              }}
            />
          )
        ) : null}
      </View>

      {overlappingPins.length > 1 && (
        <Modal transparent animationType="fade" visible onRequestClose={() => setOverlappingPins([])}>
          <Pressable style={styles.overlappingBackdrop} onPress={() => setOverlappingPins([])}>
            <View style={styles.overlappingSheet}>
              <View style={styles.overlappingHeader}>
                <Text style={styles.overlappingTitle}>Select parking spot</Text>
                <Text style={styles.overlappingSubtitle}>{overlappingPins.length} spots at this location</Text>
              </View>
              <View style={styles.overlappingList}>
                {overlappingPins.map((listing) => (
                  <Pressable
                    key={listing.id}
                    style={styles.overlappingItem}
                    onPress={() => {
                      setSelectedId(listing.id);
                      setOverlappingPins([]);
                    }}
                  >
                    <View style={styles.overlappingItemContent}>
                      <Text style={styles.overlappingItemTitle} numberOfLines={1}>
                        {getListingDisplayTitle(listing)}
                      </Text>
                      <Text style={styles.overlappingItemAddress} numberOfLines={1}>
                        {publicAddress(listing.address)}
                      </Text>
                    </View>
                    <Text style={styles.overlappingItemPrice}>
                      €{formatPriceValue(priceForListing(listing))}
                      {searchMode === "monthly" ? "/mo" : ""}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </Pressable>
        </Modal>
      )}

      {modePickerVisible && (
        <Modal transparent animationType="fade" visible onRequestClose={() => setModePickerVisible(false)}>
          <Pressable style={styles.modeDropdownBackdrop} onPress={() => setModePickerVisible(false)}>
            <View style={[styles.modeDropdown, { top: insets.top + 66 }]}>
              {(["hourly", "monthly"] as const).map((m) => {
                const active = searchMode === m;
                return (
                  <Pressable
                    key={m}
                    style={({ pressed }) => [
                      styles.modeDropdownItem,
                      pressed && styles.searchCardRowPressed,
                    ]}
                    onPress={() => {
                      setModePickerVisible(false);
                      setSearchMode(m);
                    }}
                  >
                    <Text style={[styles.modeDropdownText, active && styles.modeDropdownTextActive]}>
                      {m === "hourly" ? "Hourly" : "Monthly"}
                    </Text>
                    {active ? (
                      <ChevronRight size={16} color={colors.primary} strokeWidth={2.6} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Modal>
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapShell: {
    flex: 1,
    position: "relative",
  },
  mapLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.pageBg,
    zIndex: 10,
  },
  mapLoadingLottie: {
    width: 120,
    height: 120,
  },
  mapLoadingText: {
    color: colors.textSoft,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    letterSpacing: -0.1,
    marginTop: 10,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    left: 16,
    position: "absolute",
    right: 16,
    top: 12,
  },

  // ── Search card — one floating surface for destination + times.
  // A single hero shadow instead of two stacked cards competing: the eye
  // lands here first, then falls to the map.

  // ── Search pill + round filter button ──────────────────────────────────────
  searchBarRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  searchPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 15,
    backgroundColor: colors.cardBg,
    borderRadius: radius.pill,
    shadowColor: "#0B1220",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 7,
  },
  searchPillText: {
    flex: 1,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 16,
    color: colors.text,
    letterSpacing: -0.2,
  },
  filterCircle: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cardBg,
    shadowColor: "#0B1220",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 7,
  },

  // ── Chip row ───────────────────────────────────────────────────────────────
  // Negative margins let the chips scroll edge to edge while the overlay keeps
  // its 16pt gutter, so the first and last chip aren't clipped mid-shadow.
  chipRow: { marginHorizontal: -16, marginTop: 10 },
  chipRowContent: { paddingHorizontal: 16, gap: 8, paddingVertical: 2 },
  // A bordered pill, not a shadowed one. The search pill above casts the only
  // shadow over the map; four more under the chips turned the row into a second
  // floating surface competing with it.
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 34,
    paddingHorizontal: 13,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.pill,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.accentSoft },
  chipPressed: { opacity: 0.7 },
  chipText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    color: colors.text,
  },
  chipTextActive: { color: colors.primary },
  // Filters live inside the search surface (Airbnb pattern) — one floating
  // object instead of a card plus a trailing chip row.
  filterBtnBadge: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderColor: colors.cardBg,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    height: 16,
    justifyContent: "center",
    minWidth: 16,
    paddingHorizontal: 3,
    position: "absolute",
    right: 9,
    top: 10,
  },
  filterBtnBadgeText: {
    color: colors.textInverse,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 11,
    lineHeight: 12,
  },
  searchCardPlaceholder: {
    color: colors.textMuted,
    fontFamily: "PlusJakartaSans-Regular",
  },
  // Divider insets to the text edge (18 pad + 17 icon + 12 gap), iOS-style —
  // a full-bleed rule would cut the card in half; this one connects the rows.
  searchCardRowPressed: {
    backgroundColor: colors.cardBgMuted,
  },
  // Collapsed pill keeps the booking window visible at a glance.
  searchCardTimesCompact: {
    color: colors.textSoft,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    letterSpacing: -0.1,
  },
  timeStripCollapse: {
    overflow: "hidden",
  },
  // ── Time row (lives inside the search card)
  // ── Inline mode dropdown chip (Hourly / Monthly) — blended into the field
  modeDropdownBackdrop: {
    flex: 1,
  },
  modeDropdown: {
    position: "absolute",
    right: spacing.screenX + 4,
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 4,
    minWidth: 150,
    shadowColor: "#0B1220",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 12,
  },
  modeDropdownItem: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  modeDropdownText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14,
    color: colors.textSoft,
    letterSpacing: -0.1,
  },
  modeDropdownTextActive: {
    color: colors.text,
  },
  findingPill: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: colors.cardBg,
    borderRadius: radius.pill,
    elevation: 5,
    flexDirection: "row",
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: "#0B1220",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 14,
  },
  findingSpinner: {
    marginRight: 8,
  },
  findingText: {
    color: colors.text,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    letterSpacing: -0.2,
  },

  filtersPanel: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    elevation: 8,
    overflow: "hidden",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  filtersSheetHost: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
  },
  filtersScroll: {
    flex: 1,
  },
  filtersContent: {
    paddingBottom: 8,
    paddingHorizontal: spacing.screenX,
  },
  filtersOverlay: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 20,
  },
  filtersBackdrop: {
    backgroundColor: "rgba(15, 23, 42, 0.35)",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  filtersTopBar: {
    alignItems: "center",
    borderBottomColor: colors.divider,
    borderBottomWidth: 1,
    flexDirection: "row",
    minHeight: 58,
    paddingHorizontal: 12,
  },
  filtersIconButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  filtersClearAction: {
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 8,
    width: 58,
  },
  filtersClearActionDisabled: {
    opacity: 0.25,
  },
  filtersHeaderActionText: {
    color: colors.accent,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    letterSpacing: 0,
  },
  filtersTitle: {
    flex: 1,
    color: colors.text,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 22,
    letterSpacing: -0.2,
    textAlign: "center",
  },
  // Whitespace, not a drawn line, separates groups (docs/PARKING_DESIGN_BIBLE.md
  // E1) — every section used to share an identical hairline, which read as a
  // stacked form rather than a designed sheet.
  filterSection: {
    paddingVertical: 24,
  },
  filterSectionHeader: {
    marginBottom: 14,
  },
  filterSectionTitle: {
    color: colors.text,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 19,
    letterSpacing: -0.3,
  },
  filterSectionSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  priceSlider: {
    paddingTop: 10,
  },
  priceRangeHint: {
    color: colors.textMuted,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  priceRangeGraph: {
    height: 124,
    overflow: "visible",
    position: "relative",
  },
  priceHistogram: {
    alignItems: "flex-end",
    flexDirection: "row",
    height: "100%",
    justifyContent: "space-between",
    marginHorizontal: 21,
    paddingBottom: 28,
    position: "relative",
  },
  priceHistogramBar: {
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    flex: 1,
    marginHorizontal: 2,
    maxWidth: 8,
  },
  priceHistogramBarSelected: {
    backgroundColor: colors.text,
  },
  priceRangeValueRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  priceRangeValueRight: {
    alignItems: "flex-end",
  },
  priceRangeDivider: {
    backgroundColor: colors.border,
    flex: 1,
    height: 1,
    marginHorizontal: 14,
  },
  priceRangeValue: {
    color: colors.text,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 20,
    letterSpacing: -0.6,
    marginTop: 3,
  },
  priceValueLabel: {
    color: colors.textSoft,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    letterSpacing: 0,
  },
  priceRangeSlider: {
    bottom: 0,
    height: 54,
    left: 0,
    position: "absolute",
    right: 0,
  },
  priceRangeSliderTrack: {
    borderRadius: radius.pill,
    height: 4,
  },
  priceRangeSliderSelectedTrack: {
    borderRadius: radius.pill,
    height: 4,
  },
  priceRangeThumb: {
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  priceRangeThumbDot: {
    backgroundColor: colors.text,
    borderRadius: radius.pill,
    height: 11,
    width: 11,
  },
  filterChipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  filterChipButton: {
    alignItems: "center",
    backgroundColor: colors.cardBgMuted,
    borderColor: colors.divider,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  filterChipButtonSmall: {
    minHeight: 38,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipButtonActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  filterChipButtonPressed: {
    opacity: 0.92,
  },
  filterChipButtonText: {
    color: colors.text,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    letterSpacing: 0,
  },
  filterChipButtonTextActive: {
    color: colors.textInverse,
  },
  filterTileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  filterTile: {
    alignItems: "center",
    backgroundColor: colors.cardBgMuted,
    borderColor: colors.divider,
    borderRadius: 14,
    borderWidth: 1,
    flexBasis: "47%",
    flexDirection: "row",
    gap: 9,
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  filterTileActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  filterTileText: {
    color: colors.text,
    flexShrink: 1,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    letterSpacing: 0,
  },
  filterTileTextActive: {
    color: colors.primary,
  },
  filterFooter: {
    backgroundColor: colors.cardBg,
    borderTopColor: colors.divider,
    borderTopWidth: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: 12,
  },
  applyButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    minHeight: 52,
    paddingVertical: 13,
  },
  applyButtonText: {
    ...textStyles.button,
    fontSize: 14,
    letterSpacing: 0,
  },
  // ── Search sheet ──────────────────────────────────────────────
  searchOverlay: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 40,
  },
  searchPanel: {
    flex: 1,
    backgroundColor: colors.cardBg,
  },

  // Top bar — back arrow + input in one row
  searchTopBar: {
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderBottomColor: colors.divider,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  searchBackBtn: {
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 44,
    flexShrink: 0,
  },
  searchInputShell: {
    alignItems: "center",
    backgroundColor: colors.cardBgMuted,
    borderRadius: radius.pill,
    flex: 1,
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  searchInputField: {
    flex: 1,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 16,
    color: colors.text,
  },

  // Body — unified list, no separate cards
  searchBody: {
    flex: 1,
    backgroundColor: colors.cardBg,
  },
  searchList: {
    backgroundColor: colors.cardBg,
    borderTopWidth: 0,
  },

  // Location row
  searchRowLocation: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  // Solid CTA fill, not another grey circle — "Use current location" is the
  // fastest path through this sheet and should read as the primary action,
  // not just another list row (docs/PARKING_DESIGN_BIBLE.md A7).
  searchRowIconLocate: {
    backgroundColor: colors.primary,
  },
  searchLocationTitle: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14,
    color: colors.text,
  },

  // Section header row with inline toggle
  searchSectionHeader: {
    alignItems: "center",
    backgroundColor: colors.cardBgMuted,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchSectionLabel: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 12,
    color: colors.textSoft,
    letterSpacing: 0.2,
  },
  searchToggle: {
    backgroundColor: colors.divider,
    borderRadius: radius.md,
    flexDirection: "row",
    gap: 2,
    padding: 2,
  },
  searchToggleBtn: {
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  searchToggleBtnActive: {
    backgroundColor: colors.cardBg,
  },
  searchToggleText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 12,
    color: colors.textSoft,
  },
  searchToggleTextActive: {
    color: colors.text,
  },

  // Rows
  searchRow: {
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderBottomColor: colors.divider,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  searchRowPressed: {
    backgroundColor: colors.cardBgMuted,
  },
  searchRowPress: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 12,
  },
  searchRowIcon: {
    alignItems: "center",
    backgroundColor: colors.cardBgMuted,
    borderRadius: radius.pill,
    flexShrink: 0,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  searchRowIconHeart: {
    backgroundColor: colors.accentSoft,
  },
  // A saved space is recognised by its photo, not its address (A8) — same
  // circular footprint as searchRowIcon so the row rhythm doesn't jump.
  searchRowThumb: {
    backgroundColor: colors.cardBgMuted,
    borderRadius: radius.pill,
    flexShrink: 0,
    height: 40,
    width: 40,
  },
  searchRowCopy: {
    flex: 1,
  },
  searchRowTitle: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    color: colors.text,
  },
  searchRowSub: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    color: colors.textSoft,
    marginTop: 2,
  },
  searchRemoveBtn: {
    alignItems: "center",
    height: 26,
    justifyContent: "center",
    width: 26,
    flexShrink: 0,
  },

  // Empty
  searchEmptyRow: {
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  searchEmptyText: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 15,
    color: colors.textSoft,
  },
  searchEmptyState: {
    alignItems: "center",
    paddingVertical: 48,
  },
  searchEmptyStateText: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 15,
    color: colors.textSoft,
    marginTop: 0,
  },

  sectionLabel: {
    ...textStyles.meta,
    color: colors.text,
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  searchAreaFloat: {
    alignItems: "center",
    left: 0,
    position: "absolute",
    right: 0,
    zIndex: 15,
  },
  searchAreaPill: {
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderRadius: radius.pill,
    elevation: 6,
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 18,
    paddingVertical: 12,
    shadowColor: "#0B1220",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
  },
  searchAreaPillPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  searchAreaPillText: {
    color: colors.text,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 14,
    letterSpacing: -0.1,
  },
  emptyNoticePill: {
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderRadius: radius.pill,
    elevation: 6,
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 18,
    paddingVertical: 12,
    shadowColor: "#0B1220",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
  },
  emptyNoticeText: {
    color: colors.textSoft,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    letterSpacing: -0.1,
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "flex-end",
  },
  pickerSheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: 16,
    paddingTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 6,
  },
  pickerHandle: {
    alignSelf: "center",
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    height: 4,
    marginBottom: 12,
    width: 40,
  },
  pickerHeader: {
    alignItems: "center",
    marginBottom: 12,
  },
  pickerTitle: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 16,
    color: colors.text,
    letterSpacing: -0.3,
  },
  pickerSubtitle: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12,
    color: colors.textSoft,
    marginTop: 2,
  },

  // Quick duration pills
  pickerQuickRow: {
    flexDirection: "row",
    gap: 7,
    marginBottom: 12,
  },
  pickerQuickPill: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderColor: colors.divider,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingVertical: 10,
  },
  pickerQuickPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pickerQuickText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    color: colors.textSoft,
  },
  pickerQuickTextActive: {
    color: colors.textInverse,
  },

  pickerFooter: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  pickerBackBtn: {
    alignItems: "center",
    borderColor: colors.divider,
    borderRadius: 14,
    borderWidth: 1.5,
    flex: 1,
    height: 52,
    justifyContent: "center",
  },
  pickerBackBtnText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    color: colors.textSoft,
    letterSpacing: -0.2,
  },
  pickerFooterPrimary: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    flex: 2,
    height: 52,
    justifyContent: "center",
    ...primaryButtonShadow,
  },
  pickerFooterPrimaryText: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 16,
    color: colors.textInverse,
    letterSpacing: -0.3,
  },
  errorRow: {
    alignItems: "center",
    gap: 2,
    marginTop: 10,
  },
  // Bare red text is illegible over map tiles — errors get a surface like
  // every other floating element.
  error: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.pill,
    color: colors.danger,
    fontFamily: "PlusJakartaSans-Medium",
    fontSize: 13,
    overflow: "hidden",
    paddingHorizontal: 16,
    paddingVertical: 9,
    textAlign: "center",
    shadowColor: "#0B1220",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 14,
    elevation: 4,
  },
  retryBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  retryText: {
    color: colors.primary,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 13,
    letterSpacing: -0.1,
  },
  overlappingBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.35)",
    justifyContent: "flex-end",
  },
  overlappingSheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    maxHeight: "70%",
    paddingBottom: 32,
  },
  overlappingHeader: {
    borderBottomColor: colors.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 16,
  },
  overlappingTitle: {
    ...textStyles.titleSmall,
    marginBottom: 4,
  },
  overlappingSubtitle: {
    ...textStyles.bodyMedium,
  },
  overlappingList: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  // Soft-fill rows instead of border+shadow boxes — a sheet's list should
  // read as choices, not as a stack of cards inside a card.
  overlappingItem: {
    backgroundColor: colors.cardBgMuted,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 5,
    marginHorizontal: 8,
    padding: 16,
  },
  overlappingItemContent: {
    flex: 1,
    marginRight: 12,
  },
  overlappingItemTitle: {
    ...textStyles.bodyStrong,
    fontSize: 15,
    marginBottom: 4,
  },
  overlappingItemAddress: {
    ...textStyles.meta,
  },
  overlappingItemPrice: {
    ...textStyles.titleSmall,
    color: colors.accent,
  },
});
