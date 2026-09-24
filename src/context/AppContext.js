import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, ADMIN_EMAIL, googleProvider } from "../lib/firebase";
import { subscribePublic, subscribeAdmin } from "../lib/firestore";
const empty = {
    residents: [], flats: [], categories: [], expenses: [], payments: [],
    recurringExpenses: [], activityLogs: [],
    settings: { currency: "INR", propertyName: "ParkLedger", monthStartDay: 1 }
};
const AppCtx = createContext(null);
export function AppProvider({ children }) {
    const [data, setData] = useState(empty);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [user, setUser] = useState(null);
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
    const value = useMemo(() => ({
        data, loading, error, user,
        isAdmin: user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase(),
        login: async () => { await signInWithPopup(auth, googleProvider); },
        logout: async () => { await signOut(auth); }
    }), [data, loading, error, user]);
    return _jsx(AppCtx.Provider, { value: value, children: children });
}
export function useApp() {
    const c = useContext(AppCtx);
    if (!c)
        throw new Error("useApp must be used inside AppProvider");
    return c;
}
