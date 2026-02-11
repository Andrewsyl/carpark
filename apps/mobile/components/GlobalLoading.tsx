import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type GlobalLoadingState = {
  visible: boolean;
  message?: string;
};

type GlobalLoadingApi = {
  state: GlobalLoadingState;
  show: (message?: string) => void;
  hide: () => void;
  reset: () => void;
};

const GlobalLoadingContext = createContext<GlobalLoadingApi | null>(null);

export function GlobalLoadingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GlobalLoadingState>({ visible: false, message: "Loading..." });
  const pendingCount = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message?: string) => {
    pendingCount.current += 1;
    if (message) {
      setState((prev) => ({ ...prev, message }));
    }
    if (timerRef.current) return;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (pendingCount.current > 0) {
        setState((prev) => ({ ...prev, visible: true }));
      }
    }, 250);
  }, []);

  const hide = useCallback(() => {
    pendingCount.current = Math.max(0, pendingCount.current - 1);
    if (pendingCount.current > 0) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setState((prev) => ({ ...prev, visible: false }));
  }, []);

  const reset = useCallback(() => {
    pendingCount.current = 0;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setState((prev) => ({ ...prev, visible: false }));
  }, []);

  const value = useMemo<GlobalLoadingApi>(
    () => ({ state, show, hide, reset }),
    [state, show, hide, reset]
  );

  return <GlobalLoadingContext.Provider value={value}>{children}</GlobalLoadingContext.Provider>;
}

export function useGlobalLoading() {
  const ctx = useContext(GlobalLoadingContext);
  if (!ctx) {
    throw new Error("useGlobalLoading must be used within GlobalLoadingProvider");
  }
  return ctx;
}
