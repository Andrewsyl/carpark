"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { login, refreshSession, register, revokeSession, type AuthResponse } from "../lib/api";
import { useAppStatus } from "./AppStatusProvider";

type User = AuthResponse["user"];

type AuthContextValue = {
  user: User | null;
  token: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  error: string | null;
  loading: boolean;
  emailVerified: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type JwtPayload = {
  exp?: number;
  iat?: number;
};

const decodeJwtPayload = (token: string): JwtPayload | null => {
  try {
    const payloadSegment = token.split(".")[1];
    if (!payloadSegment) return null;
    const normalized = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(normalized);
    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
};

function persistSession(session: { token: string; user: User }) {
  localStorage.setItem("auth_token", session.token);
  localStorage.setItem("auth_user", JSON.stringify(session.user));
}

function readSession() {
  const token = localStorage.getItem("auth_token");
  const userRaw = localStorage.getItem("auth_user");
  if (!token || !userRaw) return null;
  const payload = decodeJwtPayload(token);
  const expiresAt = payload?.exp ? payload.exp * 1000 : null;
  if (expiresAt && expiresAt <= Date.now()) {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    return null;
  }
  try {
    const user = JSON.parse(userRaw) as User;
    return { token, user };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const { setLoading, setError: setGlobalError } = useAppStatus();
  const [error, setError] = useState<string | null>(null);
  const [loading, setAuthLoading] = useState<boolean>(true);
  const emailVerified = !!user?.emailVerified;
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const restore = async () => {
      const session = readSession();
      const storedRefresh = localStorage.getItem("auth_refresh");
      if (session) {
        const payload = decodeJwtPayload(session.token);
        const expiresAt = payload?.exp ? payload.exp * 1000 : null;
        if (expiresAt && expiresAt <= Date.now() && storedRefresh) {
          try {
            const refreshed = await refreshSession(storedRefresh);
            setUser(refreshed.user);
            setToken(refreshed.token);
            const nextRefreshToken = refreshed.refreshToken ?? storedRefresh;
            setRefreshToken(nextRefreshToken);
            localStorage.setItem("auth_token", refreshed.token);
            localStorage.setItem("auth_user", JSON.stringify(refreshed.user));
            localStorage.setItem("auth_refresh", nextRefreshToken);
            setAuthLoading(false);
            setLoading(false);
            return;
          } catch {
            localStorage.removeItem("auth_token");
            localStorage.removeItem("auth_user");
            localStorage.removeItem("auth_refresh");
          }
        }
        setUser(session.user);
        setToken(session.token);
        setRefreshToken(storedRefresh);
      }
      setAuthLoading(false);
      setLoading(false);
    };
    void restore();
  }, [setLoading]);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    setAuthLoading(true);
    setError(null);
    setGlobalError(null);
    try {
      const res = await login(email, password);
      console.debug("auth: login response", res);
      setUser(res.user);
      setToken(res.token);
      const nextRefreshToken = res.refreshToken ?? null;
      setRefreshToken(nextRefreshToken);
      persistSession(res);
      if (nextRefreshToken) {
        localStorage.setItem("auth_refresh", nextRefreshToken);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed";
      setError(msg);
      setGlobalError(msg);
      throw err;
    } finally {
      setLoading(false);
      setAuthLoading(false);
    }
  };

  const signUp = async (email: string, password: string) => {
    setLoading(true);
    setAuthLoading(true);
    setError(null);
    setGlobalError(null);
    try {
      const res = await register(email, password);
      console.debug("auth: signup response", res);
      setUser(res.user);
      setToken(res.token);
      const nextRefreshToken = res.refreshToken ?? null;
      setRefreshToken(nextRefreshToken);
      persistSession(res);
      if (nextRefreshToken) {
        localStorage.setItem("auth_refresh", nextRefreshToken);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Signup failed";
      setError(msg);
      setGlobalError(msg);
      throw err;
    } finally {
      setLoading(false);
      setAuthLoading(false);
    }
  };

  const signOut = () => {
    const currentToken = token;
    setUser(null);
    setToken(null);
    setRefreshToken(null);
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    localStorage.removeItem("auth_refresh");
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    if (currentToken) {
      void revokeSession(currentToken);
    }
    setAuthLoading(false);
  };

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
      signOut();
      return;
    }
    const refreshDelayMs = Math.max(delayMs - 60_000, 0);
    if (refreshToken) {
      refreshTimerRef.current = setTimeout(async () => {
        try {
          const refreshed = await refreshSession(refreshToken);
          setUser(refreshed.user);
          setToken(refreshed.token);
          const nextRefreshToken = refreshed.refreshToken ?? refreshToken;
          setRefreshToken(nextRefreshToken);
          localStorage.setItem("auth_token", refreshed.token);
          localStorage.setItem("auth_user", JSON.stringify(refreshed.user));
          localStorage.setItem("auth_refresh", nextRefreshToken);
        } catch {
          signOut();
        }
      }, refreshDelayMs);
    }
    logoutTimerRef.current = setTimeout(() => {
      signOut();
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
  }, [token, refreshToken]);

  useEffect(() => {
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
    if (!token) return;
    const payload = decodeJwtPayload(token);
    if (!payload?.exp) return;
    const expiresAt = payload.exp * 1000;
    const delayMs = expiresAt - Date.now();
    if (delayMs <= 0) {
      signOut();
      return;
    }
    logoutTimerRef.current = setTimeout(() => {
      signOut();
    }, delayMs);
    return () => {
      if (logoutTimerRef.current) {
        clearTimeout(logoutTimerRef.current);
        logoutTimerRef.current = null;
      }
    };
  }, [token]);

  const value = useMemo(
    () => ({ user, token, signIn, signUp, signOut, error, loading: loading, emailVerified, setUser, setToken }),
    [user, token, error, loading, emailVerified]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
