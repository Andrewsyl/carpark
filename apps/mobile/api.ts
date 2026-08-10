import type { ListingDetail, ListingSummary, SearchParams } from "./types";
import {
  getMobileE2EState,
  isMobileE2EActive,
  recordMockBooking,
  recordMockListingPublish,
} from "./e2e/testMode";
import { mobileEnv } from "./env";

const baseUrl = mobileEnv.apiBase;
const REQUEST_TIMEOUT_MS = 15000;

if (__DEV__) {
  // Make active API target explicit in Metro logs when switching environments.
  console.log("[mobile:info] API base", baseUrl);
}

type AuthResponse = {
  token: string;
  refreshToken?: string;
  user: {
    id: string;
    email: string;
    name?: string | null;
    phone?: string | null;
    phoneVerified?: boolean;
    vehicleMake?: string | null;
    vehicleType?: string | null;
    vehicleColor?: string | null;
    vehiclePlate?: string | null;
    status?: "active" | "suspended";
    role?: string;
    emailVerified?: boolean;
    termsVersion?: string | null;
    termsAcceptedAt?: string | null;
    privacyVersion?: string | null;
    privacyAcceptedAt?: string | null;
  };
};

async function readErrorMessage(response: Response, fallback: string) {
  // Server/gateway errors return an HTML page from the load balancer, not JSON.
  // Never surface raw HTML to the user — show a friendly message instead.
  if (response.status >= 500) {
    return "We're having trouble reaching FreeSpace right now. Please try again in a moment.";
  }
  try {
    const data = (await response.clone().json()) as { error?: string; message?: string };
    if (typeof data?.error === "string") return data.error;
    if (typeof data?.message === "string") return data.message;
  } catch {
    // Ignore json parse errors.
  }
  try {
    const text = (await response.text()).trim();
    // Only use the body if it looks like a real message — not an HTML error page.
    const looksLikeHtml = /^<(?:!doctype|html|head|body)/i.test(text) || text.includes("</");
    if (text && !looksLikeHtml && text.length <= 200) return text;
  } catch {
    // Ignore text errors.
  }
  return `${fallback} (${response.status})`;
}

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS) {
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

function resolveApiBase(apiBaseOverride?: string) {
  const candidate = apiBaseOverride?.trim();
  if (!candidate) return baseUrl;
  return candidate.replace(/\/$/, "");
}

export async function searchListings(params: SearchParams) {
  const e2eState = getMobileE2EState();
  if (isMobileE2EActive() && e2eState) {
    return e2eState.searchResults.map((space) => ({ ...space }));
  }
  const radiusKm = Math.min(50, Math.max(0.1, Number(params.radiusKm) || 5));
  const query = new URLSearchParams();
  query.set("lat", params.lat);
  query.set("lng", params.lng);
  query.set("radiusKm", String(radiusKm));
  query.set("from", params.from);
  query.set("to", params.to);
  if (params.includeUnavailable) query.set("includeUnavailable", "true");
  if (params.mode === "monthly") query.set("mode", "monthly");
  if (params.spaceType) query.set("spaceType", params.spaceType);
  if (params.priceMin) query.set("priceMin", params.priceMin);
  if (params.priceMax) query.set("priceMax", params.priceMax);
  if (params.coveredParking) query.set("coveredParking", "true");
  if (params.evCharging) query.set("evCharging", "true");
  if (params.securityLevel) query.set("securityLevel", params.securityLevel);
  if (params.vehicleSize) query.set("vehicleSize", params.vehicleSize);
  if (params.instantBook) query.set("instantBook", "true");
  const response = await fetchWithTimeout(`${baseUrl}/api/listings/search?${query.toString()}`);
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Search failed"));
  }
  const payload = (await response.json()) as { spaces?: ListingSummary[] };
  const spaces = payload.spaces ?? [];
  return spaces.map((space: any) => ({
    id: space.id,
    title: space.title,
    address: space.address,
    price_per_day: space.price_per_day ?? space.pricePerDay,
    price_per_hour: space.price_per_hour ?? space.pricePerHour ?? null,
    price_per_month: space.price_per_month ?? space.pricePerMonth ?? null,
    rate_type: space.rate_type ?? space.rateType ?? "daily",
    is_available: space.is_available ?? space.isAvailable ?? null,
    rating: space.rating,
    rating_count: space.rating_count ?? space.ratingCount,
    availability_text: space.availability_text ?? space.availability,
    amenities: space.amenities ?? null,
    access_code: space.access_code ?? space.accessCode ?? null,
    arrival_instructions: space.arrival_instructions ?? space.arrivalInstructions ?? null,
    latitude: space.latitude,
    longitude: space.longitude,
    distance_m:
      space.distance_m ??
      (typeof space.distanceKm === "number" ? Math.round(space.distanceKm * 1000) : null),
    image_urls: space.image_urls ?? space.imageUrls ?? null,
    capacity: space.capacity ?? null,
  }));
}

