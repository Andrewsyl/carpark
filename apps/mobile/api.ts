import type { ListingDetail, ListingSummary, SearchParams } from "./types";

const baseUrl = process.env.EXPO_PUBLIC_API_BASE ?? "http://localhost:4000";

type AuthResponse = {
  token: string;
  user: {
    id: string;
    email: string;
    role?: string;
    emailVerified?: boolean;
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
    rating: space.rating,
    rating_count: space.rating_count ?? space.ratingCount,
    availability_text: space.availability_text ?? space.availability,
    amenities: space.amenities ?? null,
    latitude: space.latitude,
    longitude: space.longitude,
    distance_m:
      space.distance_m ??
      (typeof space.distanceKm === "number" ? Math.round(space.distanceKm * 1000) : null),
    image_urls: space.image_urls ?? space.imageUrls ?? null,
  }));
}

export async function getListing(id: string) {
  const response = await fetch(`${baseUrl}/api/listings/${id}`);
  if (!response.ok) {
    throw new Error(`Listing failed (${response.status})`);
  }
  const payload = (await response.json()) as { listing: ListingDetail };
  const listing: any = payload.listing ?? {};
  return {
    ...listing,
    price_per_day: listing.price_per_day ?? listing.pricePerDay,
    rating_count: listing.rating_count ?? listing.ratingCount,
    availability_text: listing.availability_text ?? listing.availability,
    amenities: listing.amenities ?? null,
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

export async function register(email: string, password: string) {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Sign up failed"));
  }
  return (await response.json()) as AuthResponse;
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
  startTime: string;
  endTime: string;
  status: string;
  amountCents: number;
  currency: string;
  title: string;
  address: string;
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

export type PaymentMethod = {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  is_default?: boolean;
  created_at?: string;
};

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
