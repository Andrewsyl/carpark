import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import {
  acceptLegal as apiAcceptLegal,
  login as apiLogin,
  oauthLoginFacebook,
  oauthLoginGoogle,
  refreshSession,
  register as apiRegister,
  revokeSession,
} from "./api";

type AuthUser = {
  id: string;
  email: string;
  role?: string;
  emailVerified?: boolean;
  termsVersion?: string | null;
  termsAcceptedAt?: string | null;
  privacyVersion?: string | null;
  privacyAcceptedAt?: string | null;
};

type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, legal: { termsVersion: string; privacyVersion: string }) => Promise<string | null>;
  loginWithOAuth: (provider: "google" | "facebook", token: string) => Promise<AuthUser>;
  acceptLegal: (payload: { termsVersion: string; privacyVersion: string }) => Promise<AuthUser>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "authToken";
const USER_KEY = "authUser";
const REFRESH_TOKEN_KEY = "authRefreshToken";

type JwtPayload = {
  exp?: number;
  iat?: number;
};

const decodeJwtPayload = (token: string): JwtPayload | null => {
  try {
    const payloadSegment = token.split(".")[1];
    if (!payloadSegment) return null;
    const normalized = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
    const decoded =
      typeof globalThis.atob === "function"
        ? globalThis.atob(normalized)
        : typeof (globalThis as any).Buffer !== "undefined"
          ? (globalThis as any).Buffer.from(normalized, "base64").toString("utf8")
          : null;
    if (!decoded) return null;
    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const restore = async () => {
      const storedToken = await AsyncStorage.getItem(TOKEN_KEY);
      const storedUser = await AsyncStorage.getItem(USER_KEY);
      const storedRefreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
      if (storedToken) {
        const payload = decodeJwtPayload(storedToken);
        const expiresAt = payload?.exp ? payload.exp * 1000 : null;
        if (expiresAt && expiresAt <= Date.now()) {
          if (storedRefreshToken) {
            try {
              const refreshed = await refreshSession(storedRefreshToken);
              setToken(refreshed.token);
              setUser(refreshed.user);
              const nextRefreshToken = refreshed.refreshToken ?? storedRefreshToken;
              setRefreshToken(nextRefreshToken);
              await AsyncStorage.setItem(TOKEN_KEY, refreshed.token);
              await AsyncStorage.setItem(USER_KEY, JSON.stringify(refreshed.user));
              await AsyncStorage.setItem(REFRESH_TOKEN_KEY, nextRefreshToken);
              setLoading(false);
              return;
            } catch {
              await AsyncStorage.removeItem(TOKEN_KEY);
              await AsyncStorage.removeItem(USER_KEY);
              await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
              setToken(null);
              setUser(null);
              setRefreshToken(null);
              setLoading(false);
              return;
            }
          }
          await AsyncStorage.removeItem(TOKEN_KEY);
          await AsyncStorage.removeItem(USER_KEY);
          await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
          setToken(null);
          setUser(null);
          setRefreshToken(null);
          setLoading(false);
          return;
        }
      }
      setToken(storedToken);
      setUser(storedUser ? (JSON.parse(storedUser) as AuthUser) : null);
      setRefreshToken(storedRefreshToken);
      setLoading(false);
    };
    void restore();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await apiLogin(email, password);
    setToken(response.token);
    setUser(response.user);
    const nextRefreshToken = response.refreshToken ?? null;
    setRefreshToken(nextRefreshToken);
    await AsyncStorage.setItem(TOKEN_KEY, response.token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(response.user));
    if (nextRefreshToken) {
      await AsyncStorage.setItem(REFRESH_TOKEN_KEY, nextRefreshToken);
    }
  }, []);

  const register = useCallback(
    async (email: string, password: string, legal: { termsVersion: string; privacyVersion: string }) => {
      const response = await apiRegister(email, password, legal);
      setToken(response.token);
      setUser(response.user);
      const nextRefreshToken = response.refreshToken ?? null;
      setRefreshToken(nextRefreshToken);
      await AsyncStorage.setItem(TOKEN_KEY, response.token);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(response.user));
      if (nextRefreshToken) {
        await AsyncStorage.setItem(REFRESH_TOKEN_KEY, nextRefreshToken);
      }
      return response.previewUrl ?? null;
    },
    []
  );

  const logout = useCallback(async () => {
    const currentToken = token;
    setToken(null);
    setUser(null);
    setRefreshToken(null);
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(USER_KEY);
    await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    if (currentToken) {
      try {
        await revokeSession(currentToken);
      } catch {
        // Ignore server logout errors.
      }
    }
    try {
      await GoogleSignin.revokeAccess();
      await GoogleSignin.signOut();
    } catch {
      // Ignore Google sign-out failures; local session is already cleared.
    }
  }, []);

  const loginWithOAuth = useCallback(async (provider: "google" | "facebook", tokenValue: string) => {
    const response =
      provider === "google"
        ? await oauthLoginGoogle(tokenValue)
        : await oauthLoginFacebook(tokenValue);
    setToken(response.token);
    setUser(response.user);
    const nextRefreshToken = response.refreshToken ?? null;
    setRefreshToken(nextRefreshToken);
    await AsyncStorage.setItem(TOKEN_KEY, response.token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(response.user));
    if (nextRefreshToken) {
      await AsyncStorage.setItem(REFRESH_TOKEN_KEY, nextRefreshToken);
    }
    return response.user;
  }, []);

  const acceptLegal = useCallback(
    async (payload: { termsVersion: string; privacyVersion: string }) => {
      if (!token) {
        throw new Error("No active session");
      }
      const response = await apiAcceptLegal(token, payload);
      setUser(response.user);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(response.user));
      return response.user;
    },
    [token]
  );

  useEffect(() => {
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    if (!token) return;
    const payload = decodeJwtPayload(token);
    if (!payload?.exp) return;
    const expiresAt = payload.exp * 1000;
    const delayMs = expiresAt - Date.now();
    if (delayMs <= 0) {
      void logout();
      return;
    }
    const refreshDelayMs = Math.max(delayMs - 60_000, 0);
    if (refreshToken) {
      refreshTimerRef.current = setTimeout(async () => {
        try {
          const refreshed = await refreshSession(refreshToken);
          setToken(refreshed.token);
          setUser(refreshed.user);
          const nextRefreshToken = refreshed.refreshToken ?? refreshToken;
          setRefreshToken(nextRefreshToken);
          await AsyncStorage.setItem(TOKEN_KEY, refreshed.token);
          await AsyncStorage.setItem(USER_KEY, JSON.stringify(refreshed.user));
          await AsyncStorage.setItem(REFRESH_TOKEN_KEY, nextRefreshToken);
        } catch {
          void logout();
        }
      }, refreshDelayMs);
    }
    logoutTimerRef.current = setTimeout(() => {
      void logout();
    }, delayMs);
    return () => {
      if (logoutTimerRef.current) {
        clearTimeout(logoutTimerRef.current);
        logoutTimerRef.current = null;
      }
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [token, refreshToken, logout]);

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      login,
      register,
      loginWithOAuth,
      acceptLegal,
      logout,
    }),
    [token, user, loading, login, register, loginWithOAuth, acceptLegal, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
