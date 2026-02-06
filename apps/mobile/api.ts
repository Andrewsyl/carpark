import type { ListingDetail, ListingSummary, SearchParams } from "./types";

const baseUrl = process.env.EXPO_PUBLIC_API_BASE ?? "http://localhost:4000";

type AuthResponse = {
  token: string;
  refreshToken?: string;
  user: {
    id: string;
    email: string;
    role?: string;
    emailVerified?: boolean;
    termsVersion?: string | null;
    termsAcceptedAt?: string | null;
    privacyVersion?: string | null;
    privacyAcceptedAt?: string | null;
  };
};

async function readErrorMessage(response: Response, fallback: string) {
  try {
    const data = (await response.clone().json()) as { error?: string; message?: string };
    if (typeof data?.error === "string") return data.error;
    if (typeof data?.message === "string") return data.message;
  } catch {
    // Ignore json parse errors.
  }
  try {
    const text = await response.text();
    if (text) return text;
  } catch {
    // Ignore text errors.
  }
  return `${fallback} (${response.status})`;
}

export async function searchListings(params: SearchParams) {
  const query = new URLSearchParams();
  query.set("lat", params.lat);
  query.set("lng", params.lng);
  query.set("radiusKm", params.radiusKm);
  query.set("from", params.from);
  query.set("to", params.to);
  if (params.includeUnavailable) query.set("includeUnavailable", "true");
  if (params.priceMin) query.set("priceMin", params.priceMin);
  if (params.priceMax) query.set("priceMax", params.priceMax);
  if (params.coveredParking) query.set("coveredParking", "true");
  if (params.evCharging) query.set("evCharging", "true");
  if (params.securityLevel) query.set("securityLevel", params.securityLevel);
  if (params.vehicleSize) query.set("vehicleSize", params.vehicleSize);
  if (params.instantBook) query.set("instantBook", "true");
  const response = await fetch(`${baseUrl}/api/listings/search?${query.toString()}`);
  if (!response.ok) {
    throw new Error(`Search failed (${response.status})`);
  }
  const payload = (await response.json()) as { spaces?: ListingSummary[] };
  const spaces = payload.spaces ?? [];
  return spaces.map((space: any) => ({
    id: space.id,
    title: space.title,
    address: space.address,
    price_per_day: space.price_per_day ?? space.pricePerDay,
    is_available: space.is_available ?? space.isAvailable ?? null,
    rating: space.rating,
    rating_count: space.rating_count ?? space.ratingCount,
    availability_text: space.availability_text ?? space.availability,
    amenities: space.amenities ?? null,
    access_code: space.access_code ?? space.accessCode ?? null,
    latitude: space.latitude,
    longitude: space.longitude,
    distance_m:
      space.distance_m ??
      (typeof space.distanceKm === "number" ? Math.round(space.distanceKm * 1000) : null),
    image_urls: space.image_urls ?? space.imageUrls ?? null,
  }));
}

export async function getListing(
  id: string,
  params?: {
    from?: string;
    to?: string;
  }
) {
  const query = new URLSearchParams();
  if (params?.from) query.set("from", params.from);
  if (params?.to) query.set("to", params.to);
  const queryString = query.toString();
  const url = queryString
    ? `${baseUrl}/api/listings/${id}?${queryString}`
    : `${baseUrl}/api/listings/${id}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Listing failed (${response.status})`);
  }
  const payload = (await response.json()) as { listing: ListingDetail };
  const listing: any = payload.listing ?? {};
  return {
    ...listing,
    price_per_day: listing.price_per_day ?? listing.pricePerDay,
    is_available: listing.is_available ?? listing.isAvailable ?? null,
    rating_count: listing.rating_count ?? listing.ratingCount,
    availability_text: listing.availability_text ?? listing.availability,
    availabilitySchedule:
      listing.availabilitySchedule ??
      listing.availability_schedule ??
      listing.availabilitySchedule,
    amenities: listing.amenities ?? null,
    access_code: listing.access_code ?? listing.accessCode ?? null,
    permission_declared:
      listing.permission_declared ?? listing.permissionDeclared ?? null,
    image_urls: listing.image_urls ?? listing.imageUrls ?? null,
  } as ListingDetail;
}