export async function getListing(
  id: string,
  params?: {
    from?: string;
    to?: string;
    /**
     * Send the caller's token when the caller might be the listing's host. The
     * endpoint redacts `accessCode` and `arrivalInstructions` for everyone
     * else, so the host's own edit form has to identify itself or it prefills
     * blanks over real values and saves them.
     */
    token?: string;
  }
) {
  const e2eState = getMobileE2EState();
  if (isMobileE2EActive() && e2eState?.listing.id === id) {
    return { ...e2eState.listing };
  }
  const query = new URLSearchParams();
  if (params?.from) query.set("from", params.from);
  if (params?.to) query.set("to", params.to);
  const queryString = query.toString();
  const url = queryString
    ? `${baseUrl}/api/listings/${id}?${queryString}`
    : `${baseUrl}/api/listings/${id}`;
  const response = await fetchWithTimeout(
    url,
    params?.token ? { headers: { Authorization: `Bearer ${params.token}` } } : undefined
  );
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Listing failed"));
  }
  const payload = (await response.json()) as { listing: ListingDetail };
  const listing: any = payload.listing ?? {};
  return {
    ...listing,
    price_per_day: listing.price_per_day ?? listing.pricePerDay,
    price_per_hour: listing.price_per_hour ?? listing.pricePerHour ?? null,
    price_per_month: listing.price_per_month ?? listing.pricePerMonth ?? null,
    rate_type: listing.rate_type ?? listing.rateType ?? "daily",
    is_available: listing.is_available ?? listing.isAvailable ?? null,
    rating_count: listing.rating_count ?? listing.ratingCount,
    availability_text: listing.availability_text ?? listing.availability,
    availabilitySchedule:
      listing.availabilitySchedule ?? listing.availability_schedule,
    amenities: listing.amenities ?? null,
    access_code: listing.access_code ?? listing.accessCode ?? null,
    arrival_instructions:
      listing.arrival_instructions ?? listing.arrivalInstructions ?? null,
    // Redacted to null for anyone who isn't the host, so presence has to come
    // off the booleans rather than the values.
    hasAccessCode: listing.hasAccessCode ?? Boolean(listing.access_code ?? listing.accessCode),
    hasArrivalInstructions:
      listing.hasArrivalInstructions ??
      Boolean(listing.arrival_instructions ?? listing.arrivalInstructions),
    permission_declared:
      listing.permission_declared ?? listing.permissionDeclared ?? null,
    image_urls: listing.image_urls ?? listing.imageUrls ?? null,
    description: listing.description ?? null,
  } as ListingDetail;
}

export async function listFavorites(token: string) {
  const response = await fetchWithTimeout(`${baseUrl}/api/favorites`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Favorites failed"));
  }
  // The favorites endpoint returns camelCase fields (imageUrls, ratingCount, …);
  // normalize to the snake_case ListingSummary shape the app reads, like the other
  // list endpoints do — otherwise images/ratings/prices come back empty.
  const payload = (await response.json()) as { favorites?: any[] };
  return (payload.favorites ?? []).map((fav: any) => ({
    id: fav.id,
    title: fav.title,
    address: fav.address,
    price_per_day: fav.price_per_day ?? fav.pricePerDay,
    price_per_hour: fav.price_per_hour ?? fav.pricePerHour ?? null,
    price_per_month: fav.price_per_month ?? fav.pricePerMonth ?? null,
    rate_type: fav.rate_type ?? fav.rateType ?? null,
    rating: fav.rating ?? null,
    rating_count: fav.rating_count ?? fav.ratingCount ?? null,
    availability_text: fav.availability_text ?? fav.availability ?? null,
    amenities: fav.amenities ?? null,
    latitude: fav.latitude ?? null,
    longitude: fav.longitude ?? null,
    image_urls: fav.image_urls ?? fav.imageUrls ?? null,
  })) as ListingSummary[];
}

export async function addFavorite(token: string, listingId: string) {
  const response = await fetchWithTimeout(`${baseUrl}/api/favorites`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ listingId }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Favorite failed"));
  }
  return (await response.json()) as { listingId: string };
}

