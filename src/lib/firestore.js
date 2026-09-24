import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";
const names = {
    residents: "residents",
    flats: "flats",
    categories: "categories",
    expenses: "expenses",
    payments: "payments",
    recurringExpenses: "recurringExpenses",
    activityLogs: "activityLogs",
    settings: "settings"
};
function listen(name, setter) {
    return onSnapshot(collection(db, names[name]), snap => {
        setter(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
}
export function subscribePublic(onData, onError) {
    const state = {
        residents: [], flats: [], categories: [], expenses: [], payments: [],
        recurringExpenses: [], activityLogs: [], settings: {
            currency: "INR", propertyName: "ParkLedger", monthStartDay: 1
        }
    };
    const unsubs = [
        listen("residents", v => { state.residents = v; onData({ ...state }); }),
        listen("flats", v => { state.flats = v; onData({ ...state }); }),
        listen("categories", v => { state.categories = v; onData({ ...state }); }),
        listen("expenses", v => { state.expenses = v; onData({ ...state }); }),
        listen("payments", v => { state.payments = v; onData({ ...state }); }),
        onSnapshot(doc(db, "settings", "global"), snap => {
            if (snap.exists())
                state.settings = snap.data();
            onData({ ...state });
        }, onError)
    ];
    return () => unsubs.forEach(u => u());
}
export function subscribeAdmin(onData, onError) {
    const state = {
        residents: [], flats: [], categories: [], expenses: [], payments: [],
        recurringExpenses: [], activityLogs: [], settings: {
            currency: "INR", propertyName: "ParkLedger", monthStartDay: 1
        }
    };
    const set = (key, value) => {
        state[key] = value;
        onData({ ...state });
    };
    const unsubs = [
        listen("residents", v => set("residents", v)),
        listen("flats", v => set("flats", v)),
        listen("categories", v => set("categories", v)),
        listen("expenses", v => set("expenses", v)),
        listen("payments", v => set("payments", v)),
        listen("recurringExpenses", v => set("recurringExpenses", v)),
        listen("activityLogs", v => set("activityLogs", v)),
        onSnapshot(doc(db, "settings", "global"), snap => {
            if (snap.exists())
                state.settings = snap.data();
            onData({ ...state });
        }, onError)
    ];
    return () => unsubs.forEach(u => u());
}
export async function saveDoc(collectionName, id, data) {
    const clean = { ...data, updatedAt: serverTimestamp() };
    if (id) {
        await setDoc(doc(db, collectionName, id), clean, { merge: true });
        return id;
    }
    const ref = await addDoc(collection(db, collectionName), { ...clean, createdAt: serverTimestamp() });
    return ref.id;
}
export async function removeDoc(collectionName, id) {
    await deleteDoc(doc(db, collectionName, id));
}
export async function writeActivity(log) {
    await addDoc(collection(db, "activityLogs"), {
        ...log,
        createdAt: serverTimestamp()
    });
}
export async function recordPayment(payment) {
    const ref = await addDoc(collection(db, "payments"), {
        ...payment,
        createdAt: serverTimestamp()
    });
    return ref.id;
}
export async function updateSettings(settings) {
    await setDoc(doc(db, "settings", "global"), {
        ...settings,
        updatedAt: serverTimestamp()
    }, { merge: true });
}
