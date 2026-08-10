import type { Listing } from "../components/ListingCard";
import type { SearchFilters } from "../components/SearchForm";
import type { PaymentMethod, PaymentHistoryItem } from "../types/payments";
import { webEnv } from "./env";

// In the browser, use a relative base so requests go through Next.js rewrites
// (works from any device/IP). On the server, call the API directly.
const API_BASE =
  typeof window === "undefined"
    ? webEnv.NEXT_PUBLIC_API_BASE
    : "";

const REQUEST_TIMEOUT_MS = 15000;

// All API calls go through this so a dead/stalled connection fails fast with a
// clear error instead of hanging the UI (e.g. mid-checkout) indefinitely.
async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function handleResponse<T>(res: Response): Promise<{ data: T | null; error: string | null }> {
  const body = await res.json().catch(() => ({}));
  if (body === null) {
    if (!res.ok) {
      const message = res.statusText || "Request failed";
      return { data: null, error: message };
    }
    return { data: null, error: "Unexpected server response" };
  }
  if (!res.ok) {
    const message = body.message ?? res.statusText;
    return { data: null, error: message };
  }
  return { data: body as T, error: null };
}

// The server's live platform fee schedule (apps/api/src/lib/pricing.ts). The
// checkout page applies it via setPlatformFeeSchedule so quoted totals match
// what the API will verify. Returns null on failure — callers keep the baked-in
// defaults from lib/pricing.ts.
export async function fetchPlatformFeeSchedule(): Promise<{
  feeBps: number;
  minFeeCents: number;
  maxFeeCents: number | null;
} | null> {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/api/config`, { cache: "no-store" }, 5000);
    if (!res.ok) return null;
    const body = (await res.json().catch(() => null)) as { pricing?: unknown } | null;
    return (body?.pricing as { feeBps: number; minFeeCents: number; maxFeeCents: number | null }) ?? null;
  } catch {
    return null;
  }
}

export async function searchSpaces(filters: SearchFilters): Promise<Listing[]> {
  const radiusKm = Math.min(50, Math.max(0.1, Number(filters.radiusKm) || 5));
  const fromValue = new Date(`${filters.date}T${filters.startTime}:00`);
  const rawToValue = new Date(`${(filters.endDate ?? filters.date)}T${filters.endTime}:00`);
  const toValue =
    rawToValue.getTime() <= fromValue.getTime()
      ? new Date(fromValue.getTime() + 2 * 60 * 60 * 1000)
      : rawToValue;
  const params = new URLSearchParams({
    lat: String(filters.latitude ?? 53.3498),
    lng: String(filters.longitude ?? -6.2603),
    radiusKm: String(radiusKm),
    from: fromValue.toISOString().slice(0, 19) + "Z",
    to: toValue.toISOString().slice(0, 19) + "Z",
  });
  if (filters.mode) params.set("mode", filters.mode);

  if (filters.priceMin !== undefined) params.set("priceMin", String(filters.priceMin));
  if (filters.priceMax !== undefined) params.set("priceMax", String(filters.priceMax));
  if (filters.coveredParking) params.set("coveredParking", "true");
  if (filters.evCharging) params.set("evCharging", "true");
  if (filters.securityLevel) params.set("securityLevel", filters.securityLevel);
  if (filters.vehicleSize) params.set("vehicleSize", filters.vehicleSize);
  if (filters.spaceType) params.set("spaceType", filters.spaceType);
  if (filters.instantBook) params.set("instantBook", "true");

  const res = await fetchWithTimeout(`${API_BASE}/api/listings/search?${params.toString()}`, {
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

// Host availability
export type AvailabilityEntry = {
  id: string;
  kind: "open" | "blocked";
  startsAt: string;
  endsAt: string;
  repeatWeekdays?: number[];
  repeatUntil?: string | null;
  createdAt?: string;
};

export async function listAvailability(listingId: string, token?: string): Promise<AvailabilityEntry[]> {
  if (!token) throw new Error("Authentication required");
  const res = await fetchWithTimeout(`${API_BASE}/api/host/listings/${listingId}/availability`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const { data, error } = await handleResponse<{ availability: any[] }>(res);
  if (error) throw new Error(error);
  return data?.availability ?? [];
}

export async function createAvailability(
  listingId: string,
  entry: Omit<AvailabilityEntry, "id" | "createdAt">,
  token?: string
) {
  if (!token) throw new Error("Authentication required");
  const res = await fetchWithTimeout(`${API_BASE}/api/host/listings/${listingId}/availability`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      kind: entry.kind,
      startsAt: entry.startsAt,
      endsAt: entry.endsAt,
      repeatWeekdays: entry.repeatWeekdays,
      repeatUntil: entry.repeatUntil,
    }),
  });
  const { data, error } = await handleResponse<{ availability: AvailabilityEntry }>(res);
  if (error) throw new Error(error);
  return data!.availability;
}

export async function deleteAvailability(availabilityId: string, token?: string) {
  if (!token) throw new Error("Authentication required");
  const res = await fetchWithTimeout(`${API_BASE}/api/host/availability/${availabilityId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 204) {
    const { error } = await handleResponse(res);
    throw new Error(error ?? "Failed to delete availability");
  }
}