export async function removeFavorite(token: string, listingId: string) {
  const response = await fetchWithTimeout(`${baseUrl}/api/favorites/${listingId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok && response.status !== 204) {
    throw new Error(await readErrorMessage(response, "Remove favorite failed"));
  }
}

export async function registerPushToken({
  token,
  expoToken,
  platform,
  deviceId,
}: {
  token: string;
  expoToken: string;
  platform: string;
  deviceId?: string;
}) {
  const response = await fetchWithTimeout(`${baseUrl}/api/notifications/register`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expoToken, platform, deviceId }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Push registration failed"));
  }
}

export async function unregisterPushToken(token: string, expoToken: string) {
  const response = await fetchWithTimeout(`${baseUrl}/api/notifications/register`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expoToken }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Push unregister failed"));
  }
}

export async function getHostListings(token: string) {
  const response = await fetchWithTimeout(`${baseUrl}/api/listings`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(await readErrorMessage(response, "Host listings failed"));
  return (await response.json()) as { listings: { id: string }[] };
}

export async function getHostEarningsSummary(token: string) {
  const response = await fetchWithTimeout(`${baseUrl}/api/host/earnings`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Earnings failed"));
  }
  const payload = (await response.json()) as {
    summary: { totalCents: number; feeCents: number; netCents: number; currency: string };
  };
  return payload.summary;
}

export type HostPayoutStatus = {
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirementsDue: string[];
};

export async function getHostPayoutStatus(token: string) {
  const response = await fetchWithTimeout(`${baseUrl}/api/host/payout`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Payout status failed"));
  }
  return (await response.json()) as HostPayoutStatus;
}

export async function createHostPayoutLink(payload: {
  token: string;
  accountId?: string | null;
  returnUrl?: string;
  refreshUrl?: string;
}) {
  const response = await fetchWithTimeout(`${baseUrl}/api/host/payout`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${payload.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      accountId: payload.accountId ?? undefined,
      returnUrl: payload.returnUrl,
      refreshUrl: payload.refreshUrl,
    }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Payout setup failed"));
  }
  return (await response.json()) as { accountId: string; onboardingUrl: string | null; mock?: boolean };
}

export type AdminUser = {
  id: string;
  email: string;
  role: "driver" | "host" | "admin";
  status: "active" | "suspended";
};

export type AdminListing = {
  id: string;
  title: string;
  address: string;
  status: "approved" | "pending" | "rejected" | "disabled";
  moderation_reason?: string | null;
  moderation_note?: string | null;
  host_id: string;
};

export async function adminListUsers(token: string) {
  const response = await fetchWithTimeout(`${baseUrl}/api/admin/users`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Admin users failed (${response.status})`);
  }
  const payload = (await response.json()) as { users: AdminUser[] };
  return payload.users ?? [];
}

export async function adminUpdateUser(
  token: string,
  userId: string,
  payload: { status?: "active" | "suspended"; role?: "driver" | "host" | "admin"; reason?: string }
) {
  const response = await fetchWithTimeout(`${baseUrl}/api/admin/users/${userId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Admin user update failed (${response.status})`);
  }
  return (await response.json()) as { user: AdminUser };
}

export async function adminListListings(token: string) {
  const response = await fetchWithTimeout(`${baseUrl}/api/admin/listings`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Admin listings failed (${response.status})`);
  }
  const payload = (await response.json()) as { listings: AdminListing[] };
  return payload.listings ?? [];
}

export async function adminUpdateListing(
  token: string,
  listingId: string,
  payload: {
    status: "approved" | "pending" | "rejected" | "disabled";
    moderationReason?: string;
    moderationNote?: string;
    reason?: string;
  }
) {
  const response = await fetchWithTimeout(`${baseUrl}/api/admin/listings/${listingId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Admin listing update failed (${response.status})`);
  }
  return (await response.json()) as { listing: AdminListing };
}

export type AdminPromo = {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percent" | "fixed";
  discount_value: number;
  max_redemptions: number | null;
  max_redemptions_per_user: number;
  min_amount_cents: number;
  starts_at: string | null;
  expires_at: string | null;
  active: boolean;
  created_at: string;
  redemption_count: number;
};

export async function adminListPromos(token: string) {
  const response = await fetchWithTimeout(`${baseUrl}/api/admin/promos`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Admin promos failed (${response.status})`);
  }
  const payload = (await response.json()) as { promos: AdminPromo[] };
  return payload.promos ?? [];
}

export async function adminCreatePromo(
  token: string,
  payload: {
    code: string;
    description?: string;
    discountType: "percent" | "fixed";
    discountValue: number;
    maxRedemptions?: number | null;
    maxRedemptionsPerUser?: number;
    expiresAt?: string | null;
  }
) {
  const response = await fetchWithTimeout(`${baseUrl}/api/admin/promos`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Promo creation failed"));
  }
  return (await response.json()) as { promo: AdminPromo };
}

