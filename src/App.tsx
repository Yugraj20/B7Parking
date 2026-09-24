import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppProvider, useApp } from "./context/AppContext";
import { AppShell } from "./components/AppShell";
import { PublicDashboard } from "./pages/PublicDashboard";
import { AdminDashboard } from "./pages/AdminDashboard";
import { AdminLogin } from "./pages/Login";
import { useEffect, useState } from "react";

function ThemeHost({children}:{children:ReactNode}) {
  const [theme,setTheme]=useState<"light"|"dark">(()=>localStorage.getItem("parkledger-theme")==="dark"?"dark":"light");
  useEffect(()=>{document.documentElement.dataset.theme=theme;localStorage.setItem("parkledger-theme",theme)},[theme]);
  return <ThemeContext.Provider value={{theme,setTheme}}>{children}</ThemeContext.Provider>;
}
import { createContext, useContext, type ReactNode } from "react";
const ThemeContext=createContext<{theme:"light"|"dark";setTheme:(v:"light"|"dark")=>void}>({theme:"light",setTheme:()=>{}});
const useTheme=()=>useContext(ThemeContext);

function PublicRoute({section}:{section:string}) {
  const {login}=useApp(); const {theme,setTheme}=useTheme();
  return <AppShell theme={theme} onTheme={setTheme} onLogin={login}><PublicDashboard section={section}/></AppShell>;
}
function AdminRoute({section}:{section:string}) {
  const {user,isAdmin,logout}=useApp(); const {theme,setTheme}=useTheme();
  if(!user || !isAdmin) return <Navigate to="/admin/login" replace/>;
  return <AppShell admin theme={theme} onTheme={setTheme} userEmail={user.email} onLogout={logout}><AdminDashboard section={section}/></AppShell>;
}
function LoginRoute(){const {theme,setTheme}=useTheme(); return <AdminLoginWithTheme theme={theme} onTheme={setTheme}/>;}
function AdminLoginWithTheme({theme,onTheme}:{theme:"light"|"dark";onTheme:(v:"light"|"dark")=>void}){return <div className="login-root"><div className="login-theme"><button className="icon-btn" onClick={()=>onTheme(theme==="dark"?"light":"dark")}>{theme==="dark"?"☼":"☾"}</button></div><AdminLogin/></div>}

export default function App(){
 const basename = import.meta.env.BASE_URL === "/" ? undefined : import.meta.env.BASE_URL.replace(/\/$/, "");
 return <BrowserRouter basename={basename}><AppProvider><ThemeHost><Routes>
   <Route path="/" element={<PublicRoute section="overview"/>}/>
   {["dues","expenses","payments","balances","history","analytics","reports"].map(x=><Route key={x} path={`/${x}`} element={<PublicRoute section={x}/>}/>)}
   <Route path="/admin/login" element={<LoginRoute/>}/>
   {["overview","expenses","payments","residents","flats","charges","categories","recurring","reports","activity","settings"].map(x=><Route key={x} path={`/admin/${x}`} element={<AdminRoute section={x}/>}/>)}
   <Route path="*" element={<Navigate to="/" replace/>}/>
 </Routes></ThemeHost></AppProvider></BrowserRouter>;
}