import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { auth, ADMIN_EMAIL, googleProvider } from "../lib/firebase";
import { subscribePublic, subscribeAdmin } from "../lib/firestore";
import type { AppData } from "../types";

const empty: AppData = {
  residents: [], flats: [], categories: [], expenses: [], payments: [],
  recurringExpenses: [], activityLogs: [],
  settings: { currency:"INR", propertyName:"ParkLedger", monthStartDay:1 }
};

type Ctx = {
  data: AppData; loading: boolean; error: string | null;
  user: User | null; isAdmin: boolean;
  login: () => Promise<User>; logout: () => Promise<void>;
};

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [user, setUser] = useState<User|null>(null);

  useEffect(() => onAuthStateChanged(auth, u => setUser(u)), []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const unsub = (user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase())
      ? subscribeAdmin(setData, e => setError(e.message))
      : subscribePublic(setData, e => setError(e.message));
    const timer = window.setTimeout(() => setLoading(false), 450);
    return () => { unsub(); clearTimeout(timer); };
  }, [user]);

  const value = useMemo<Ctx>(() => ({
    data, loading, error, user,
    isAdmin: user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase(),
    login: async () => {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    },
    logout: async () => { await signOut(auth); }
  }), [data, loading, error, user]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp must be used inside AppProvider");
  return c;
}