export async function adminUpdatePromo(
  token: string,
  promoId: string,
  payload: { active?: boolean; expiresAt?: string | null; maxRedemptions?: number | null }
) {
  const response = await fetchWithTimeout(`${baseUrl}/api/admin/promos/${promoId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Promo update failed"));
  }
  return (await response.json()) as { promo: AdminPromo };
}

export async function sendSupportMessage(token: string, payload: { subject: string; message: string }) {
  const response = await fetchWithTimeout(`${baseUrl}/api/support`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const message = await readErrorMessage(response, "Support request failed");
    throw new Error(message);
  }
  return (await response.json()) as { ok: boolean };
}

export async function login(email: string, password: string) {
  const response = await fetchWithTimeout(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Login failed"));
  }
  return (await response.json()) as AuthResponse;
}

export async function register(
  email: string,
  password: string,
  payload?: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    termsVersion: string;
    privacyVersion: string;
  }
) {
  const response = await fetchWithTimeout(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, ...payload }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Sign up failed"));
  }
  return (await response.json()) as AuthResponse & { previewUrl?: string };
}

export async function refreshSession(refreshToken: string) {
  const response = await fetchWithTimeout(`${baseUrl}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Session refresh failed"));
  }
  return (await response.json()) as AuthResponse;
}

export async function revokeSession(token: string, refreshToken?: string | null) {
  // Sending this device's refresh token lets the server revoke just this
  // device's session instead of the account-wide legacy token.
  const response = await fetchWithTimeout(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(refreshToken ? { refreshToken } : {}),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Logout failed"));
  }
  return (await response.json()) as { ok: boolean };
}

export async function logoutAllSessions(token: string) {
  const response = await fetchWithTimeout(`${baseUrl}/api/auth/logout-all`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Log out all devices failed"));
  }
  return (await response.json()) as { ok: boolean };
}

export async function getMe(token: string, apiBaseOverride?: string) {
  const response = await fetchWithTimeout(`${resolveApiBase(apiBaseOverride)}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to load profile"));
  }
  return (await response.json()) as { user: AuthResponse["user"] };
}

export async function updateMe(
  token: string,
  payload: {
    email?: string | null;
    name?: string | null;
    phone?: string | null;
    vehicleMake?: string | null;
    vehicleType?: string | null;
    vehicleColor?: string | null;
    vehiclePlate?: string | null;
  }
) {
  const response = await fetchWithTimeout(`${baseUrl}/api/auth/me`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to update profile"));
  }
  return (await response.json()) as { user: AuthResponse["user"]; previewUrl?: string };
}

export async function requestPhoneVerification(token: string, phone: string) {
  const response = await fetchWithTimeout(`${baseUrl}/api/auth/request-phone-verification`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ phone }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Phone verification request failed"));
  }
  return (await response.json()) as { ok: boolean };
}

export async function verifyPhone(token: string, code: string) {
  const response = await fetchWithTimeout(`${baseUrl}/api/auth/verify-phone`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Phone verification failed"));
  }
  return (await response.json()) as { ok: boolean; user?: AuthResponse["user"] };
}

export async function requestPasswordReset(email: string) {
  const response = await fetchWithTimeout(`${baseUrl}/api/auth/request-password-reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Reset request failed"));
  }
  return (await response.json()) as { ok: boolean; previewUrl?: string };
}

export async function verifyEmailToken(token: string, apiBaseOverride?: string) {
  const response = await fetchWithTimeout(`${resolveApiBase(apiBaseOverride)}/api/auth/verify?token=${encodeURIComponent(token)}`, {
    headers: {
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Email verification failed"));
  }
  return (await response.json()) as { ok: boolean };
}

export async function resetPassword(token: string, password: string, apiBaseOverride?: string) {
  const response = await fetchWithTimeout(`${resolveApiBase(apiBaseOverride)}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Reset failed"));
  }
  return (await response.json()) as { ok: boolean };
}

export async function oauthLoginGoogle(idToken: string) {
  const response = await fetchWithTimeout(`${baseUrl}/api/auth/oauth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Google sign-in failed"));
  }
  return (await response.json()) as AuthResponse;
}

export async function oauthLoginApple(identityToken: string, fullName?: string | null) {
  const response = await fetchWithTimeout(`${baseUrl}/api/auth/oauth/apple`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identityToken, fullName: fullName ?? undefined }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Apple sign-in failed"));
  }
  return (await response.json()) as AuthResponse;
}

export async function oauthLoginFacebook(accessToken: string) {
  const response = await fetchWithTimeout(`${baseUrl}/api/auth/oauth/facebook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Facebook sign-in failed"));
  }
  return (await response.json()) as AuthResponse;
}

export async function acceptLegal(token: string, payload: { termsVersion: string; privacyVersion: string }) {
  const response = await fetchWithTimeout(`${baseUrl}/api/auth/legal`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Legal acceptance failed"));
  }
  return (await response.json()) as { user: AuthResponse["user"] };
}

export async function requestEmailVerification(email: string) {
  const response = await fetchWithTimeout(`${baseUrl}/api/auth/request-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Verification request failed"));
  }
  const payload = (await response.json()) as { ok?: boolean; previewUrl?: string };
  return payload.previewUrl ?? null;
}

export async function deleteAccount(token: string) {
  const response = await fetchWithTimeout(`${baseUrl}/api/auth/me`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok && response.status !== 204) {
    throw new Error(await readErrorMessage(response, "Account deletion failed"));
  }
}

export async function changePassword(token: string, currentPassword: string, newPassword: string) {
  const response = await fetchWithTimeout(`${baseUrl}/api/auth/change-password`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Password change failed"));
  }
  return (await response.json()) as { ok: true };
}

export type PromoValidation = {
  code: string;
  description: string | null;
  discountType: "percent" | "fixed";
  discountValue: number;
  discountCents: number;
  finalCents: number;
};

export async function validatePromoCode(payload: {
  code: string;
  listingId: string;
  from: string;
  to: string;
  token: string;
}) {
  const response = await fetchWithTimeout(`${baseUrl}/api/bookings/promo/validate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${payload.token}`,
    },
    body: JSON.stringify({
      code: payload.code,
      listingId: payload.listingId,
      from: payload.from,
      to: payload.to,
    }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "That promo code isn't valid."));
  }
  return (await response.json()) as PromoValidation;
}

