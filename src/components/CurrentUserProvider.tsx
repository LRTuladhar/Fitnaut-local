"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { DEFAULT_USER_ID } from "@/lib/constants";

const STORAGE_KEY = "fitnaut.currentUser";

// localStorage is the source of truth, with useSyncExternalStore providing a
// hydration-safe read that avoids the "setState in effect" anti-pattern and any
// server/client mismatch. The server snapshot is always the default account.
function readSnapshot(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? DEFAULT_USER_ID;
  } catch {
    return DEFAULT_USER_ID;
  }
}

function getServerSnapshot(): string {
  return DEFAULT_USER_ID;
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Keep the selection in sync across tabs/windows.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function notify() {
  for (const l of listeners) l();
}

type CurrentUserContextValue = {
  currentUserId: string;
  setCurrentUserId: (id: string) => void;
};

const CurrentUserContext = createContext<CurrentUserContextValue>({
  currentUserId: DEFAULT_USER_ID,
  setCurrentUserId: () => {},
});

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const currentUserId = useSyncExternalStore(subscribe, readSnapshot, getServerSnapshot);

  const setCurrentUserId = useCallback((id: string) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // localStorage unavailable (private mode) — selection still applies this session.
    }
    notify();
  }, []);

  return (
    <CurrentUserContext.Provider value={{ currentUserId, setCurrentUserId }}>
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser() {
  return useContext(CurrentUserContext);
}
