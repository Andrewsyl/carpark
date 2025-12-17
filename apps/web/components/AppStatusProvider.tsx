"use client";

import { createContext, useContext, useState, useMemo } from "react";

type AppStatusContextValue = {
  isLoading: boolean;
  error: string | null;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
};

const AppStatusContext = createContext<AppStatusContextValue | undefined>(undefined);

export function AppStatusProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const value = useMemo(
    () => ({
      isLoading,
      error,
      setLoading: setIsLoading,
      setError,
    }),
    [isLoading, error]
  );

  return <AppStatusContext.Provider value={value}>{children}</AppStatusContext.Provider>;
}

export function useAppStatus() {
  const context = useContext(AppStatusContext);
  if (!context) {
    throw new Error("useAppStatus must be used within an AppStatusProvider");
  }
  return context;
}
