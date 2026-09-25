import { addDoc, collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, type Unsubscribe, writeBatch } from "firebase/firestore";
import { db, storage } from "./firebase";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import type { ActivityLog, AppData, AppSettings, Category, Expense, Flat, Payment, RecurringExpense, Resident } from "../types";

const names = { residents:"residents", flats:"flats", categories:"categories", expenses:"expenses", payments:"payments", recurringExpenses:"recurringExpenses", activityLogs:"activityLogs", settings:"settings" } as const;

type Listener<T> = (value: T[]) => void;
function listen<T>(name: keyof typeof names, setter: Listener<T>, onError: (e: Error) => void) {
  const ref = collection(db, names[name]);
  const q = name === "activityLogs" ? query(ref, orderBy("createdAt", "desc"), limit(100)) : ref;
  return onSnapshot(q, snap => setter(snap.docs.map(d => ({id:d.id, ...d.data()} as T))), onError);
}

function initialState(): AppData { return { residents:[], flats:[], categories:[], expenses:[], payments:[], recurringExpenses:[], activityLogs:[], settings:{currency:"INR",propertyName:"ParkLedger",monthStartDay:1} }; }

export function subscribePublic(onData:(data:AppData)=>void, onError:(e:Error)=>void) {
  const state = initialState();
  const push = () => onData({...state});
  const unsubs: Unsubscribe[] = [
    listen<Resident>("residents", v => { state.residents=v.map(({id,name,flatId,shares,active})=>({id,name,flatId,shares,active})); push(); }, onError),
    listen<Flat>("flats", v => { state.flats=v; push(); }, onError),
    listen<Category>("categories", v => { state.categories=v; push(); }, onError),
    listen<Expense>("expenses", v => { state.expenses=v.map(({createdAt,updatedAt,...e})=>e); push(); }, onError),
    listen<Payment>("payments", v => { state.payments=v.map(({createdAt,...p})=>p); push(); }, onError),
    onSnapshot(doc(db,"settings","global"), snap => { if(snap.exists()) state.settings=snap.data() as AppSettings; push(); }, onError)
  ];
  return () => unsubs.forEach(u=>u());
}

export function subscribeAdmin(onData:(data:AppData)=>void, onError:(e:Error)=>void) {
  const state = initialState();
  const push = () => onData({...state});
  const unsubs: Unsubscribe[] = [
    listen<Resident>("residents", v => { state.residents=v; push(); }, onError),
    listen<Flat>("flats", v => { state.flats=v; push(); }, onError),
    listen<Category>("categories", v => { state.categories=v; push(); }, onError),
    listen<Expense>("expenses", v => { state.expenses=v; push(); }, onError),
    listen<Payment>("payments", v => { state.payments=v; push(); }, onError),
    listen<RecurringExpense>("recurringExpenses", v => { state.recurringExpenses=v; push(); }, onError),
    listen<ActivityLog>("activityLogs", v => { state.activityLogs=v; push(); }, onError),
    onSnapshot(doc(db,"settings","global"), snap => { if(snap.exists()) state.settings=snap.data() as AppSettings; push(); }, onError)
  ];
  return () => unsubs.forEach(u=>u());
}

export async function saveDoc<T extends Record<string, unknown>>(collectionName:string, id:string|undefined, data:T) {
  const clean = {...data, updatedAt:serverTimestamp()};
  if(id) { await setDoc(doc(db,collectionName,id),clean,{merge:true}); return id; }
  const ref = await addDoc(collection(db,collectionName),{...clean,createdAt:serverTimestamp()}); return ref.id;
}
export async function removeDoc(collectionName:string,id:string){ await deleteDoc(doc(db,collectionName,id)); }
export async function writeActivity(log:Omit<ActivityLog,"id"|"createdAt">){ await addDoc(collection(db,"activityLogs"),{...log,createdAt:serverTimestamp()}); }
export async function recordPayment(payment:Omit<Payment,"id"|"createdAt">){ const ref=await addDoc(collection(db,"payments"),{...payment,createdAt:serverTimestamp()}); return ref.id; }
export async function updateSettings(settings:Partial<AppSettings>){ await setDoc(doc(db,"settings","global"),{...settings,updatedAt:serverTimestamp()},{merge:true}); }

export async function batchRestore(records:{collection:string; id:string; data:Record<string,unknown>}[]) {
  for(let i=0;i<records.length;i+=400){
    const batch=writeBatch(db);
    for(const record of records.slice(i,i+400)) batch.set(doc(db,record.collection,record.id),{...record.data,updatedAt:serverTimestamp()},{merge:true});
    await batch.commit();
  }
}

export async function uploadReceipt(file: File, expenseId: string) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storageRef = ref(storage, `receipts/${expenseId}/${safeName}`);
  await uploadBytes(storageRef, file);
  return { receiptUrl: await getDownloadURL(storageRef), receiptName: file.name };
}