export async function createBookingPaymentIntent(payload: {
  listingId: string;
  from: string;
  to: string;
  amountCents: number;
  mode?: "daily" | "monthly";
  vehiclePlate?: string | null;
  promoCode?: string | null;
  token: string;
}) {
  const e2eState = getMobileE2EState();
  if (isMobileE2EActive() && e2eState) {
    return {
      paymentIntentClientSecret: "pi_e2e_secret",
      paymentIntentId: e2eState.mockedPaymentIntentId,
      customerId: "cus_e2e",
      ephemeralKeySecret: "ephkey_e2e",
    };
  }
  const response = await fetchWithTimeout(`${baseUrl}/api/bookings/payment-intent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${payload.token}`,
    },
    body: JSON.stringify({
      listingId: payload.listingId,
      from: payload.from,
      to: payload.to,
      amountCents: payload.amountCents,
      mode: payload.mode ?? undefined,
      vehiclePlate: payload.vehiclePlate ?? undefined,
      promoCode: payload.promoCode ?? undefined,
    }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Payment setup failed"));
  }
  const data = (await response.json()) as {
    paymentIntentClientSecret?: string;
    paymentIntentId?: string;
    customerId?: string;
    ephemeralKeySecret?: string;
  };
  if (
    !data.paymentIntentClientSecret ||
    !data.customerId ||
    !data.ephemeralKeySecret ||
    !data.paymentIntentId
  ) {
    throw new Error("Payment setup failed: incomplete response");
  }
  return data as Required<typeof data>;
}

export async function confirmBookingPayment(payload: {
  paymentIntentId: string;
  status?: "confirmed" | "canceled";
  token: string;
}) {
  if (isMobileE2EActive()) {
    recordMockBooking();
    return;
  }
  const response = await fetchWithTimeout(`${baseUrl}/api/bookings/confirm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${payload.token}`,
    },
    body: JSON.stringify({
      paymentIntentId: payload.paymentIntentId,
      status: payload.status ?? "confirmed",
    }),
  });
  if (!response.ok) {
    if (response.status === 409) {
      throw new Error("Time slot already booked");
    }
    throw new Error(await readErrorMessage(response, "Payment confirmation failed"));
  }
}

export async function cancelBooking(payload: { token: string; bookingId: string }) {
  const response = await fetchWithTimeout(`${baseUrl}/api/bookings/${payload.bookingId}/cancel`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${payload.token}`,
    },
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Booking cancellation failed"));
  }
  return (await response.json()) as {
    ok: true;
    refunded?: boolean;
    alreadyCanceled?: boolean;
  };
}

export async function hostCancelBooking(payload: { token: string; bookingId: string }) {
  const response = await fetchWithTimeout(`${baseUrl}/api/bookings/${payload.bookingId}/host-cancel`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${payload.token}`,
    },
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Booking cancellation failed"));
  }
  return (await response.json()) as {
    ok: true;
    refunded?: boolean;
    alreadyCanceled?: boolean;
  };
}

