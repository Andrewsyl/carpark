import type { NavigatorScreenParams } from "@react-navigation/native";

export type RootStackParamList = {
  Tabs:
    | {
        screen?: "Search" | "History" | "Favorites" | "Profile";
        params?: Record<string, unknown>;
      }
    | undefined;
  Search: { hideTabBar?: boolean } | undefined;
  Listing: {
    id: string;
    from: string;
    to: string;
    // Set to "monthly" when opened from the monthly search lane so the detail
    // page shows the monthly (start-date + plan) view even for listings that
    // also carry an hourly rate ("both"), not just monthly-only ones.
    mode?: "daily" | "monthly";
    booking?: import("./api").BookingSummary;
  };
  ListingReviews: {
    id: string;
    rating?: number | null;
    ratingCount?: number | null;
  };
  BookingSummary: {
    id: string;
    from: string;
    to: string;
    // "monthly" = a one-off single-month booking priced off the host's monthly
    // rate (from → from+1 month). Absent/"daily" = the hourly/daily flow.
    mode?: "daily" | "monthly";
  };
  VehicleType:
    | {
        returnTo?: "BookingSummary";
        focusField?: "plate";
      }
    | undefined;
  // The four login screens live in their own stack (AuthStackParamList),
  // presented as a single modal card overlay. Open with
  // navigation.navigate("Auth", { screen: "SignIn", params: { returnTo } }).
  Auth: NavigatorScreenParams<AuthStackParamList> | undefined;
  Profile: { hideTabBar?: boolean } | undefined;
  PersonalInfo:
    | {
        focusField?: "phone";
        notice?: string;
      }
    | undefined;
  LoginSecurity: undefined;
  Legal: undefined;
  History: { showSuccess?: boolean; refreshToken?: number; showMapCTA?: boolean; initialTab?: "upcoming" | "active" | "past" } | undefined;
  // initialTab lets flows land on a specific segment — publish opens Spaces so
  // the host sees the listing they just created.
  Listings: { initialTab?: "bookings" | "spaces" } | undefined;
  Payments: undefined;
  Favorites: {} | undefined;
  Support:
    | {
        prefillSubject?: string;
        prefillMessage?: string;
      }
    | undefined;
  Admin: undefined;
  BookingDetail: {
    booking: import("./api").BookingSummary;
    // Set by the "Extend +" notification action / "ending soon" reminder so the
    // extend picker opens automatically on arrival.
    autoExtend?: boolean;
  };
  HostBookingDetail: {
    booking: import("./api").BookingSummary;
  };
  Review: {
    booking: import("./api").BookingSummary;
    initialRating?: number;
  };
  CreateListingFlow: {
    listingId?: string;
  } | undefined;
  EditListing: {
    id: string;
  };
};

// The login flow — presented as one modal card (the "Auth" root route). Screens
// push horizontally within the card; back/reset targets the root navigator.
export type AuthStackParamList = {
  Welcome: { returnTo?: AuthReturnTo } | undefined;
  SignIn: { returnTo?: AuthReturnTo } | undefined;
  Register: { returnTo?: AuthReturnTo } | undefined;
  ResetPassword:
    | {
        token?: string;
        apiBase?: string;
      }
    | undefined;
};

export type AuthReturnTo =
  | { screen: "Listing"; params: { id: string; from: string; to: string } }
  | { screen: "BookingSummary"; params: { id: string; from: string; to: string; mode?: "daily" | "monthly" } }
  | {
      screen: "Support";
      params?: {
        prefillSubject?: string;
        prefillMessage?: string;
      };
    };

export type ListingSummary = {
  id: string;
  title: string;
  address: string;
  price_per_day: number;
  price_per_hour?: number | null;
  price_per_month?: number | null;
  rate_type?: "hourly" | "daily" | null;
  is_available?: boolean | null;
  rating?: number | null;
  rating_count?: number | null;
  availability_text?: string | null;
  amenities?: string[] | null;
  access_code?: string | null;
  accessCode?: string | null;
  arrival_instructions?: string | null;
  arrivalInstructions?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distance_m?: number | null;
  is_active?: boolean | null;
  image_urls?: string[] | null;
  imageUrls?: string[] | null;
  capacity?: number | null;
  vehicle_size_suitability?: string | null;
  vehicleSizeSuitability?: string | null;
};

export type ListingDetail = ListingSummary & {
  image_urls?: string[] | null;
  amenities?: string[] | null;
  access_code?: string | null;
  accessCode?: string | null;
  arrival_instructions?: string | null;
  arrivalInstructions?: string | null;
  is_available?: boolean | null;
  permission_declared?: boolean | null;
  permissionDeclared?: boolean | null;
  description?: string | null;
  access_directions?: string | null;
  accessDirections?: string | null;
  hostId?: string | null;
  hostName?: string | null;
  hostVerified?: boolean | null;
  hostSince?: string | null;
  spacesRemaining?: number | null;
  availabilitySchedule?: {
    id: string;
    kind: "open" | "blocked";
    startsAt: string;
    endsAt: string;
    repeatWeekdays?: number[] | null;
    repeatUntil?: string | null;
    createdAt: string;
  }[];
};

export type SecurityLevel = "basic" | "gated" | "cctv";
export type VehicleSize = "motorcycle" | "car" | "van";

export type SearchParams = {
  lat: string;
  lng: string;
  radiusKm: string;
  from: string;
  to: string;
  // "daily" = the hourly/daily short-term booking search (default). "monthly"
  // filters to listings that carry a monthly price and price-filters on it —
  // matches the API's search `mode` param.
  mode?: "daily" | "monthly";
  includeUnavailable?: boolean;
  spaceType?: string;
  priceMin?: string;
  priceMax?: string;
  coveredParking?: boolean;
  evCharging?: boolean;
  securityLevel?: SecurityLevel;
  vehicleSize?: VehicleSize;
  instantBook?: boolean;
};
