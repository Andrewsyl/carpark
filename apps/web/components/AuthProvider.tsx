"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { login, register, type AuthResponse } from "../lib/api";
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

function persistSession(session: { token: string; user: User }) {
  localStorage.setItem("auth_token", session.token);
  localStorage.setItem("auth_user", JSON.stringify(session.user));
}

function readSession() {
  const token = localStorage.getItem("auth_token");
  const userRaw = localStorage.getItem("auth_user");
  if (!token || !userRaw) return null;
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
  const { setLoading, setError: setGlobalError } = useAppStatus();
  const [error, setError] = useState<string | null>(null);
  const [loading, setAuthLoading] = useState<boolean>(true);
  const emailVerified = !!user?.emailVerified;

  useEffect(() => {
    const session = readSession();
    if (session) {
      setUser(session.user);
      setToken(session.token);
    }
    setAuthLoading(false);
    setLoading(false);
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
      persistSession(res);
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
      persistSession(res);
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
    setUser(null);
    setToken(null);
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    setAuthLoading(false);
  };

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