export async function createReview(payload: {
  token: string;
  bookingId: string;
  rating: number;
  comment?: string;
}) {
  const response = await fetchWithTimeout(`${baseUrl}/api/reviews`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${payload.token}`,
    },
    body: JSON.stringify({
      bookingId: payload.bookingId,
      rating: payload.rating,
      comment: payload.comment,
    }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Review failed"));
  }
  return response.json() as Promise<{
    review: { id: string; rating: number; comment?: string };
  }>;
}

export type ListingReview = {
  id: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
  authorName?: string | null;
  role?: string | null;
};

export async function listListingReviews(listingId: string) {
  const response = await fetchWithTimeout(`${baseUrl}/api/reviews/listing/${listingId}`);
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Reviews fetch failed"));
  }
  const payload = (await response.json()) as { reviews?: ListingReview[] };
  return payload.reviews ?? [];
}

export type BookingSummary = {
  id: string;
  listingId: string;
  startTime: string;
  endTime: string;
  createdAt?: string | null;
  status: string;
  refundStatus?: string | null;
  refundedAt?: string | null;
  receiptUrl?: string | null;
  checkedInAt?: string | null;
  noShowAt?: string | null;
  cancellationSource?: "driver" | "host" | null;
  vehiclePlate?: string | null;
  accessCode?: string | null;
  arrivalInstructions?: string | null;
  amountCents: number;
  currency: string;
  title: string;
  address: string;
  imageUrls?: string[] | null;
  latitude?: number | null;
  longitude?: number | null;
  driverName?: string | null;
  driverPhone?: string | null;
  driverVehicleMake?: string | null;
  driverVehicleType?: string | null;
  driverVehicleColor?: string | null;
  hostPhone?: string | null;
};

export async function listMyBookings(token: string) {
  const e2eState = getMobileE2EState();
  if (isMobileE2EActive() && e2eState) {
    return {
      driverBookings: e2eState.bookings.map((booking) => ({ ...booking })),
      hostBookings: e2eState.hostBookings.map((booking) => ({ ...booking })),
    };
  }
  const response = await fetchWithTimeout(`${baseUrl}/api/bookings/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Booking fetch failed"));
  }
  const payload = (await response.json()) as {
    driverBookings?: BookingSummary[];
    hostBookings?: BookingSummary[];
  };
  return {
    driverBookings: payload.driverBookings ?? [],
    hostBookings: payload.hostBookings ?? [],
  };
}

export async function getBooking(token: string, bookingId: string, apiBase?: string) {
  const base = apiBase ?? baseUrl;
  const response = await fetchWithTimeout(`${base}/api/bookings/${bookingId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Booking fetch failed"));
  }
  return (await response.json()) as BookingSummary;
}

export async function checkInBooking(payload: { token: string; bookingId: string }) {
  const response = await fetchWithTimeout(`${baseUrl}/api/bookings/${payload.bookingId}/check-in`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${payload.token}`,
    },
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Check-in failed"));
  }
  return (await response.json()) as { ok: true; checkedInAt: string };
}

export async function createBookingExtensionIntent(payload: {
  token: string;
  bookingId: string;
  newEndTime: string;
}) {
  const response = await fetchWithTimeout(`${baseUrl}/api/bookings/${payload.bookingId}/extend-intent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${payload.token}`,
    },
    body: JSON.stringify({ newEndTime: payload.newEndTime }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Extend booking failed"));
  }
  return (await response.json()) as
    | {
        noCharge: true;
        newEndTime: string;
        newTotalCents: number;
      }
    | {
        paymentIntentClientSecret: string;
        paymentIntentId: string;
        customerId: string;
        ephemeralKeySecret: string;
        additionalAmountCents: number;
        newTotalCents: number;
        newEndTime: string;
      };
}

export async function confirmBookingExtension(payload: {
  token: string;
  bookingId: string;
  paymentIntentId: string;
  newEndTime: string;
  newTotalCents: number;
}) {
  const response = await fetchWithTimeout(`${baseUrl}/api/bookings/${payload.bookingId}/extend-confirm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${payload.token}`,
    },
    body: JSON.stringify({
      paymentIntentId: payload.paymentIntentId,
      newEndTime: payload.newEndTime,
      newTotalCents: payload.newTotalCents,
    }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Extend booking failed"));
  }
  return (await response.json()) as {
    ok: true;
    newEndTime: string;
    newTotalCents: number;
  };
}

export async function createListing(payload: {
  token: string;
  title: string;
  address: string;
  rateType?: "hourly" | "daily";
  pricePerDay: number;
  pricePerHour?: number | null;
  pricePerMonth?: number | null;
  availabilityText: string;
  latitude: number;
  longitude: number;
  imageUrls?: string[];
  amenities?: string[];
  accessCode?: string | null;
  arrivalInstructions?: string | null;
  permissionDeclared?: boolean;
  capacity?: number | null;
  description?: string | null;
  vehicleSizeSuitability?: string | null;
}) {
  if (isMobileE2EActive()) {
    return recordMockListingPublish() ?? "e2e-host-listing-1";
  }
  const response = await fetchWithTimeout(`${baseUrl}/api/listings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${payload.token}`,
    },
    body: JSON.stringify({
      title: payload.title,
      address: payload.address,
      rateType: payload.rateType ?? "daily",
      pricePerDay: payload.pricePerDay,
      pricePerHour: payload.pricePerHour ?? undefined,
      pricePerMonth: payload.pricePerMonth ?? undefined,
      availabilityText: payload.availabilityText,
      latitude: payload.latitude,
      longitude: payload.longitude,
      imageUrls: payload.imageUrls ?? [],
      amenities: payload.amenities ?? [],
      accessCode: payload.accessCode ?? null,
      arrivalInstructions: payload.arrivalInstructions ?? null,
      permissionDeclared: payload.permissionDeclared ?? false,
      vehicleSizeSuitability: payload.vehicleSizeSuitability ?? null,
      ...(payload.capacity != null && payload.capacity > 1 ? { capacity: payload.capacity } : {}),
      ...(payload.description != null ? { description: payload.description } : {}),
    }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Listing creation failed"));
  }
  const data = (await response.json()) as { id: string };
  return data.id;
}