function authHeaders(token?: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export type CreateListingInput = {
  title: string;
  address: string;
  rateType?: "hourly" | "daily";
  pricePerDay: number;
  pricePerHour?: number | null;
  pricePerMonth?: number | null;
  availabilityText: string;
  latitude: number;
  longitude: number;
  amenities?: string[];
  imageUrls?: string[];
  vehicleSizeSuitability?: string | null;
};

export async function createListing(input: CreateListingInput, token?: string) {
  if (!token) throw new Error("Authentication required");
  const res = await fetchWithTimeout(`${API_BASE}/api/listings`, {
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

export async function uploadImage(file: File, token: string): Promise<string> {
  const buffer = await file.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  const res = await fetchWithTimeout(`${API_BASE}/api/listings/upload-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ data: base64, contentType: file.type, fileSizeBytes: file.size }),
  });
  const { data, error } = await handleResponse<{ publicUrl: string }>(res);
  if (error) throw new Error(error);
  return data!.publicUrl;
}

export async function getImageUploadUrl(contentType: string, fileSizeBytes: number, token?: string) {
  if (!token) throw new Error("Authentication required");
  const res = await fetchWithTimeout(`${API_BASE}/api/listings/image-upload-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ contentType, fileSizeBytes }),
  });
  const { data, error } = await handleResponse<{
    method: "POST";
    uploadUrl: string;
    uploadFields: Record<string, string>;
    publicUrl: string;
  }>(res);
  if (error) {
    throw new Error(error);
  }
  return data!;
}

export async function getHostListings(token?: string) {
  if (!token) throw new Error("Authentication required");
  const res = await fetchWithTimeout(`${API_BASE}/api/listings`, {
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
  const res = await fetchWithTimeout(`${API_BASE}/api/listings/${listingId}`, {
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

export async function setListingActive(listingId: string, isActive: boolean, token?: string) {
  if (!token) throw new Error("Authentication required");
  const res = await fetchWithTimeout(`${API_BASE}/api/listings/${listingId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ isActive }),
  });
  const { data, error } = await handleResponse<{ listing: unknown }>(res);
  if (error) {
    throw new Error(error);
  }
  return data;
}

export async function deleteAccount(token?: string) {
  if (!token) throw new Error("Authentication required");
  const res = await fetchWithTimeout(`${API_BASE}/api/auth/me`, {
    method: "DELETE",
    headers: { ...authHeaders(token) },
  });
  if (res.status === 204) return;
  const { error } = await handleResponse(res);
  if (error) {
    throw new Error(error);
  }
}

export async function requestEmailVerification(email: string) {
  const res = await fetchWithTimeout(`${API_BASE}/api/auth/request-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const { error } = await handleResponse(res);
  if (error) {
    throw new Error(error);
  }
}

export async function requestPasswordReset(email: string) {
  const res = await fetchWithTimeout(`${API_BASE}/api/auth/request-password-reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const { data, error } = await handleResponse<{ ok: boolean; previewUrl?: string }>(res);
  if (error) {
    throw new Error(error);
  }
  return data ?? { ok: true };
}

export async function resetPassword(token: string, password: string) {
  const res = await fetchWithTimeout(`${API_BASE}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
  });
  const { data, error } = await handleResponse<{ ok: boolean }>(res);
  if (error) {
    throw new Error(error);
  }
  return data ?? { ok: true };
}

// Admin API
export type AdminMetrics = {
  userCount: number;
  listingCount: number;
  activeListingCount: number;
  bookings30d: number;
  gmv30dCents: number;
  payoutBacklog: number;
  bookingsDaily: { day: string; count: number; gmvCents: number }[];
  listingStatus: { status: string; count: number }[];
  fraudByType: { eventType: string; count: number }[];
  recentOperationalEvents: {
    id: string;
    eventType: string;
    payload?: Record<string, unknown> | null;
    createdAt: string;
  }[];
  recentProductFailures: {
    id: string;
    eventType: string;
    payload?: Record<string, unknown> | null;
    createdAt: string;
  }[];
  signupFunnel: {
    signedUp: number;
    verifiedEmail: number;
    loggedIn: number;
    verifyRate: number;
    loginRate: number;
  };
  discoveryFunnel: {
    searchCompleted: number;
    listingViewed: number;
    listingViewRate: number;
  };
  bookingFunnel: {
    listingPublished: number;
    checkoutStarted: number;
    paymentIntentCreated: number;
    confirmed: number;
    checkoutToIntentRate: number;
    checkoutToConfirmedRate: number;
    publishToCheckoutRate: number;
  };
};

export async function getAdminDashboard(token?: string) {
  if (!token) throw new Error("Authentication required");
  const res = await fetchWithTimeout(`${API_BASE}/api/admin/dashboard`, {
    headers: { ...authHeaders(token) },
    cache: "no-store",
  });
  const { data, error } = await handleResponse<{ metrics: AdminMetrics }>(res);
  if (error) throw new Error(error);
  return data!.metrics;
}

export async function listAdminBookings(
  params: {
    status?: string;
    from?: string;
    to?: string;
    listingId?: string;
    userId?: string;
    limit?: number;
    offset?: number;
  },
  token?: string
) {
  if (!token) throw new Error("Authentication required");
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    query.set(key, String(value));
  });
  const res = await fetchWithTimeout(`${API_BASE}/api/admin/bookings?${query.toString()}`, {
    headers: { ...authHeaders(token) },
    cache: "no-store",
  });
  const { data, error } = await handleResponse<{ bookings: any[] }>(res);
  if (error) throw new Error(error);
  return data!.bookings ?? [];
}

export async function getAdminBooking(id: string, token?: string) {
  if (!token) throw new Error("Authentication required");
  const res = await fetchWithTimeout(`${API_BASE}/api/admin/bookings/${id}`, {
    headers: { ...authHeaders(token) },
    cache: "no-store",
  });
  const { data, error } = await handleResponse<{ booking: any }>(res);
  if (error) throw new Error(error);
  return data!.booking;
}

export async function updateAdminBooking(id: string, payload: Record<string, any>, token?: string) {
  if (!token) throw new Error("Authentication required");
  const res = await fetchWithTimeout(`${API_BASE}/api/admin/bookings/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(payload),
  });
  const { data, error } = await handleResponse<{ booking: any }>(res);
  if (error) throw new Error(error);
  return data!.booking;
}

export async function listAdminPayments(
  params: { status?: string; limit?: number; offset?: number },
  token?: string
) {
  if (!token) throw new Error("Authentication required");
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    query.set(key, String(value));
  });
  const res = await fetchWithTimeout(`${API_BASE}/api/admin/payments?${query.toString()}`, {
    headers: { ...authHeaders(token) },
    cache: "no-store",
  });
  const { data, error } = await handleResponse<{ payments: any[] }>(res);
  if (error) throw new Error(error);
  return data!.payments ?? [];
}

export async function listAdminPayouts(
  params: { status?: string; limit?: number; offset?: number },
  token?: string
) {
  if (!token) throw new Error("Authentication required");
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    query.set(key, String(value));
  });
  const res = await fetchWithTimeout(`${API_BASE}/api/admin/payouts?${query.toString()}`, {
    headers: { ...authHeaders(token) },
    cache: "no-store",
  });
  const { data, error } = await handleResponse<{ payouts: any[] }>(res);
  if (error) throw new Error(error);
  return data!.payouts ?? [];
}

export async function listAdminSupportTickets(
  params: { status?: string; priority?: string; search?: string; limit?: number; offset?: number },
  token?: string
) {
  if (!token) throw new Error("Authentication required");
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    query.set(key, String(value));
  });
  const res = await fetchWithTimeout(`${API_BASE}/api/admin/support?${query.toString()}`, {
    headers: { ...authHeaders(token) },
    cache: "no-store",
  });
  const { data, error } = await handleResponse<{ tickets: any[] }>(res);
  if (error) throw new Error(error);
  return data!.tickets ?? [];
}

export async function updateAdminSupportTicket(id: string, payload: Record<string, any>, token?: string) {
  if (!token) throw new Error("Authentication required");
  const res = await fetchWithTimeout(`${API_BASE}/api/admin/support/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(payload),
  });
  const { data, error } = await handleResponse<{ ticket: any }>(res);
  if (error) throw new Error(error);
  return data!.ticket;
}

export async function listAdminSettings(token?: string) {
  if (!token) throw new Error("Authentication required");
  const res = await fetchWithTimeout(`${API_BASE}/api/admin/settings`, {
    headers: { ...authHeaders(token) },
    cache: "no-store",
  });
  const { data, error } = await handleResponse<{ settings: any[] }>(res);
  if (error) throw new Error(error);
  return data!.settings ?? [];
}

export async function updateAdminSetting(key: string, payload: Record<string, any>, token?: string) {
  if (!token) throw new Error("Authentication required");
  const res = await fetchWithTimeout(`${API_BASE}/api/admin/settings/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(payload),
  });
  const { data, error } = await handleResponse<{ setting: any }>(res);
  if (error) throw new Error(error);
  return data!.setting;
}

export async function listAdminEvents(
  params: { eventType?: string; limit?: number; offset?: number },
  token?: string
) {
  if (!token) throw new Error("Authentication required");
  const query = new URLSearchParams();
  if (params.eventType) query.set("eventType", params.eventType);
  if (params.limit) query.set("limit", String(params.limit));
  if (params.offset) query.set("offset", String(params.offset));
  const res = await fetchWithTimeout(`${API_BASE}/api/admin/events?${query.toString()}`, {
    headers: { ...authHeaders(token) },
    cache: "no-store",
  });
  const { data, error } = await handleResponse<{ events: any[] }>(res);
  if (error) throw new Error(error);
  return data!.events ?? [];
}

export type ListingDetail = {
  id: string;
  title: string;
  address: string;
  pricePerDay: number;
  pricePerHour?: number | null;
  pricePerMonth?: number | null;
  rateType?: "hourly" | "daily" | null;
  availability: string;
  amenities?: string[];
  imageUrls?: string[];
  rating?: number;
  ratingCount?: number;
  latitude?: number;
  longitude?: number;
  hostId?: string;
  hostStripeAccountId?: string | null;
  // Redacted to null unless the caller is the listing's host — the detail
  // endpoint used to hand these to anyone. Read the booleans for presence.
  accessCode?: string | null;
  arrivalInstructions?: string | null;
  hasAccessCode?: boolean;
  hasArrivalInstructions?: boolean;
  permissionDeclared?: boolean;
  description?: string | null;
};

export async function getListing(id: string): Promise<ListingDetail> {
  const res = await fetchWithTimeout(`${API_BASE}/api/listings/${id}`, { cache: "no-store" });
  const { data, error } = await handleResponse<{ listing: ListingDetail }>(res);
  if (error) {
    throw new Error(error);
  }
  return data!.listing;
}

export type ListingReview = {
  id: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
  authorName?: string | null;
};

export async function listListingReviews(listingId: string, params?: { limit?: number; offset?: number }) {
  const query = new URLSearchParams();
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));
  const res = await fetchWithTimeout(`${API_BASE}/api/reviews/listing/${listingId}?${query.toString()}`, { cache: "no-store" });
  const { data, error } = await handleResponse<{ reviews: any[] }>(res);
  if (error) throw new Error(error);
  return (data?.reviews ?? []) as ListingReview[];
}

export async function createReview(
  payload: { bookingId: string; rating: number; comment?: string },
  token?: string
) {
  if (!token) throw new Error("Authentication required");
  const res = await fetchWithTimeout(`${API_BASE}/api/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(payload),
  });
  const { data, error } = await handleResponse<{ review: { id: string; rating: number; comment?: string } }>(res);
  if (error) throw new Error(error);
  return data!.review;
}

// ── Favourites ────────────────────────────────────────────────────────────────

export type FavouriteListing = {
  id: string;
  title: string;
  address: string;
  pricePerDay?: number;
  rating?: number;
  ratingCount?: number;
  imageUrls?: string[];
};

export async function getFavourites(token?: string): Promise<FavouriteListing[]> {
  if (!token) throw new Error("Authentication required");
  const res = await fetchWithTimeout(`${API_BASE}/api/favorites`, {
    cache: "no-store",
    headers: { ...authHeaders(token) },
  });
  const { data, error } = await handleResponse<{ favorites: any[] }>(res);
  if (error) throw new Error(error);
  // Postgres NUMERIC columns arrive as strings — coerce so the FavouriteListing
  // type matches reality (callers do listing.rating.toFixed(1), etc.).
  const num = (v: unknown) => (v == null || v === "" ? undefined : Number(v));
  return (data?.favorites ?? []).map((f) => ({
    ...f,
    pricePerDay: num(f.pricePerDay),
    rating: num(f.rating),
    ratingCount: num(f.ratingCount),
  })) as FavouriteListing[];
}

export async function addFavourite(listingId: string, token?: string) {
  if (!token) throw new Error("Authentication required");
  const res = await fetchWithTimeout(`${API_BASE}/api/favorites`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ listingId }),
  });
  const { error } = await handleResponse<{ ok: boolean }>(res);
  if (error) throw new Error(error);
}