export async function listFavorites(token: string) {
  const response = await fetch(`${baseUrl}/api/favorites`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Favorites failed (${response.status})`);
  }
  const payload = (await response.json()) as { favorites?: ListingSummary[] };
  return payload.favorites ?? [];
}

export async function addFavorite(token: string, listingId: string) {
  const response = await fetch(`${baseUrl}/api/favorites`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ listingId }),
  });
  if (!response.ok) {
    throw new Error(`Favorite failed (${response.status})`);
  }
  return (await response.json()) as { listingId: string };
}

export async function removeFavorite(token: string, listingId: string) {
  const response = await fetch(`${baseUrl}/api/favorites/${listingId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok && response.status !== 204) {
    throw new Error(`Remove favorite failed (${response.status})`);
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
  const response = await fetch(`${baseUrl}/api/notifications/register`, {
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
  const response = await fetch(`${baseUrl}/api/notifications/register`, {
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

export async function getHostEarningsSummary(token: string) {
  const response = await fetch(`${baseUrl}/api/host/earnings`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Earnings failed (${response.status})`);
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
  const response = await fetch(`${baseUrl}/api/host/payout`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Payout status failed (${response.status})`);
  }
  return (await response.json()) as HostPayoutStatus;
}

export async function createHostPayoutLink(payload: {
  token: string;
  accountId?: string | null;
  returnUrl?: string;
  refreshUrl?: string;
}) {
  const response = await fetch(`${baseUrl}/api/host/payout`, {
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
    throw new Error(`Payout setup failed (${response.status})`);
  }
  return (await response.json()) as { accountId: string; onboardingUrl: string | null };
}

export async function runHostPayouts(token: string) {
  const response = await fetch(`${baseUrl}/api/host/payouts/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Payout run failed (${response.status})`);
  }
  return (await response.json()) as { processed: number };
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
  const response = await fetch(`${baseUrl}/api/admin/users`, {
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
  const response = await fetch(`${baseUrl}/api/admin/users/${userId}`, {
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
  const response = await fetch(`${baseUrl}/api/admin/listings`, {
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
  const response = await fetch(`${baseUrl}/api/admin/listings/${listingId}`, {
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

export async function sendSupportMessage(token: string, payload: { subject: string; message: string }) {
  const response = await fetch(`${baseUrl}/api/support`, {
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
  const response = await fetch(`${baseUrl}/api/auth/login`, {
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
  payload?: { termsVersion: string; privacyVersion: string }
) {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
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
  const response = await fetch(`${baseUrl}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Session refresh failed"));
  }
  return (await response.json()) as AuthResponse;
}

export async function revokeSession(token: string) {
  const response = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Logout failed"));
  }
  return (await response.json()) as { ok: boolean };
}

export async function requestPasswordReset(email: string) {
  const response = await fetch(`${baseUrl}/api/auth/request-password-reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Reset request failed"));
  }
  return (await response.json()) as { ok: boolean; previewUrl?: string };
}

export async function resetPassword(token: string, password: string) {
  const response = await fetch(`${baseUrl}/api/auth/reset-password`, {
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
  const response = await fetch(`${baseUrl}/api/auth/oauth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Google sign-in failed"));
  }
  return (await response.json()) as AuthResponse;
}

export async function oauthLoginFacebook(accessToken: string) {
  const response = await fetch(`${baseUrl}/api/auth/oauth/facebook`, {
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
  const response = await fetch(`${baseUrl}/api/auth/legal`, {
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
  const response = await fetch(`${baseUrl}/api/auth/request-verification`, {
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
  const response = await fetch(`${baseUrl}/api/auth/me`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok && response.status !== 204) {
    throw new Error(await readErrorMessage(response, "Account deletion failed"));
  }
}

export async function createBooking(payload: {
  listingId: string;
  from: string;
  to: string;
  amountCents: number;
  vehiclePlate?: string | null;
  token: string;
}) {
  const response = await fetch(`${baseUrl}/api/bookings`, {
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
      vehiclePlate: payload.vehiclePlate ?? undefined,
    }),
  });
  if (!response.ok) {
    throw new Error(`Booking failed (${response.status})`);
  }
  const data = (await response.json()) as { checkoutUrl: string };
  return data.checkoutUrl;
}

export async function createBookingPaymentIntent(payload: {
  listingId: string;
  from: string;
  to: string;
  amountCents: number;
  vehiclePlate?: string | null;
  token: string;
}) {
  const response = await fetch(`${baseUrl}/api/bookings/payment-intent`, {
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
      vehiclePlate: payload.vehiclePlate ?? undefined,
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
  const response = await fetch(`${baseUrl}/api/bookings/confirm`, {
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
  const response = await fetch(`${baseUrl}/api/bookings/${payload.bookingId}/cancel`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${payload.token}`,
    },
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Booking cancelation failed"));
  }
}

export async function createReview(payload: {
  token: string;
  bookingId: string;
  rating: number;
  comment?: string;
}) {
  const response = await fetch(`${baseUrl}/api/reviews`, {
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
  const response = await fetch(`${baseUrl}/api/reviews/listing/${listingId}`);
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
  status: string;
  refundStatus?: string | null;
  refundedAt?: string | null;
  receiptUrl?: string | null;
  checkedInAt?: string | null;
  noShowAt?: string | null;
  vehiclePlate?: string | null;
  accessCode?: string | null;
  amountCents: number;
  currency: string;
  title: string;
  address: string;
  imageUrls?: string[] | null;
  latitude?: number | null;
  longitude?: number | null;
};

export async function listMyBookings(token: string) {
  const response = await fetch(`${baseUrl}/api/bookings/me`, {
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

export async function checkInBooking(payload: { token: string; bookingId: string }) {
  const response = await fetch(`${baseUrl}/api/bookings/${payload.bookingId}/check-in`, {
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
  const response = await fetch(`${baseUrl}/api/bookings/${payload.bookingId}/extend-intent`, {
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
  const response = await fetch(`${baseUrl}/api/bookings/${payload.bookingId}/extend-confirm`, {
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
  pricePerDay: number;
  availabilityText: string;
  latitude: number;
  longitude: number;
  imageUrls?: string[];
  amenities?: string[];
  accessCode?: string | null;
  permissionDeclared?: boolean;
}) {
  const response = await fetch(`${baseUrl}/api/listings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${payload.token}`,
    },
    body: JSON.stringify({
      title: payload.title,
      address: payload.address,
      pricePerDay: payload.pricePerDay,
      availabilityText: payload.availabilityText,
      latitude: payload.latitude,
      longitude: payload.longitude,
      imageUrls: payload.imageUrls ?? [],
      amenities: payload.amenities ?? [],
      accessCode: payload.accessCode ?? null,
      permissionDeclared: payload.permissionDeclared ?? false,
    }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Listing creation failed"));
  }
  const data = (await response.json()) as { id: string };
  return data.id;
}

export async function listHostListings(token: string) {
  const response = await fetch(`${baseUrl}/api/listings`, {
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
    availability_text: listing.availability_text ?? listing.availability,
    image_urls: listing.image_urls ?? listing.imageUrls ?? [],
    amenities: listing.amenities ?? [],
    access_code: listing.access_code ?? listing.accessCode ?? null,
    latitude: listing.latitude,
    longitude: listing.longitude,
  }));
}

export async function updateListing(payload: {
  token: string;
  listingId: string;
  title: string;
  address: string;
  pricePerDay: number;
  availabilityText: string;
  imageUrls?: string[];
  amenities?: string[];
  accessCode?: string | null;
  permissionDeclared?: boolean;
}) {
  const response = await fetch(`${baseUrl}/api/listings/${payload.listingId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${payload.token}`,
    },
    body: JSON.stringify({
      title: payload.title,
      address: payload.address,
      pricePerDay: payload.pricePerDay,
      availabilityText: payload.availabilityText,
      imageUrls: payload.imageUrls ?? [],
      amenities: payload.amenities ?? [],
      accessCode: payload.accessCode ?? null,
      permissionDeclared: payload.permissionDeclared ?? false,
    }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Listing update failed"));
  }
}

export async function deleteListing(payload: { token: string; listingId: string }) {
  const response = await fetch(`${baseUrl}/api/listings/${payload.listingId}`, {
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
}) {
  const response = await fetch(`${baseUrl}/api/listings/image-upload-url`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${payload.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ contentType: payload.contentType }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Image upload failed"));
  }
  const payloadJson = (await response.json()) as { signedUrl?: string; publicUrl?: string };
  if (!payloadJson.signedUrl || !payloadJson.publicUrl) {
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
  const response = await fetch(`${baseUrl}/api/host/listings/${payload.listingId}/availability`, {
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
  const response = await fetch(`${baseUrl}/api/host/listings/${payload.listingId}/availability`, {
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
  const response = await fetch(
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
  const response = await fetch(`${baseUrl}/api/payment-methods`, {
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
  const response = await fetch(`${baseUrl}/api/payment-methods`, {
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
  const response = await fetch(`${baseUrl}/api/payment-methods/${id}`, {
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
  const response = await fetch(`${baseUrl}/api/payment-methods/${id}`, {
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
  const response = await fetch(`${baseUrl}/api/payments/history`, {
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
  const response = await fetch(`${baseUrl}/api/payments/${id}/retry`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Payment retry failed"));
  }
}