export async function listHostListings(token: string) {
  const e2eState = getMobileE2EState();
  if (isMobileE2EActive() && e2eState) {
    return e2eState.hostListings.map((listing) => ({ ...listing }));
  }
  const response = await fetchWithTimeout(`${baseUrl}/api/listings`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Listing fetch failed"));
  }
  const payload = (await response.json()) as { listings?: any[] };
  return (payload.listings ?? []).map((listing) => ({
    id: listing.id,
    title: listing.title,
    address: listing.address,
    price_per_day: listing.price_per_day ?? listing.pricePerDay,
    price_per_hour: listing.price_per_hour ?? listing.pricePerHour ?? null,
    price_per_month: listing.price_per_month ?? listing.pricePerMonth ?? null,
    rate_type: listing.rate_type ?? listing.rateType ?? "daily",
    availability_text: listing.availability_text ?? listing.availability,
    image_urls: listing.image_urls ?? listing.imageUrls ?? [],
    amenities: listing.amenities ?? [],
    access_code: listing.access_code ?? listing.accessCode ?? null,
    arrival_instructions: listing.arrival_instructions ?? listing.arrivalInstructions ?? null,
    is_active: listing.is_active ?? listing.isActive ?? true,
    latitude: listing.latitude,
    longitude: listing.longitude,
  }));
}

export async function setListingPaused({
  token,
  listingId,
  paused,
}: {
  token: string;
  listingId: string;
  paused: boolean;
}) {
  const response = await fetchWithTimeout(`${baseUrl}/api/listings/${listingId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ isActive: !paused }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Could not update listing status"));
  }
}

export async function updateListing(payload: {
  token: string;
  listingId: string;
  title: string;
  address: string;
  rateType?: "hourly" | "daily";
  pricePerDay: number;
  pricePerHour?: number | null;
  pricePerMonth?: number | null;
  availabilityText: string;
  imageUrls?: string[];
  amenities?: string[];
  accessCode?: string | null;
  arrivalInstructions?: string | null;
  permissionDeclared?: boolean;
  capacity?: number | null;
  description?: string | null;
  vehicleSizeSuitability?: string | null;
}) {
  const response = await fetchWithTimeout(`${baseUrl}/api/listings/${payload.listingId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${payload.token}`,
    },
    body: JSON.stringify({
      title: payload.title,
      address: payload.address,
      rateType: payload.rateType ?? "daily",
      pricePerDay: payload.pricePerDay,
      pricePerHour: payload.pricePerHour ?? undefined,
      pricePerMonth: payload.pricePerMonth ?? undefined,
      availabilityText: payload.availabilityText,
      imageUrls: payload.imageUrls ?? [],
      amenities: payload.amenities ?? [],
      accessCode: payload.accessCode ?? null,
      arrivalInstructions: payload.arrivalInstructions ?? null,
      permissionDeclared: payload.permissionDeclared ?? false,
      vehicleSizeSuitability: payload.vehicleSizeSuitability ?? null,
      ...(payload.capacity != null && payload.capacity >= 1 ? { capacity: payload.capacity } : {}),
      ...(payload.description != null ? { description: payload.description } : {}),
    }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Listing update failed"));
  }
}

export async function deleteListing(payload: { token: string; listingId: string }) {
  const response = await fetchWithTimeout(`${baseUrl}/api/listings/${payload.listingId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${payload.token}`,
    },
  });
  if (!response.ok && response.status !== 204) {
    throw new Error(await readErrorMessage(response, "Listing deletion failed"));
  }
}

export async function getListingImageUploadUrl(payload: {
  token: string;
  contentType: string;
  fileSizeBytes: number;
}) {
  const response = await fetchWithTimeout(`${baseUrl}/api/listings/image-upload-url`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${payload.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ contentType: payload.contentType, fileSizeBytes: payload.fileSizeBytes }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Image upload failed"));
  }
  const payloadJson = (await response.json()) as {
    method?: "POST";
    uploadUrl?: string;
    uploadFields?: Record<string, string>;
    publicUrl?: string;
  };
  if (!payloadJson.uploadUrl || !payloadJson.uploadFields || !payloadJson.publicUrl) {
    throw new Error("Image upload failed: missing upload URL");
  }
  return payloadJson;
}

export type PaymentMethod = {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  is_default?: boolean;
  created_at?: string;
};

export type AvailabilityEntry = {
  id: string;
  kind: "open" | "blocked";
  startsAt: string;
  endsAt: string;
  repeatWeekdays?: number[] | null;
  repeatUntil?: string | null;
};

export async function listAvailability(payload: { token: string; listingId: string }) {
  const e2eState = getMobileE2EState();
  if (isMobileE2EActive() && e2eState) {
    return e2eState.availability.map((entry) => ({ ...entry }));
  }
  const response = await fetchWithTimeout(`${baseUrl}/api/host/listings/${payload.listingId}/availability`, {
    headers: {
      Authorization: `Bearer ${payload.token}`,
    },
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Availability fetch failed"));
  }
  const data = (await response.json()) as { availability?: AvailabilityEntry[] };
  return data.availability ?? [];
}

export async function createAvailabilityEntry(payload: {
  token: string;
  listingId: string;
  kind: "open" | "blocked";
  startsAt: string;
  endsAt: string;
  repeatWeekdays?: number[] | null;
  repeatUntil?: string | null;
}) {
  const e2eState = getMobileE2EState();
  if (isMobileE2EActive() && e2eState) {
    const entry: AvailabilityEntry = {
      id: `e2e-availability-${e2eState.availability.length + 1}`,
      kind: payload.kind,
      startsAt: payload.startsAt,
      endsAt: payload.endsAt,
      repeatWeekdays: payload.repeatWeekdays ?? null,
      repeatUntil: payload.repeatUntil ?? null,
    };
    e2eState.availability = [...e2eState.availability, entry];
    return entry;
  }
  const response = await fetchWithTimeout(`${baseUrl}/api/host/listings/${payload.listingId}/availability`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${payload.token}`,
    },
    body: JSON.stringify({
      kind: payload.kind,
      startsAt: payload.startsAt,
      endsAt: payload.endsAt,
      repeatWeekdays: payload.repeatWeekdays ?? undefined,
      repeatUntil: payload.repeatUntil ?? null,
    }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Availability update failed"));
  }
  const data = (await response.json()) as { availability?: AvailabilityEntry };
  return data.availability ?? null;
}

export async function deleteAvailabilityEntry(payload: {
  token: string;
  availabilityId: string;
}) {
  const e2eState = getMobileE2EState();
  if (isMobileE2EActive() && e2eState) {
    e2eState.availability = e2eState.availability.filter((entry) => entry.id !== payload.availabilityId);
    return;
  }
  const response = await fetchWithTimeout(
    `${baseUrl}/api/host/availability/${payload.availabilityId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${payload.token}`,
      },
    }
  );
  if (!response.ok && response.status !== 204) {
    throw new Error(await readErrorMessage(response, "Availability deletion failed"));
  }
}

