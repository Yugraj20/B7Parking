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

  const admin = !!user && !!user.email && !!user.emailVerified && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  useEffect(() => {
    setLoading(true);
    setError(null);
    let firstSnapshot = false;
    const onFirst = () => { if (!firstSnapshot) { firstSnapshot = true; setLoading(false); } };
    const unsub = admin
      ? subscribeAdmin(d => { setData(d); onFirst(); }, e => { setError(e.message); onFirst(); })
      : subscribePublic(d => { setData(d); onFirst(); }, e => { setError(e.message); onFirst(); });
    return () => unsub();
  }, [user, admin]);

  const value = useMemo<Ctx>(() => ({
    data, loading, error, user,
    isAdmin: admin,
    login: async () => {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    },
    logout: async () => { await signOut(auth); }
  }), [data, loading, error, user, admin]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp must be used inside AppProvider");
  return c;
}