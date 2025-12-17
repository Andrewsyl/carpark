import "../loadEnv.js";

// Placeholder server-side geocoder. Swap with Google Geocoding API, Nominatim, or Mapbox.
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    console.warn("GOOGLE_MAPS_API_KEY missing; geocoding will return null");
    return null;
  }

  try {
    const params = new URLSearchParams({ address, key });
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`);
    const data = (await res.json()) as any;
    if (data.status === "OK" && data.results?.[0]?.geometry?.location) {
      const loc = data.results[0].geometry.location;
      return { lat: loc.lat, lng: loc.lng };
    }
    console.warn("Geocode failed", data.status, data.error_message);
    return null;
  } catch (err) {
    console.error("Geocode error", err);
    return null;
  }
}
