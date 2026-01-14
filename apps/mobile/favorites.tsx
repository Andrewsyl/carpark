import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ListingDetail, ListingSummary } from "./types";
import { addFavorite as apiAddFavorite, listFavorites, removeFavorite } from "./api";
import { useAuth } from "./auth";

type FavoritesContextValue = {
  favorites: ListingSummary[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isFavorite: (listingId: string) => boolean;
  add: (listing: ListingSummary) => Promise<void>;
  remove: (listingId: string) => Promise<void>;
  toggle: (listing: ListingSummary) => Promise<void>;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

const normalizeListing = (listing: ListingSummary | ListingDetail): ListingSummary => ({
  id: listing.id,
  title: listing.title,
  address: listing.address,
  price_per_day: listing.price_per_day,
  rating: listing.rating ?? null,
  rating_count: listing.rating_count ?? null,
  availability_text: listing.availability_text ?? null,
  amenities: listing.amenities ?? null,
  latitude: listing.latitude ?? null,
  longitude: listing.longitude ?? null,
  image_urls: listing.image_urls ?? listing.imageUrls ?? null,
});

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [favorites, setFavorites] = useState<ListingSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token) {
      setFavorites([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await listFavorites(token);
      setFavorites(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load favourites");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const favoriteIds = useMemo(() => new Set(favorites.map((item) => item.id)), [favorites]);

  const isFavorite = useCallback(
    (listingId: string) => favoriteIds.has(listingId),
    [favoriteIds]
  );

  const add = useCallback(
    async (listing: ListingSummary) => {
      if (!token) return;
      const normalized = normalizeListing(listing);
      let added = false;
      setFavorites((prev) => {
        if (prev.some((item) => item.id === normalized.id)) return prev;
        added = true;
        return [normalized, ...prev];
      });
      if (!added) return;
      try {
        await apiAddFavorite(token, listing.id);
      } catch (err) {
        setFavorites((prev) => prev.filter((item) => item.id !== normalized.id));
        setError(err instanceof Error ? err.message : "Could not save favourite");
      }
    },
    [token]
  );

  const remove = useCallback(
    async (listingId: string) => {
      if (!token) return;
      let removed: ListingSummary | undefined;
      setFavorites((prev) => {
        const next = prev.filter((item) => {
          if (item.id === listingId) removed = item;
          return item.id !== listingId;
        });
        return next;
      });
      try {
        await removeFavorite(token, listingId);
      } catch (err) {
        if (removed) {
          setFavorites((prev) => [removed!, ...prev]);
        }
        setError(err instanceof Error ? err.message : "Could not remove favourite");
      }
    },
    [token]
  );

  const toggle = useCallback(
    async (listing: ListingSummary) => {
      if (!token) return;
      if (favoriteIds.has(listing.id)) {
        await remove(listing.id);
      } else {
        await add(listing);
      }
    },
    [token, favoriteIds, add, remove]
  );

  const value = useMemo(
    () => ({
      favorites,
      loading,
      error,
      refresh,
      isFavorite,
      add,
      remove,
      toggle,
    }),
    [favorites, loading, error, refresh, isFavorite, add, remove, toggle]
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) {
    throw new Error("useFavorites must be used within FavoritesProvider");
  }
  return ctx;
}
