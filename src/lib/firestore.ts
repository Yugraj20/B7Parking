import {
  addDoc, collection, deleteDoc, deleteField, doc, getDocs, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, updateDoc, where, writeBatch, type Unsubscribe
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  ActivityLog, AppData, AppSettings, Category, Expense, Flat,
  Payment, RecurringExpense, Resident, ResidentPrivate
} from "../types";

const names = {
  residents: "residents",
  residentPrivate: "residentPrivate",
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

  // residents/{id} is public and, going forward, never carries phone/notes
  // (see residentPrivate/{id} in firestore.rules). The admin UI still needs
  // those fields, so join them back on here — admin-only, in memory.
  let rawResidents: Resident[] = [];
  let privateById = new Map<string, ResidentPrivate>();
  const applyResidents = () => {
    state.residents = rawResidents.map(r => {
      const priv = privateById.get(r.id);
      return priv ? { ...r, phone: priv.phone, notes: priv.notes } : r;
    });
    onData({...state});
  };

  const unsubs: Unsubscribe[] = [
    listen<Resident>("residents", v => { rawResidents = v; applyResidents(); }),
    listen<ResidentPrivate & { id: string }>("residentPrivate", v => {
      privateById = new Map(v.map(p => [p.id, p]));
      applyResidents();
    }),
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

// Reserves a Firestore document id without writing anything yet. Used when
// a related upload (e.g. a receipt) needs to be named after the document
// before the document itself is saved.
export function newId(collectionName: string): string {
  return doc(collection(db, collectionName)).id;
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

// The only write path for residents going forward: public fields go to
// residents/{id}, phone/notes go to residentPrivate/{id}. Also strips
// phone/notes off the public doc with deleteField() on every save, so
// editing a resident that predates this split self-heals it.
export async function saveResident(
  id: string | undefined,
  publicFields: { name: string; flatId: string; shares: number; active: boolean },
  privateFields: { phone?: string; notes?: string }
): Promise<string> {
  const residentId = id || newId("residents");
  await setDoc(doc(db, "residents", residentId), {
    ...publicFields,
    phone: deleteField(),
    notes: deleteField(),
    updatedAt: serverTimestamp(),
    ...(id ? {} : { createdAt: serverTimestamp() })
  }, { merge: true });
  await setDoc(doc(db, "residentPrivate", residentId), {
    ...privateFields,
    updatedAt: serverTimestamp()
  }, { merge: true });
  return residentId;
}

// One-time backfill for residents created before the residentPrivate split
// (see handover.md, "Fix the phone/notes leak"). Reads residents/{id}
// directly (not the admin-joined view) so it only ever touches documents
// that still actually have phone/notes sitting in the public collection.
// Batched at 200 residents (400 writes) per commit, well under Firestore's
// 500-operation batch limit.
export async function migrateResidentContactFields(): Promise<number> {
  const snap = await getDocs(collection(db, "residents"));
  const leaked = snap.docs.filter(d => {
    const v = d.data() as any;
    return (typeof v.phone === "string" && v.phone) || (typeof v.notes === "string" && v.notes);
  });
  if (!leaked.length) return 0;

  for (let i = 0; i < leaked.length; i += 200) {
    const chunk = leaked.slice(i, i + 200);
    const batch = writeBatch(db);
    for (const docSnap of chunk) {
      const v = docSnap.data() as any;
      batch.set(doc(db, "residentPrivate", docSnap.id), {
        ...(v.phone ? { phone: v.phone } : {}),
        ...(v.notes ? { notes: v.notes } : {}),
        updatedAt: serverTimestamp()
      }, { merge: true });
      batch.update(doc(db, "residents", docSnap.id), {
        phone: deleteField(),
        notes: deleteField(),
        updatedAt: serverTimestamp()
      });
    }
    await batch.commit();
  }
  return leaked.length;
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

// Generates one or more recurring-expense occurrences and advances each
// recurring record's lastGeneratedMonth in a single atomic batch, using a
// deterministic expense id (exp_{recurringId}_{yyyy-mm}) so a retry after a
// partial failure can never create a duplicate expense.
export interface RecurringOccurrence {
  recurringId: string;
  month: string; // yyyy-mm
  expense: Omit<Expense, "id" | "createdAt" | "updatedAt">;
}

export async function generateRecurringBatch(occurrences: RecurringOccurrence[]) {
  if (!occurrences.length) return;
  const batch = writeBatch(db);
  const latestByRecurring = new Map<string, string>();

  for (const { recurringId, month, expense } of occurrences) {
    const expenseId = `exp_${recurringId}_${month}`;
    batch.set(doc(db, "expenses", expenseId), {
      ...expense,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
    const current = latestByRecurring.get(recurringId);
    if (!current || month > current) latestByRecurring.set(recurringId, month);
  }

  latestByRecurring.forEach((month, recurringId) => {
    batch.set(doc(db, "recurringExpenses", recurringId), {
      lastGeneratedMonth: month,
      updatedAt: serverTimestamp()
    }, { merge: true });
  });

  await batch.commit();
}