export async function removeFavourite(listingId: string, token?: string) {
  if (!token) throw new Error("Authentication required");
  const res = await fetchWithTimeout(`${API_BASE}/api/favorites/${listingId}`, {
    method: "DELETE",
    headers: { ...authHeaders(token) },
  });
  if (res.status === 204 || res.ok) return;
  const { error } = await handleResponse<void>(res);
  if (error) throw new Error(error);
}

export type CreateBookingInput = {
  listingId: string;
  from: string;
  to: string;
  mode?: "daily" | "monthly";
  amountCents: number;
  currency?: string;
  platformFeePercent?: number;
  vehiclePlate?: string;
};

export async function createBooking(input: CreateBookingInput, token?: string) {
  if (!token) throw new Error("Authentication required");
  const res = await fetchWithTimeout(`${API_BASE}/api/bookings`, {
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

export async function createPortalBooking(input: { listingId: string; until: string; vehiclePlate: string }) {
  const res = await fetchWithTimeout(`${API_BASE}/api/bookings/portal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  listingId?: string;
  startTime: string;
  endTime: string;
  status: string;
  refundStatus?: string | null;
  refundedAt?: string | null;
  noShowAt?: string | null;
  checkedInAt?: string | null;
  cancellationSource?: "driver" | "host" | null;
  amountCents: number;
  currency: string;
  address: string;
  title: string;
  imageUrls?: string[] | null;
  latitude?: number | null;
  longitude?: number | null;
  receiptUrl?: string | null;
  vehiclePlate?: string | null;
  accessCode?: string | null;
  arrivalInstructions?: string | null;
  hostPhone?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  driverVehicleMake?: string | null;
  driverVehicleType?: string | null;
  driverVehicleColor?: string | null;
};

export async function getMyBookings(token?: string) {
  if (!token) throw new Error("Authentication required");
  const res = await fetchWithTimeout(`${API_BASE}/api/bookings/me`, {
    cache: "no-store",
    headers: { ...authHeaders(token) },
  });
  const { data, error } = await handleResponse<{ driverBookings: BookingSummary[]; hostBookings: BookingSummary[] }>(res);
  if (error) {
    throw new Error(error);
  }
  return data!;
}

export async function cancelHostBooking(bookingId: string, token?: string) {
  if (!token) throw new Error("Authentication required");
  const res = await fetchWithTimeout(`${API_BASE}/api/bookings/${bookingId}/host-cancel`, {
    method: "POST",
    headers: { ...authHeaders(token) },
  });
  const { data, error } = await handleResponse<{ ok: boolean; refunded?: boolean; alreadyCanceled?: boolean }>(res);
  if (error) throw new Error(error);
  return data ?? { ok: true };
}

// Driver-initiated cancellation. The API auto-refunds confirmed bookings and
// returns whether a refund was issued, so the UI can confirm the real outcome.
export async function cancelDriverBooking(bookingId: string, token?: string) {
  if (!token) throw new Error("Authentication required");
  const res = await fetchWithTimeout(`${API_BASE}/api/bookings/${bookingId}/cancel`, {
    method: "POST",
    headers: { ...authHeaders(token) },
  });
  const { data, error } = await handleResponse<{ ok: boolean; refunded?: boolean; alreadyCanceled?: boolean }>(res);
  if (error) throw new Error(error);
  return data ?? { ok: true };
}

export async function getBooking(bookingId: string, token?: string): Promise<BookingSummary> {
  if (!token) throw new Error("Authentication required");
  const res = await fetchWithTimeout(`${API_BASE}/api/bookings/${bookingId}`, {
    cache: "no-store",
    headers: { ...authHeaders(token) },
  });
  const { data, error } = await handleResponse<BookingSummary>(res);
  if (error) throw new Error(error);
  return data!;
}

export async function getHostPayoutStatus(token?: string) {
  if (!token) throw new Error("Authentication required");
  const res = await fetchWithTimeout(`${API_BASE}/api/host/payout`, {
    headers: { ...authHeaders(token) },
    cache: "no-store",
  });
  const { data, error } = await handleResponse<{
    accountId: string | null;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
    requirementsDue: string[];
  }>(res);
  if (error) {
    throw new Error(error);
  }
  return data!;
}

export async function createHostPayoutAccount(
  token?: string,
  options?: { accountId?: string | null; returnUrl?: string; refreshUrl?: string }
) {
  if (!token) throw new Error("Authentication required");
  const res = await fetchWithTimeout(`${API_BASE}/api/host/payout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({
      accountId: options?.accountId ?? undefined,
      returnUrl: options?.returnUrl,
      refreshUrl: options?.refreshUrl,
    }),
  });
  const { data, error } = await handleResponse<{ accountId: string; onboardingUrl: string | null; mock?: boolean }>(res);
  if (error) {
    throw new Error(error);
  }
  return data!;
}

export async function getHostEarningsSummary(token?: string) {
  if (!token) throw new Error("Authentication required");
  const res = await fetchWithTimeout(`${API_BASE}/api/host/earnings`, {
    headers: { ...authHeaders(token) },
    cache: "no-store",
  });
  const { data, error } = await handleResponse<{
    summary: { totalCents: number; feeCents: number; netCents: number; currency: string };
  }>(res);
  if (error) {
    throw new Error(error);
  }
  return data?.summary ?? { totalCents: 0, feeCents: 0, netCents: 0, currency: "EUR" };
}

export type AuthResponse = {
  token: string;
  refreshToken?: string;
  user: { id: string; email: string; name?: string | null; role?: string; emailVerified?: boolean; phone?: string | null; phoneVerified?: boolean; vehiclePlate?: string | null; vehicleMake?: string | null; vehicleType?: string | null; vehicleColor?: string | null };
};

export async function updateMe(token: string, payload: { name?: string | null; phone?: string | null; vehiclePlate?: string | null; vehicleMake?: string | null; vehicleType?: string | null; vehicleColor?: string | null }) {
  const res = await fetchWithTimeout(`${API_BASE}/api/auth/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(payload),
  });
  const { data, error } = await handleResponse<{ user: AuthResponse["user"] }>(res);
  if (error) throw new Error(error);
  return data!;
}

export async function changePassword(token: string, currentPassword: string, newPassword: string) {
  const res = await fetchWithTimeout(`${API_BASE}/api/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const { error } = await handleResponse<{ ok: boolean }>(res);
  if (error) throw new Error(error);
}

export async function logoutAllSessions(token: string) {
  const res = await fetchWithTimeout(`${API_BASE}/api/auth/logout-all`, {
    method: "POST",
    headers: { ...authHeaders(token) },
  });
  const { error } = await handleResponse<{ ok: boolean }>(res);
  if (error) throw new Error(error);
}

export async function sendSupportMessage(token: string, payload: { subject: string; message: string }) {
  const res = await fetchWithTimeout(`${API_BASE}/api/support`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(payload),
  });
  const { error } = await handleResponse<{ ok: boolean }>(res);
  if (error) throw new Error(error);
}

const LEGAL_VERSION = "2026-01-10";

export async function register(email: string, password: string, phone?: string, firstName?: string, lastName?: string) {
  const res = await fetchWithTimeout(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      phone: phone || undefined,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      termsVersion: LEGAL_VERSION,
      privacyVersion: LEGAL_VERSION,
    }),
  });
  const { data, error } = await handleResponse<AuthResponse>(res);
  if (error) {
    throw new Error(error);
  }
  if (!data?.user || !data?.token) {
    throw new Error("Signup failed. Please try again.");
  }
  return data!;
}