export type PaymentHistoryItem = {
  id: string;
  booking_id?: string;
  amount: number;
  currency: string;
  status: string;
  description: string;
  created_at: string;
  receipt_url?: string;
};

export async function listPaymentMethods(token: string): Promise<PaymentMethod[]> {
  const response = await fetchWithTimeout(`${baseUrl}/api/payment-methods`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Payment methods fetch failed"));
  }
  const payload = (await response.json()) as { paymentMethods?: PaymentMethod[] };
  return payload.paymentMethods ?? [];
}

export async function createPaymentMethodSetupIntent(token: string) {
  const response = await fetchWithTimeout(`${baseUrl}/api/payment-methods`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ mode: "setup_intent" }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Payment setup failed"));
  }
  const payload = (await response.json()) as { clientSecret?: string; client_secret?: string };
  const clientSecret = payload.clientSecret ?? payload.client_secret;
  if (!clientSecret) {
    throw new Error("Payment setup failed: missing client secret");
  }
  return clientSecret;
}

export async function deletePaymentMethod(token: string, id: string) {
  const response = await fetchWithTimeout(`${baseUrl}/api/payment-methods/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok && response.status !== 204) {
    throw new Error(await readErrorMessage(response, "Payment method deletion failed"));
  }
}

export async function setDefaultPaymentMethod(token: string, id: string) {
  const response = await fetchWithTimeout(`${baseUrl}/api/payment-methods/${id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Payment method update failed"));
  }
}

export async function listPaymentHistory(token: string): Promise<PaymentHistoryItem[]> {
  const response = await fetchWithTimeout(`${baseUrl}/api/payments/history`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Payment history fetch failed"));
  }
  const payload = (await response.json()) as { payments?: PaymentHistoryItem[] };
  return payload.payments ?? [];
}

export async function retryPayment(token: string, id: string) {
  const response = await fetchWithTimeout(`${baseUrl}/api/payments/${id}/retry`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Payment retry failed"));
  }
}
