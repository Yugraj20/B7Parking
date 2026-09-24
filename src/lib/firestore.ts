import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, updateDoc, where, type Unsubscribe
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  ActivityLog, AppData, AppSettings, Category, Expense, Flat,
  Payment, RecurringExpense, Resident
} from "../types";

const names = {
  residents: "residents",
  flats: "flats",
  categories: "categories",
  expenses: "expenses",
  payments: "payments",
  recurringExpenses: "recurringExpenses",
  activityLogs: "activityLogs",
  settings: "settings"
} as const;

function listen<T>(name: keyof typeof names, setter: (v: T[]) => void): Unsubscribe {
  return onSnapshot(collection(db, names[name]), snap => {
    setter(snap.docs.map(d => ({ id: d.id, ...d.data() } as T)));
  });
}

export function subscribePublic(
  onData: (data: AppData) => void,
  onError: (e: Error) => void
) {
  const state: AppData = {
    residents: [], flats: [], categories: [], expenses: [], payments: [],
    recurringExpenses: [], activityLogs: [], settings: {
      currency: "INR", propertyName: "ParkLedger", monthStartDay: 1
    }
  };
  const unsubs: Unsubscribe[] = [
    listen<Resident>("residents", v => { state.residents = v; onData({...state}); }),
    listen<Flat>("flats", v => { state.flats = v; onData({...state}); }),
    listen<Category>("categories", v => { state.categories = v; onData({...state}); }),
    listen<Expense>("expenses", v => { state.expenses = v; onData({...state}); }),
    listen<Payment>("payments", v => { state.payments = v; onData({...state}); }),
    onSnapshot(doc(db, "settings", "global"), snap => {
      if (snap.exists()) state.settings = snap.data() as AppSettings;
      onData({...state});
    }, onError)
  ];
  return () => unsubs.forEach(u => u());
}

export function subscribeAdmin(onData: (data: AppData) => void, onError: (e: Error) => void) {
  const state: AppData = {
    residents: [], flats: [], categories: [], expenses: [], payments: [],
    recurringExpenses: [], activityLogs: [], settings: {
      currency: "INR", propertyName: "ParkLedger", monthStartDay: 1
    }
  };
  const set = <T,>(key: keyof AppData, value: T[]) => {
    (state as any)[key] = value;
    onData({...state});
  };
  const unsubs: Unsubscribe[] = [
    listen<Resident>("residents", v => set("residents", v)),
    listen<Flat>("flats", v => set("flats", v)),
    listen<Category>("categories", v => set("categories", v)),
    listen<Expense>("expenses", v => set("expenses", v)),
    listen<Payment>("payments", v => set("payments", v)),
    listen<RecurringExpense>("recurringExpenses", v => set("recurringExpenses", v)),
    listen<ActivityLog>("activityLogs", v => set("activityLogs", v)),
    onSnapshot(doc(db, "settings", "global"), snap => {
      if (snap.exists()) state.settings = snap.data() as AppSettings;
      onData({...state});
    }, onError)
  ];
  return () => unsubs.forEach(u => u());
}

export async function saveDoc<T extends Record<string, unknown>>(
  collectionName: string,
  id: string | undefined,
  data: T
) {
  const clean = { ...data, updatedAt: serverTimestamp() };
  if (id) {
    await setDoc(doc(db, collectionName, id), clean, { merge: true });
    return id;
  }
  const ref = await addDoc(collection(db, collectionName), { ...clean, createdAt: serverTimestamp() });
  return ref.id;
}

export async function removeDoc(collectionName: string, id: string) {
  await deleteDoc(doc(db, collectionName, id));
}

export async function writeActivity(log: Omit<ActivityLog, "id" | "createdAt">) {
  await addDoc(collection(db, "activityLogs"), {
    ...log,
    createdAt: serverTimestamp()
  });
}

export async function recordPayment(payment: Omit<Payment, "id" | "createdAt">) {
  const ref = await addDoc(collection(db, "payments"), {
    ...payment,
    createdAt: serverTimestamp()
  });
  return ref.id;
}

export async function updateSettings(settings: Partial<AppSettings>) {
  await setDoc(doc(db, "settings", "global"), {
    ...settings,
    updatedAt: serverTimestamp()
  }, { merge: true });
}