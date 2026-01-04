import { StyleSheet, Text, View } from "react-native";

type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

type ListingResult = {
  id: string;
  title: string;
  address: string;
  price_per_day: number;
  latitude?: number | null;
  longitude?: number | null;
};

export default function MapSection({
  style,
}: {
  region?: MapRegion;
  initialRegion: MapRegion;
  results: ListingResult[];
  style?: object;
  onSelect?: (id: string) => void;
  onRegionChangeComplete?: (nextRegion: MapRegion) => void;
  selectedId?: string | null;
  provider?: "google" | "default";
  mapPadding?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  mapRef?: unknown;
  freezeMarkers?: boolean;
}) {
  return (
    <View style={[styles.fallback, style]}>
      <Text style={styles.fallbackText}>Map preview is available on device.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: "center",
    backgroundColor: "#f2f4f7",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  fallbackText: {
    color: "#667085",
    fontSize: 13,
    textAlign: "center",
  },
});
