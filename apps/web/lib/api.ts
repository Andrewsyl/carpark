import type { Listing } from "../components/ListingCard";
import type { SearchFilters } from "../components/SearchForm";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";

async function handleResponse<T>(res: Response): Promise<{ data: T | null; error: string | null }> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = body.message ?? res.statusText;
    return { data: null, error: message };
  }
  return { data: body as T, error: null };
}

export async function searchSpaces(filters: SearchFilters): Promise<Listing[]> {
  const params = new URLSearchParams({
    lat: String(filters.latitude ?? 53.3498),
    lng: String(filters.longitude ?? -6.2603),
    radiusKm: String(filters.radiusKm),
    from: `${filters.date}T${filters.startTime}:00Z`,
    to: `${(filters.endDate ?? filters.date)}T${filters.endTime}:00Z`,
  });

  if (filters.priceMin !== undefined) params.set("priceMin", String(filters.priceMin));
  if (filters.priceMax !== undefined) params.set("priceMax", String(filters.priceMax));
  if (filters.coveredParking) params.set("coveredParking", "true");
  if (filters.evCharging) params.set("evCharging", "true");
  if (filters.securityLevel) params.set("securityLevel", filters.securityLevel);
  if (filters.vehicleSize) params.set("vehicleSize", filters.vehicleSize);
  if (filters.instantBook) params.set("instantBook", "true");

  const res = await fetch(`${API_BASE}/api/listings/search?${params.toString()}`, {
    cache: "no-store",
  });
  const { data, error } = await handleResponse<{ spaces: Listing[] }>(res);
  if (error) {
    throw new Error(error);
  }
  return data?.spaces?.map((space) => ({
    ...space,
    rating: space.rating ?? 0,
    ratingCount: (space as any).ratingCount ?? (space as any).rating_count ?? 0,
  })) ?? [];
}

function authHeaders(token?: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export type CreateListingInput = {
  title: string;
  address: string;
  pricePerDay: number;
  availabilityText: string;
  latitude: number;
  longitude: number;
  amenities?: string[];
  imageUrls?: string[];
};

export async function createListing(input: CreateListingInput, token?: string) {
  if (!token) throw new Error("Authentication required");
  const res = await fetch(`${API_BASE}/api/listings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(input),
  });
  const { data, error } = await handleResponse<{ id: string }>(res);
  if (error) {
    throw new Error(error);
  }
  return data!;
}

export async function getImageUploadUrl(contentType: string, token?: string) {
  if (!token) throw new Error("Authentication required");
  const res = await fetch(`${API_BASE}/api/listings/image-upload-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ contentType }),
  });
  const { data, error } = await handleResponse<{ signedUrl: string; publicUrl: string }>(res);
  if (error) {
    throw new Error(error);
  }
  return data!;
}

export async function getHostListings(token?: string) {
  if (!token) throw new Error("Authentication required");
  const res = await fetch(`${API_BASE}/api/listings`, {
    cache: "no-store",
    headers: { ...authHeaders(token) },
  });
  const { data, error } = await handleResponse<{ listings: Listing[] }>(res);
  if (error) {
    throw new Error(error);
  }
  return data!;
}

export async function deleteListing(listingId: string, token?: string) {
  if (!token) throw new Error("Authentication required");
  const res = await fetch(`${API_BASE}/api/listings/${listingId}`, {
    method: "DELETE",
    headers: { ...authHeaders(token) },
  });
  if (res.status === 204) return;
  const { data, error } = await handleResponse<void>(res);
  if (error) {
    throw new Error(error);
  }
  return data;
}

export type ListingDetail = {
  id: string;
  title: string;
  address: string;
  pricePerDay: number;
  availability: string;
  amenities?: string[];
  imageUrls?: string[];
  rating?: number;
  latitude?: number;
  longitude?: number;
  hostId?: string;
  hostStripeAccountId?: string | null;
};

export async function getListing(id: string): Promise<ListingDetail> {
  const res = await fetch(`${API_BASE}/api/listings/${id}`, { cache: "no-store" });
  const { data, error } = await handleResponse<{ listing: ListingDetail }>(res);
  if (error) {
    throw new Error(error);
  }
  return data!.listing;
}

export type CreateBookingInput = {
  listingId: string;
  from: string;
  to: string;
  amountCents: number;
  currency?: string;
  platformFeePercent?: number;
};

export async function createBooking(input: CreateBookingInput, token?: string) {
  if (!token) throw new Error("Authentication required");
  const res = await fetch(`${API_BASE}/api/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(input),
  });
  const { data, error } = await handleResponse<{ checkoutUrl: string; sessionId: string }>(res);
  if (error) {
    throw new Error(error);
  }
  return data!;
}

export type BookingSummary = {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  amountCents: number;
  currency: string;
  address: string;
  title: string;
};

export async function getMyBookings(token?: string) {
  if (!token) throw new Error("Authentication required");
  const res = await fetch(`${API_BASE}/api/bookings/me`, {
    cache: "no-store",
    headers: { ...authHeaders(token) },
  });
  const { data, error } = await handleResponse<{ driverBookings: BookingSummary[]; hostBookings: BookingSummary[] }>(res);
  if (error) {
    throw new Error(error);
  }
  return data!;
}

export async function getHostPayoutStatus(token?: string) {
  if (!token) throw new Error("Authentication required");
  const res = await fetch(`${API_BASE}/api/host/payout`, {
    headers: { ...authHeaders(token) },
    cache: "no-store",
  });
  const { data, error } = await handleResponse<{ accountId: string | null }>(res);
  if (error) {
    throw new Error(error);
  }
  return data!;
}

export async function createHostPayoutAccount(token?: string) {
  if (!token) throw new Error("Authentication required");
  const res = await fetch(`${API_BASE}/api/host/payout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({}),
  });
  const { data, error } = await handleResponse<{ accountId: string; onboardingUrl: string | null }>(res);
  if (error) {
    throw new Error(error);
  }
  return data!;
}

export type AuthResponse = {
  token: string;
  user: { id: string; email: string; role?: string };
};

export async function register(email: string, password: string) {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const { data, error } = await handleResponse<AuthResponse>(res);
  if (error) {
    throw new Error(error);
  }
  return data!;
}

export async function login(email: string, password: string) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const { data, error } = await handleResponse<AuthResponse>(res);
  if (error) {
    throw new Error(error);
  }
  return data!;
}
