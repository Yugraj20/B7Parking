import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut, getRedirectResult, type User } from "firebase/auth";
import { auth, ADMIN_EMAIL, googleProvider } from "../lib/firebase";
import { subscribePublic, subscribeAdmin } from "../lib/firestore";
import type { AppData } from "../types";

const empty: AppData = { residents:[], flats:[], categories:[], expenses:[], payments:[], recurringExpenses:[], activityLogs:[], settings:{currency:"INR",propertyName:"ParkLedger",monthStartDay:1} };
type Ctx={data:AppData;loading:boolean;error:string|null;user:User|null;isAdmin:boolean;login:()=>Promise<User|null>;logout:()=>Promise<void>};
const AppCtx=createContext<Ctx|null>(null);

export function AppProvider({children}:{children:ReactNode}){
 const [data,setData]=useState<AppData>(empty); const [loading,setLoading]=useState(true); const [error,setError]=useState<string|null>(null); const [user,setUser]=useState<User|null>(null);
 useEffect(()=>{ const unsub=onAuthStateChanged(auth,setUser); getRedirectResult(auth).catch(()=>{}); return unsub; },[]);
 const isAdmin=!!user && user.email?.toLowerCase()===ADMIN_EMAIL.toLowerCase() && user.emailVerified;
 useEffect(()=>{ setLoading(true); setError(null); const unsub=(isAdmin?subscribeAdmin:subscribePublic)(setData,e=>setError(e.message)); return ()=>unsub(); },[isAdmin]);
 const value=useMemo<Ctx>(()=>({data,loading,error,user,isAdmin,login:async()=>{ try{ return (await signInWithPopup(auth,googleProvider)).user; }catch(e:any){ if(["auth/popup-blocked","auth/operation-not-supported-in-this-environment"].includes(e?.code)){ await signInWithRedirect(auth,googleProvider); return null; } throw e; } },logout:()=>signOut(auth)}),[data,loading,error,user,isAdmin]);
 return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
export function useApp(){const c=useContext(AppCtx);if(!c)throw new Error("useApp must be used inside AppProvider");return c;}
