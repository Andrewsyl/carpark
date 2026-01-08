import { createContext, useContext } from "react";

type AppLaunchContextValue = {
  launchComplete: boolean;
  setLaunchComplete: (ready: boolean) => void;
};

export const AppLaunchContext = createContext<AppLaunchContextValue | null>(null);

export function useAppLaunch() {
  const ctx = useContext(AppLaunchContext);
  if (!ctx) {
    throw new Error("useAppLaunch must be used within AppLaunchContext");
  }
  return ctx;
}
