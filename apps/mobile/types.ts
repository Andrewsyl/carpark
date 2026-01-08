export type RootStackParamList = {
  Search: undefined;
  Listing: {
    id: string;
    from: string;
    to: string;
  };
  BookingSummary: {
    id: string;
    from: string;
    to: string;
  };
  SignIn: undefined;
  Profile: undefined;
  History: { showSuccess?: boolean } | undefined;
  Settings: undefined;
  Listings: undefined;
  Payments: undefined;
  Favorites: undefined;
  BookingDetail: {
    booking: import("./api").BookingSummary;
  };
  Review: {
    booking: import("./api").BookingSummary;
  };
  CreateListingFlow: {
    listingId?: string;
  } | undefined;
  EditListing: {
    id: string;
  };
};

export type ListingSummary = {
  id: string;
  title: string;
  address: string;
  price_per_day: number;
  rating?: number | null;
  rating_count?: number | null;
  availability_text?: string | null;
  amenities?: string[] | null;
  latitude?: number | null;
  longitude?: number | null;
  distance_m?: number | null;
  image_urls?: string[] | null;
  imageUrls?: string[] | null;
};

export type ListingDetail = ListingSummary & {
  image_urls?: string[] | null;
  amenities?: string[] | null;
};

export type SecurityLevel = "basic" | "gated" | "cctv";
export type VehicleSize = "motorcycle" | "car" | "van";

export type SearchParams = {
  lat: string;
  lng: string;
  radiusKm: string;
  from: string;
  to: string;
  priceMin?: string;
  priceMax?: string;
  coveredParking?: boolean;
  evCharging?: boolean;
  securityLevel?: SecurityLevel;
  vehicleSize?: VehicleSize;
  instantBook?: boolean;
};