export async function requestPhoneVerification(phone: string, token?: string) {
  if (!token) throw new Error("Authentication required");
  const res = await fetchWithTimeout(`${API_BASE}/api/auth/request-phone-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ phone }),
  });
  const { data, error } = await handleResponse<{ ok: boolean }>(res);
  if (error) {
    throw new Error(error);
  }
  return data!;
}

export async function verifyPhone(code: string, token?: string) {
  if (!token) throw new Error("Authentication required");
  const res = await fetchWithTimeout(`${API_BASE}/api/auth/verify-phone`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ code }),
  });
  const { data, error } = await handleResponse<{ ok: boolean; user: AuthResponse["user"] }>(res);
  if (error) {
    throw new Error(error);
  }
  return data!;
}

export async function login(email: string, password: string) {
  const res = await fetchWithTimeout(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const { data, error } = await handleResponse<AuthResponse>(res);
  if (error) {
    throw new Error(error);
  }
  if (!data?.user || !data?.token) {
    throw new Error("Login failed. Please try again.");
  }
  return data!;
}

export async function oauthLoginGoogle(idToken: string) {
  const res = await fetchWithTimeout(`${API_BASE}/api/auth/oauth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  const { data, error } = await handleResponse<AuthResponse>(res);
  if (error) {
    throw new Error(error);
  }
  if (!data?.user || !data?.token) {
    throw new Error("Google sign-in failed. Please try again.");
  }
  return data!;
}

export async function refreshSession(refreshToken: string) {
  const res = await fetchWithTimeout(`${API_BASE}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  const { data, error } = await handleResponse<AuthResponse>(res);
  if (error) {
    throw new Error(error);
  }
  return data!;
}

export async function revokeSession(token: string) {
  const res = await fetchWithTimeout(`${API_BASE}/api/auth/logout`, {
    method: "POST",
    headers: { ...authHeaders(token) },
  });
  const { error } = await handleResponse<{ ok: boolean }>(res);
  if (error) {
    throw new Error(error);
  }
  return true;
}

export async function requestVerification(email: string) {
  const res = await fetchWithTimeout(`${API_BASE}/api/auth/request-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const { error } = await handleResponse<{ ok: boolean }>(res);
  if (error) {
    throw new Error(error);
  }
  return true;
}

export async function verifyEmail(token: string) {
  const res = await fetchWithTimeout(`${API_BASE}/api/auth/verify?token=${token}`);
  const { error } = await handleResponse<{ ok: boolean }>(res);
  if (error) throw new Error(error);
  return true;
}

// Payments (driver)
export async function listPaymentMethods(token?: string): Promise<PaymentMethod[]> {
  if (!token) throw new Error("Authentication required");
  const res = await fetchWithTimeout(`${API_BASE}/api/payment-methods`, {
    headers: { ...authHeaders(token) },
    cache: "no-store",
  });
  const { data, error } = await handleResponse<{ paymentMethods: PaymentMethod[] }>(res);
  if (error) throw new Error(error);
  return data?.paymentMethods ?? [];
}

export async function addPaymentMethod(input: Record<string, any>, token?: string): Promise<any> {
  if (!token) throw new Error("Authentication required");
  const res = await fetchWithTimeout(`${API_BASE}/api/payment-methods`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(input),
  });
  const { data, error } = await handleResponse<any>(res);
  if (error) throw new Error(error);
  return data;
}

export async function setDefaultPaymentMethod(id: string, token?: string) {
  if (!token) throw new Error("Authentication required");
  const res = await fetchWithTimeout(`${API_BASE}/api/payment-methods/${id}`, {
    method: "PUT",
    headers: { ...authHeaders(token) },
  });
  const { error } = await handleResponse<{ ok: boolean }>(res);
  if (error) throw new Error(error);
  return true;
}

export async function deletePaymentMethod(id: string, token?: string) {
  if (!token) throw new Error("Authentication required");
  const res = await fetchWithTimeout(`${API_BASE}/api/payment-methods/${id}`, {
    method: "DELETE",
    headers: { ...authHeaders(token) },
  });
  if (res.status === 204) return true;
  const { error } = await handleResponse<{ ok: boolean }>(res);
  if (error) throw new Error(error);
  return true;
}

export async function listPaymentHistory(token?: string): Promise<PaymentHistoryItem[]> {
  if (!token) throw new Error("Authentication required");
  const res = await fetchWithTimeout(`${API_BASE}/api/payments/history`, {
    headers: { ...authHeaders(token) },
    cache: "no-store",
  });
  const { data, error } = await handleResponse<{ payments: PaymentHistoryItem[] }>(res);
  if (error) throw new Error(error);
  return data?.payments ?? [];
}

export async function retryPayment(paymentId: string, token?: string) {
  if (!token) throw new Error("Authentication required");
  const res = await fetchWithTimeout(`${API_BASE}/api/payments/${paymentId}/retry`, {
    method: "POST",
    headers: { ...authHeaders(token) },
  });
  const { error } = await handleResponse<{ ok: boolean }>(res);
  if (error) throw new Error(error);
  return true;
}

// Payouts (host)
export async function getPayoutConnectStatus(token?: string) {
  const data = await getHostPayoutStatus(token);
  return {
    connected: Boolean(data.payoutsEnabled),
    accountId: data.accountId ?? undefined,
  };
}

export async function createPayoutOnboardingLink(token?: string) {
  const data = await createHostPayoutAccount(token);
  return data.onboardingUrl ?? "";
}
