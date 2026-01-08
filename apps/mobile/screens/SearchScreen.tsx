import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Switch,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import LottieView from "lottie-react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import type MapView from "react-native-maps";
import DatePicker from "react-native-date-picker";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../auth";
import { useAppLaunch } from "../appLaunch";
import { useFavorites } from "../favorites";
import MapSection from "../components/MapSection";
import { MapBottomCard } from "../components/MapBottomCard";
import { LIGHT_MAP_STYLE } from "../components/mapStyles";
import { searchListings } from "../api";
import { logError, logInfo } from "../logger";
import type {
  ListingSummary,
  RootStackParamList,
  SearchParams,
  SecurityLevel,
  VehicleSize,
} from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Search">;

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

const formatDateLabel = (date: Date) =>
  `${weekdayNames[date.getDay()]} ${date.getDate()}${ordinalSuffix(date.getDate())} ${
    monthNames[date.getMonth()]
  }`;

const formatTimeLabel = (date: Date) => `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

const formatDateTimeLabel = (date: Date) => `${formatDateLabel(date)} · ${formatTimeLabel(date)}`;

export function SearchScreen({ navigation }: Props) {
  const today = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);
    end.setHours(end.getHours() + 2);
    return {
      from: start.toISOString(),
      to: end.toISOString(),
    };
  }, []);

  const [lat, setLat] = useState("53.3498");
  const [lng, setLng] = useState("-6.2603");
  const [radiusKm, setRadiusKm] = useState("5");
  const [from, setFrom] = useState(today.from);
  const [to, setTo] = useState(today.to);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ListingSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addressQuery, setAddressQuery] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<PlaceSuggestion[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [startAt, setStartAt] = useState(new Date(today.from));
  const [endAt, setEndAt] = useState(new Date(today.to));
  const [pickerField, setPickerField] = useState<"start" | "end">("start");
  const [pickerVisible, setPickerVisible] = useState(false);
  const [draftDate, setDraftDate] = useState<Date | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [securityLevel, setSecurityLevel] = useState<SecurityLevel | "">("");
  const [vehicleSize, setVehicleSize] = useState<VehicleSize | "">("");
  const [coveredParking, setCoveredParking] = useState(false);
  const [evCharging, setEvCharging] = useState(false);
  const [instantBook, setInstantBook] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [searchSheetVisible, setSearchSheetVisible] = useState(false);
  const [searchSheetOpen, setSearchSheetOpen] = useState(false);
  const [activeSearchTab, setActiveSearchTab] = useState<"recents" | "favourites">("recents");
  const [pendingSearch, setPendingSearch] = useState<{
    lat: string;
    lng: string;
    radiusKm: string;
  } | null>(null);
  const [showSearchArea, setShowSearchArea] = useState(false);
  const { user } = useAuth();
  const { launchComplete } = useAppLaunch();
  const { favorites, isFavorite, toggle } = useFavorites();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const searchAnim = useRef(new Animated.Value(0)).current;
  const searchOverlayOpacity = useMemo(
    () =>
      searchAnim.interpolate({
        inputRange: [0, 40],
        outputRange: [1, 0],
      }),
    [searchAnim]
  );
  const searchRequestIdRef = useRef(0);
  const searchStartedAtRef = useRef(0);

  const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

  const parsedLat = Number.parseFloat(lat);
  const parsedLng = Number.parseFloat(lng);
  const usingDefaultCenter = !Number.isFinite(parsedLat) || !Number.isFinite(parsedLng);
  const mapRegion = {
    latitude: Number.isFinite(parsedLat) ? parsedLat : 53.3498,
    longitude: Number.isFinite(parsedLng) ? parsedLng : -6.2603,
    latitudeDelta: usingDefaultCenter ? 0.012 : 0.06,
    longitudeDelta: usingDefaultCenter ? 0.012 : 0.06,
  };
  const ignoreNextRegionChangeRef = useRef(false);
  const lastSearchCenterRef = useRef<{ lat: number; lng: number } | null>(null);
  const mapRef = useRef<MapView | null>(null);
  const skipAutocompleteRef = useRef(0);
  const historyLoadedRef = useRef(false);
  const HISTORY_KEY = "searchHistory";

  const buildSearchParams = (overrides?: Partial<SearchParams>): SearchParams => {
    const next: SearchParams = {
      lat,
      lng,
      radiusKm,
      from,
      to,
    };
    if (priceMin.trim()) next.priceMin = priceMin.trim();
    if (priceMax.trim()) next.priceMax = priceMax.trim();
    if (securityLevel) next.securityLevel = securityLevel;
    if (vehicleSize) next.vehicleSize = vehicleSize;
    if (coveredParking) next.coveredParking = true;
    if (evCharging) next.evCharging = true;
    if (instantBook) next.instantBook = true;
    return { ...next, ...overrides };
  };

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

  const runSearch = async (paramsOverride?: Partial<SearchParams>) => {
    const requestId = searchRequestIdRef.current + 1;
    searchRequestIdRef.current = requestId;
    searchStartedAtRef.current = Date.now();
    setLoading(true);
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
    try {
      const spaces = await searchListings(params);
      setResults(spaces);
      setSelectedId((prev) => {
        if (prev && spaces.some((listing) => listing.id === prev)) return prev;
        return null;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Search failed";
      logError("Search error", { message });
      setError(message);
      setResults([]);
    } finally {
      const elapsed = Date.now() - searchStartedAtRef.current;
      const remaining = Math.max(0, 1000 - elapsed);
      setTimeout(() => {
        if (searchRequestIdRef.current === requestId) {
          setLoading(false);
        }
      }, remaining);
    }
  };

  const handleMapReady = () => {
    setMapReady(true);
  };

  useEffect(() => {
    setFrom(startAt.toISOString());
    setTo(endAt.toISOString());
  }, [startAt, endAt]);

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
      void runSearch({ from: next.toISOString(), to: nextEnd.toISOString() });
    } else {
      setEndAt(next);
      void runSearch({ from: startAt.toISOString(), to: next.toISOString() });
    }
  };

  const openPicker = (field: "start" | "end") => {
    setPickerField(field);
    const current = field === "start" ? startAt : endAt;
    setDraftDate(current);
    setPickerVisible(true);
  };

  const applyQuickDuration = (hours: number) => {
    const nextEnd = new Date(startAt);
    nextEnd.setHours(nextEnd.getHours() + hours);
    setEndAt(nextEnd);
    setDraftDate(nextEnd);
    void runSearch({ from: startAt.toISOString(), to: nextEnd.toISOString() });
  };


  const fetchAutocomplete = async (query: string) => {
    if (!mapsKey) return;
    setAddressLoading(true);
    try {
      const params = new URLSearchParams({
        input: query,
        key: mapsKey,
        components: "country:ie",
      });
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`
      );
      const payload = (await response.json()) as { predictions?: PlaceSuggestion[] };
      setAddressSuggestions(payload.predictions ?? []);
    } catch {
      setAddressSuggestions([]);
    } finally {
      setAddressLoading(false);
    }
  };

  const handleSelectSuggestion = async (suggestion: PlaceSuggestion) => {
    setAddressQuery(suggestion.description);
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
        setAddressQuery(payload.result.formatted_address);
      }
      const location = payload.result?.geometry?.location;
      if (location) {
        const nextLat = location.lat.toFixed(6);
        const nextLng = location.lng.toFixed(6);
        const label = payload.result?.formatted_address ?? suggestion.description;
        addToHistory({
          label,
          lat: nextLat,
          lng: nextLng,
          timestamp: Date.now(),
        });
        setLat(nextLat);
        setLng(nextLng);
        lastSearchCenterRef.current = { lat: location.lat, lng: location.lng };
        setSelectedId(null);
        mapRef.current?.animateToRegion(
          {
            latitude: location.lat,
            longitude: location.lng,
            latitudeDelta: 0.012,
            longitudeDelta: 0.012,
          },
          280
        );
        void runSearch({ lat: nextLat, lng: nextLng });
      }
    } catch {
      // Ignore lookup errors.
    }
  };

  const handleUseCurrentLocation = async () => {
    setLocationError(null);
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationError("Location permission needed.");
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const nextLat = position.coords.latitude.toFixed(6);
      const nextLng = position.coords.longitude.toFixed(6);
      setLat(nextLat);
      setLng(nextLng);
      setAddressQuery("Current location");
      setAddressSuggestions([]);
      skipAutocompleteRef.current = 2;
      lastSearchCenterRef.current = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      setSelectedId(null);
      mapRef.current?.animateToRegion(
        {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        },
        280
      );
      setSearchSheetOpen(false);
      void runSearch({ lat: nextLat, lng: nextLng });
    } catch {
      setLocationError("Unable to fetch location.");
    } finally {
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
    lastSearchCenterRef.current = {
      lat: Number.parseFloat(nextLat),
      lng: Number.parseFloat(nextLng),
    };
    setSelectedId(null);
    mapRef.current?.animateToRegion(
      {
        latitude: Number.parseFloat(nextLat),
        longitude: Number.parseFloat(nextLng),
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      },
      280
    );
    setSearchSheetOpen(false);
    void runSearch({ lat: nextLat, lng: nextLng });
  };

  const selectedListing = selectedId
    ? results.find((listing) => listing.id === selectedId) ?? null
    : null;

  const selectedListingImage =
    selectedListing?.image_urls?.[0] ??
    selectedListing?.imageUrls?.[0] ??
    (selectedListing?.latitude &&
    selectedListing?.longitude &&
    mapsKey
      ? `https://maps.googleapis.com/maps/api/streetview?size=240x240&location=${selectedListing.latitude},${selectedListing.longitude}&key=${mapsKey}`
      : null);

  const handleSelectListing = (id: string) => {
    ignoreNextRegionChangeRef.current = true;
    setSelectedId(id);
  };

  useFocusEffect(
    useCallback(() => {
      setSelectedId(null);
      setSearchSheetOpen(false);
    }, [])
  );

  useEffect(() => {
    if (showFilters) {
      setFiltersVisible(true);
      slideAnim.setValue(windowHeight);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }).start();
    } else if (filtersVisible) {
      Animated.timing(slideAnim, {
        toValue: windowHeight,
        duration: 220,
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
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else if (searchSheetVisible) {
      Animated.timing(searchAnim, {
        toValue: 40,
        duration: 200,
        easing: Easing.in(Easing.cubic),
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

  const handleRegionChange = (nextRegion: typeof mapRegion) => {
    if (ignoreNextRegionChangeRef.current) {
      ignoreNextRegionChangeRef.current = false;
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
    if (distanceM < 350) return;

    const nextLat = nextRegion.latitude.toFixed(6);
    const nextLng = nextRegion.longitude.toFixed(6);
    const maxDelta = Math.max(nextRegion.latitudeDelta, nextRegion.longitudeDelta);
    const radiusKmValue = Math.max(0.5, (maxDelta * 111) / 2) * 1.2;
    const nextRadius = radiusKmValue.toFixed(2);
    setPendingSearch({ lat: nextLat, lng: nextLng, radiusKm: nextRadius });
    setShowSearchArea(true);
  };

  const clearFilters = () => {
    setPriceMin("");
    setPriceMax("");
    setSecurityLevel("");
    setVehicleSize("");
    setCoveredParking(false);
    setEvCharging(false);
    setInstantBook(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <View style={styles.mapShell}>
        {launchComplete ? (
          <MapSection
            initialRegion={mapRegion}
            results={results}
            style={styles.map}
            mapPadding={{ bottom: 180 + insets.bottom + 16 }}
            provider={Platform.OS === "android" ? "google" : undefined}
            customMapStyle={LIGHT_MAP_STYLE}
            onSelect={handleSelectListing}
            onRegionChangeComplete={handleRegionChange}
            selectedId={selectedId}
            mapRef={mapRef}
            freezeMarkers={loading}
            onMapLoaded={handleMapReady}
            onMapReady={handleMapReady}
          />
        ) : (
          <View style={styles.mapPlaceholder} />
        )}
        {launchComplete && !mapReady ? (
          <View style={styles.mapLoadingOverlay} pointerEvents="none">
            <View style={styles.mapLoadingBubble}>
              <LottieView
                source={require("../assets/Insider-loading.json")}
                autoPlay
                loop
                style={styles.mapLoadingLottie}
              />
              <Text style={styles.mapLoadingText}>Loading map…</Text>
            </View>
          </View>
        ) : null}
        <View style={[styles.overlay, { top: insets.top + 10 }]}>
          <View style={styles.overlayHeader}>
            <Text style={styles.overlayTitle}>Find parking</Text>
            <Pressable
              style={styles.profileButton}
              onPress={() => navigation.navigate(user ? "Profile" : "SignIn")}
            >
              <Text style={styles.profileButtonText}>
                {user?.email?.charAt(0)?.toUpperCase() ?? "P"}
              </Text>
            </Pressable>
          </View>
          <View style={styles.searchGroup}>
            <Pressable style={styles.searchBar} onPress={() => setSearchSheetOpen(true)}>
              <TextInput
                style={styles.searchInput}
                value={addressQuery}
                editable={false}
                placeholder="Where to?"
                placeholderTextColor="#98a2b3"
                pointerEvents="none"
              />
              {addressQuery ? (
                <Pressable
                  style={styles.clearButton}
                  onPress={() => {
                    setAddressQuery("");
                    setAddressSuggestions([]);
                  }}
                >
                  <Text style={styles.clearButtonText}>×</Text>
                </Pressable>
              ) : null}
            </Pressable>
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
          {showSearchArea && pendingSearch ? (
            <View style={styles.searchAreaWrap} pointerEvents="box-none">
              <Pressable
                style={styles.searchAreaButton}
                onPress={() => {
                setLat(pendingSearch.lat);
                setLng(pendingSearch.lng);
                setRadiusKm(pendingSearch.radiusKm);
                setShowSearchArea(false);
                setPendingSearch(null);
                void runSearch({
                  lat: pendingSearch.lat,
                  lng: pendingSearch.lng,
                  radiusKm: pendingSearch.radiusKm,
                });
              }}
            >
                <Text style={styles.searchAreaText}>Search this area</Text>
              </Pressable>
            </View>
          ) : null}
          {loading ? (
            <View style={styles.searchLoadingBubble}>
              <LottieView
                source={require("../assets/Insider-loading.json")}
                autoPlay
                loop
                style={styles.searchLoadingLottie}
              />
              <Text style={styles.searchLoadingText}>Searching for spaces…</Text>
            </View>
          ) : null}
          <View style={styles.filtersHeader}>
            <Pressable
              style={[styles.filtersToggle, showFilters && styles.filtersToggleActive]}
              onPress={() => setShowFilters((prev) => !prev)}
            >
              <Text
                style={[styles.filtersToggleText, showFilters && styles.filtersToggleTextActive]}
              >
                Filters
              </Text>
            </Pressable>
            {(priceMin || priceMax || securityLevel || vehicleSize || coveredParking || evCharging || instantBook) ? (
              <Pressable style={styles.clearFilters} onPress={clearFilters}>
                <Text style={styles.clearFiltersText}>Clear</Text>
              </Pressable>
            ) : null}
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
        {selectedListing ? (
          <MapBottomCard
            title={selectedListing.title}
            imageUrl={selectedListingImage ?? undefined}
            rating={selectedListing.rating ?? 0}
            reviewCount={selectedListing.rating_count ?? 0}
            walkTime="14 min"
            price={`€${selectedListing.price_per_day}`}
            isFavorite={isFavorite(selectedListing.id)}
            onToggleFavorite={() => toggle(selectedListing)}
            onPress={() => navigation.navigate("Listing", { id: selectedListing.id, from, to })}
            bottomOffset={insets.bottom + 16}
            horizontalInset={16}
            onReserve={() => navigation.navigate("Listing", { id: selectedListing.id, from, to })}
          />
        ) : null}
        {filtersVisible ? (
          <View style={styles.filtersOverlay}>
            <Pressable style={styles.filtersBackdrop} onPress={closeFilters} />
            <Animated.View
              style={[styles.filtersPanel, { transform: [{ translateY: slideAnim }] }]}
            >
              <View style={styles.filtersHeaderRow}>
                <Text style={styles.filtersTitle}>Filters</Text>
                <Pressable style={styles.filtersClose} onPress={closeFilters}>
                  <Text style={styles.filtersCloseText}>Close</Text>
                </Pressable>
              </View>
              <Text style={styles.filtersSubtitle}>Refine results</Text>
              <View style={styles.filtersSection}>
                <Text style={styles.sectionLabel}>Price</Text>
                <View style={styles.row}>
                  <View style={styles.field}>
                    <Text style={styles.label}>Min € / day</Text>
                    <TextInput
                      style={styles.input}
                      value={priceMin}
                      onChangeText={setPriceMin}
                      keyboardType="numeric"
                      placeholder="10"
                      placeholderTextColor="#98a2b3"
                    />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.label}>Max € / day</Text>
                    <TextInput
                      style={styles.input}
                      value={priceMax}
                      onChangeText={setPriceMax}
                      keyboardType="numeric"
                      placeholder="40"
                      placeholderTextColor="#98a2b3"
                    />
                  </View>
                </View>
              </View>
              <View style={styles.filtersSection}>
                <Text style={styles.sectionLabel}>Vehicle size</Text>
                <View style={styles.chipRow}>
                  {(["motorcycle", "car", "van"] as const).map((size) => (
                    <Pressable
                      key={size}
                      style={[styles.chip, vehicleSize === size && styles.chipActive]}
                      onPress={() => setVehicleSize(vehicleSize === size ? "" : size)}
                    >
                      <Text style={[styles.chipText, vehicleSize === size && styles.chipTextActive]}>
                        {size}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={styles.filtersSection}>
                <Text style={styles.sectionLabel}>Security level</Text>
                <View style={styles.chipRow}>
                  {(["basic", "gated", "cctv"] as const).map((level) => (
                    <Pressable
                      key={level}
                      style={[styles.chip, securityLevel === level && styles.chipActive]}
                      onPress={() => setSecurityLevel(securityLevel === level ? "" : level)}
                    >
                      <Text
                        style={[styles.chipText, securityLevel === level && styles.chipTextActive]}
                      >
                        {level}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={styles.filtersSection}>
                <Text style={styles.sectionLabel}>Preferences</Text>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Instant book only</Text>
                  <Switch value={instantBook} onValueChange={setInstantBook} />
                </View>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Covered parking</Text>
                  <Switch value={coveredParking} onValueChange={setCoveredParking} />
                </View>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>EV charging</Text>
                  <Switch value={evCharging} onValueChange={setEvCharging} />
                </View>
              </View>
              <Pressable
                style={styles.applyButton}
                onPress={() => {
                  closeFilters();
                  void runSearch();
                }}
              >
                <Text style={styles.applyButtonText}>Apply filters</Text>
              </Pressable>
            </Animated.View>
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
              <View style={[styles.searchHeader, { paddingTop: insets.top + 12 }]}>
                <Pressable
                  style={styles.headerIconButton}
                  onPress={() => setSearchSheetOpen(false)}
                >
                  <Text style={styles.headerIconText}>{"<"}</Text>
                </Pressable>
                <Text style={styles.searchHeaderTitle}>Search</Text>
                <Pressable style={styles.headerIconButton} onPress={() => setShowFilters(true)}>
                  <Text style={styles.headerIconText}>Filter</Text>
                </Pressable>
              </View>
              <View style={styles.searchHeaderInput}>
                <View style={styles.searchOverlayInputShell}>
                  <TextInput
                    style={styles.searchOverlayInput}
                    value={addressQuery}
                    autoFocus
                    onChangeText={(value) => {
                      setAddressQuery(value);
                      if (!value.trim()) {
                        setAddressSuggestions([]);
                      }
                    }}
                    placeholder="Enter destination or location ID"
                    placeholderTextColor="#9aa1aa"
                    returnKeyType="search"
                  />
                  {addressQuery ? (
                    <Pressable
                      style={styles.overlayClearButton}
                      onPress={() => {
                        setAddressQuery("");
                        setAddressSuggestions([]);
                      }}
                    >
                      <Text style={styles.overlayClearButtonText}>×</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
              <View style={styles.searchContent}>
                <View style={styles.tabRow}>
                  <Pressable
                    style={[
                      styles.tabButton,
                      activeSearchTab === "recents" && styles.tabButtonActive,
                    ]}
                    onPress={() => setActiveSearchTab("recents")}
                  >
                    <Text
                      style={[
                        styles.tabText,
                        activeSearchTab === "recents" && styles.tabTextActive,
                      ]}
                    >
                      Recents
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.tabButton,
                      activeSearchTab === "favourites" && styles.tabButtonActive,
                    ]}
                    onPress={() => setActiveSearchTab("favourites")}
                  >
                    <Text
                      style={[
                        styles.tabText,
                        activeSearchTab === "favourites" && styles.tabTextActive,
                      ]}
                    >
                      Favourites
                    </Text>
                  </Pressable>
                </View>
                <View style={styles.searchResults}>
                  {addressQuery.trim() ? (
                    addressLoading ? (
                      <Text style={styles.emptyText}>Searching...</Text>
                    ) : addressSuggestions.length > 0 ? (
                      addressSuggestions.slice(0, 6).map((suggestion) => (
                        <Pressable
                          key={suggestion.place_id}
                          style={styles.resultRow}
                          onPress={() => {
                            setSearchSheetOpen(false);
                            void handleSelectSuggestion(suggestion);
                          }}
                        >
                          <View style={styles.resultIcon}>
                            <View style={styles.resultIconDot} />
                          </View>
                          <View style={styles.resultCopy}>
                            <Text style={styles.resultTitle}>{suggestion.description}</Text>
                            <Text style={styles.resultSubtitle}>Suggested location</Text>
                          </View>
                        </Pressable>
                      ))
                    ) : (
                      <Text style={styles.emptyText}>No results found.</Text>
                    )
                  ) : (
                    <>
                      <Pressable
                        style={[styles.resultRow, styles.currentLocationRow]}
                        onPress={handleUseCurrentLocation}
                        disabled={locating}
                      >
                        <View style={styles.resultIcon}>
                          <View style={styles.resultIconDot} />
                        </View>
                        <View style={styles.resultCopy}>
                          <Text style={styles.resultTitle}>
                            {locating ? "Finding your location..." : "Use current location"}
                          </Text>
                          {locationError ? (
                            <Text style={styles.resultSubtitle}>{locationError}</Text>
                          ) : (
                            <Text style={styles.resultSubtitle}>Use GPS to center the map</Text>
                          )}
                        </View>
                      </Pressable>
                      {activeSearchTab === "recents" ? (
                        <View style={styles.resultsGroup}>
                          <Text style={styles.sectionLabel}>RECENT SEARCHES</Text>
                          {searchHistory.length ? (
                            searchHistory.map((item) => (
                              <View key={`${item.label}-${item.lat}-${item.lng}`} style={styles.resultRow}>
                                <Pressable
                                  style={styles.resultRowPress}
                                  onPress={() => handleSelectHistoryItem(item)}
                                >
                                  <View style={styles.resultIcon}>
                                    <View style={styles.resultIconDot} />
                                  </View>
                                  <View style={styles.resultCopy}>
                                    <Text style={styles.resultTitle}>{item.label}</Text>
                                    <Text style={styles.resultSubtitle}>Recent search</Text>
                                  </View>
                                </Pressable>
                                <Pressable
                                  style={styles.resultRemove}
                                  onPress={() => removeFromHistory(item)}
                                >
                                  <Text style={styles.resultRemoveText}>×</Text>
                                </Pressable>
                              </View>
                            ))
                          ) : (
                            <Text style={styles.emptyText}>No recent searches yet.</Text>
                          )}
                        </View>
                      ) : (
                        <View style={styles.resultsGroup}>
                          <Text style={styles.sectionLabel}>FAVOURITES</Text>
                          {favorites.length ? (
                            favorites.map((item) => (
                              <Pressable
                                key={`fav-${item.id}`}
                                style={styles.resultRow}
                                onPress={() =>
                                  navigation.navigate("Listing", { id: item.id, from, to })
                                }
                              >
                                <View style={styles.resultIcon}>
                                  <View style={styles.resultIconDot} />
                                </View>
                                <View style={styles.resultCopy}>
                                  <Text style={styles.resultTitle}>{item.title}</Text>
                                  <Text style={styles.resultSubtitle}>{item.address}</Text>
                                </View>
                              </Pressable>
                            ))
                          ) : (
                            <Text style={styles.emptyText}>No favourites yet.</Text>
                          )}
                        </View>
                      )}
                    </>
                  )}
                </View>
              </View>
            </Animated.View>
          </KeyboardAvoidingView>
        ) : null}
        {Platform.OS !== "web" ? (
          Platform.OS === "android" && pickerVisible ? (
            <Modal transparent animationType="fade" visible>
              <View style={styles.pickerBackdrop}>
                <View style={styles.pickerSheet}>
                  <View style={styles.pickerHeader}>
                    <Pressable
                      style={styles.pickerCancel}
                      onPress={() => {
                        setPickerVisible(false);
                        setDraftDate(null);
                      }}
                    >
                      <Text style={styles.pickerCancelText}>Cancel</Text>
                    </Pressable>
                    <Text style={styles.pickerTitle}>
                      {pickerField === "start" ? "Start" : "End"}
                    </Text>
                    <Pressable
                      style={styles.pickerDone}
                      onPress={() => {
                        const next = draftDate ?? (pickerField === "start" ? startAt : endAt);
                        if (pickerField === "start") {
                          applyPickedDate(next);
                          const suggestedEnd = new Date(next);
                          suggestedEnd.setHours(suggestedEnd.getHours() + 2);
                          setPickerField("end");
                          setDraftDate(suggestedEnd);
                          return;
                        }
                        applyPickedDate(next);
                        setPickerVisible(false);
                        setDraftDate(null);
                      }}
                    >
                      <Text style={styles.pickerDoneText}>
                        {pickerField === "start" ? "Next" : "Done"}
                      </Text>
                    </Pressable>
                  </View>
                  <DatePicker
                    date={draftDate ?? (pickerField === "start" ? startAt : endAt)}
                    mode="datetime"
                    androidVariant="iosClone"
                    minuteInterval={1}
                    textColor="#101828"
                    onDateChange={(date) => setDraftDate(date)}
                  />
                  {pickerField === "end" ? (
                    <View style={styles.durationRow}>
                      {[2, 4, 6].map((hours) => (
                        <Pressable
                          key={hours}
                          style={styles.durationPill}
                          onPress={() => applyQuickDuration(hours)}
                        >
                          <Text style={styles.durationText}>{hours} hours</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
              </View>
            </Modal>
          ) : (
            <DatePicker
              modal
              open={pickerVisible}
              date={draftDate ?? (pickerField === "start" ? startAt : endAt)}
              mode="datetime"
              androidVariant="iosClone"
              minuteInterval={1}
              textColor="#101828"
              onConfirm={(date) => {
                setPickerVisible(false);
                setDraftDate(date);
                applyPickedDate(date);
              }}
              onCancel={() => {
                setPickerVisible(false);
                setDraftDate(null);
              }}
            />
          )
        ) : null}
      </View>
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
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#f8fafc",
  },
  mapLoadingOverlay: {
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  mapLoadingBubble: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.88)",
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  mapLoadingLottie: {
    height: 84,
    width: 84,
  },
  mapLoadingText: {
    color: "#475467",
    fontSize: 12,
    fontWeight: "600",
    marginTop: -8,
  },
  overlay: {
    left: 16,
    position: "absolute",
    right: 16,
    top: 10,
  },
  overlayHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  overlayTitle: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "800",
  },
  profileButton: {
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderRadius: 999,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  profileButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  searchGroup: {
    backgroundColor: "#ffffff",
    borderColor: "#e4e7ec",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    shadowColor: "#101828",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
  },
  searchBar: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  searchInput: {
    color: "#101828",
    flex: 1,
    fontSize: 14,
  },
  clearButton: {
    alignItems: "center",
    backgroundColor: "#f2f4f7",
    borderRadius: 999,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  clearButtonText: {
    color: "#667085",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 18,
  },
  searchOverlayTrigger: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  searchLoadingBubble: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "rgba(255, 255, 255, 0.82)",
    borderRadius: 14,
    height: 34,
    justifyContent: "center",
    overflow: "visible",
    position: "absolute",
    top: 176,
    paddingLeft: 52,
    paddingRight: 12,
  },
  searchLoadingLottie: {
    left: -10,
    position: "absolute",
    top: -26,
    height: 86,
    width: 86,
  },
  searchLoadingText: {
    color: "#475467",
    fontSize: 12,
    fontWeight: "600",
  },
  filtersHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  filtersToggle: {
    backgroundColor: "#f2f4f7",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  filtersToggleActive: {
    backgroundColor: "#e0edff",
  },
  filtersToggleText: {
    color: "#344054",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  filtersToggleTextActive: {
    color: "#175cd3",
  },
  clearFilters: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  clearFiltersText: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "600",
  },
  filtersPanel: {
    backgroundColor: "#ffffff",
    padding: 20,
    paddingTop: 24,
    height: "100%",
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
  filtersHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  filtersClose: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  filtersCloseText: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "600",
  },
  filtersTitle: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "700",
  },
  filtersSubtitle: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 16,
  },
  filtersSection: {
    backgroundColor: "#f8fafc",
    borderColor: "#e5e7eb",
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  row: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  field: {
    flex: 1,
  },
  label: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    borderColor: "#e5e7eb",
    borderRadius: 12,
    borderWidth: 1,
    color: "#111827",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    backgroundColor: "#f8fafc",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: "#10b981",
  },
  chipText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  chipTextActive: {
    color: "#ffffff",
  },
  switchRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  switchLabel: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "600",
  },
  applyButton: {
    alignItems: "center",
    backgroundColor: "#10b981",
    borderRadius: 12,
    minHeight: 44,
    paddingVertical: 10,
  },
  applyButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  suggestions: {
    backgroundColor: "#ffffff",
    borderColor: "#eaecf0",
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
    overflow: "hidden",
  },
  searchOverlay: {
    backgroundColor: "#ffffff",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 40,
  },
  searchPanel: {
    flex: 1,
  },
  searchHeader: {
    alignItems: "center",
    backgroundColor: "#00d4aa",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchHeaderTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  headerIconButton: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 44,
    paddingVertical: 6,
  },
  headerIconText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  searchHeaderInput: {
    backgroundColor: "#00d4aa",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  searchOverlayInputShell: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchOverlayInput: {
    color: "#101828",
    fontSize: 14,
    flex: 1,
  },
  overlayClearButton: {
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 999,
    height: 26,
    justifyContent: "center",
    width: 26,
  },
  overlayClearButtonText: {
    color: "#475467",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 20,
  },
  searchContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  tabRow: {
    flexDirection: "row",
    borderColor: "#e5e7eb",
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  tabButtonActive: {
    backgroundColor: "#0f172a",
  },
  tabText: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#ffffff",
  },
  searchResults: {
    marginTop: 16,
  },
  resultsGroup: {
    marginTop: 12,
  },
  resultRow: {
    backgroundColor: "#ffffff",
    borderBottomColor: "#e5e7eb",
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    width: "100%",
  },
  currentLocationRow: {
    backgroundColor: "#f8fafc",
    borderColor: "#e5e7eb",
  },
  resultRowPress: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  resultIcon: {
    alignItems: "center",
    backgroundColor: "#e6f9f5",
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  resultIconDot: {
    backgroundColor: "#00d4aa",
    borderRadius: 6,
    height: 12,
    width: 12,
  },
  resultCopy: {
    flex: 1,
  },
  resultTitle: {
    color: "#1a1f2e",
    fontSize: 16,
    fontWeight: "600",
  },
  resultSubtitle: {
    color: "#6b7280",
    fontSize: 14,
    marginTop: 2,
  },
  resultRemove: {
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 14,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  resultRemoveText: {
    color: "#6b7280",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 18,
  },
  sectionLabel: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  emptyText: {
    color: "#6b7280",
    fontSize: 13,
  },
  dateRow: {
    borderTopColor: "#eef2f7",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    alignItems: "center",
  },
  dateTimePill: {
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flex: 1,
  },
  dateTimeText: {
    color: "#101828",
    fontSize: 12,
    fontWeight: "600",
  },
  dateArrow: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    width: 16,
  },
  dateArrowText: {
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: "700",
  },
  searchAreaButton: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 14,
    height: 34,
    marginTop: 10,
    paddingHorizontal: 14,
    justifyContent: "center",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  searchAreaWrap: {
    alignItems: "center",
    marginTop: 10,
  },
  searchAreaText: {
    color: "#475467",
    fontSize: 13,
    fontWeight: "700",
  },
  durationRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  durationPill: {
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  durationText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "700",
  },
  pickerBackdrop: {
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    bottom: 0,
    justifyContent: "flex-end",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  pickerSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginBottom: 48,
    paddingBottom: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    marginHorizontal: 16,
  },
  pickerHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  pickerCancel: {
    backgroundColor: "#f2f4f7",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pickerCancelText: {
    color: "#475467",
    fontSize: 12,
    fontWeight: "700",
  },
  pickerTitle: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "800",
  },
  pickerDone: {
    backgroundColor: "#0f172a",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pickerDoneText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  suggestionItem: {
    borderBottomColor: "#f2f4f7",
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  suggestionText: {
    color: "#101828",
    fontSize: 14,
  },
  suggestionMuted: {
    color: "#98a2b3",
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  error: {
    color: "#b42318",
    marginTop: 8,
  },
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#eaecf0",
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 12,
    padding: 16,
  },
});
