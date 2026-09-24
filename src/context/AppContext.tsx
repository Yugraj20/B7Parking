import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User
} from "firebase/auth";
import { auth, ADMIN_EMAIL, googleProvider } from "../lib/firebase";
import { subscribePublic, subscribeAdmin } from "../lib/firestore";
import type { AppData } from "../types";

const empty: AppData = {
  residents: [], flats: [], categories: [], expenses: [], payments: [],
  recurringExpenses: [], activityLogs: [],
  settings: { currency: "INR", propertyName: "ParkLedger", monthStartDay: 1 }
};

type Ctx = {
  data: AppData;
  loading: boolean;
  error: string | null;
  user: User | null;
  authReady: boolean;
  isAdmin: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
};

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, u => {
      if (!active) return;
      setUser(u);
      setAuthReady(true);
    });


    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const isCurrentAdmin =
      user?.email?.trim().toLowerCase() === ADMIN_EMAIL.trim().toLowerCase();

    const unsub = isCurrentAdmin
      ? subscribeAdmin(setData, e => setError(e.message))
      : subscribePublic(setData, e => setError(e.message));

    const timer = window.setTimeout(() => setLoading(false), 450);
    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, [user]);

  const value = useMemo<Ctx>(() => ({
    data,
    loading,
    error,
    user,
    authReady,
    isAdmin: user?.email?.trim().toLowerCase() === ADMIN_EMAIL.trim().toLowerCase(),
    login: async () => {
      await signInWithPopup(auth, googleProvider);
    },
    logout: async () => {
      await signOut(auth);
    }
  }), [data, loading, error, user, authReady]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp must be used inside AppProvider");
  return c;
}
