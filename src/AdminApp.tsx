import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppProvider, useApp } from "./context/AppContext";
import { ThemeHost, useTheme } from "./context/ThemeContext";
import { AppShell } from "./components/AppShell";
import { AdminDashboard } from "./pages/AdminDashboard";
import { AdminLogin } from "./pages/Login";

const SECTIONS = ["overview", "expenses", "payments", "residents", "flats", "charges", "categories", "recurring", "reports", "activity", "settings"];

function AdminRoute({ section }: { section: string }) {
  const { user, isAdmin, logout } = useApp();
  const { theme, setTheme } = useTheme();
  if (!user || !isAdmin) return <Navigate to="/login" replace />;
  return <AppShell admin theme={theme} onTheme={setTheme} userEmail={user.email} onLogout={logout}><AdminDashboard section={section} /></AppShell>;
}

function LoginRoute() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="login-root">
      <div className="login-theme">
        <button className="icon-btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? "☼" : "☾"}</button>
      </div>
      <AdminLogin />
    </div>
  );
}

// HashRouter: GitHub Pages cannot rewrite /admin/* paths, so admin routes live
// after the hash (admin.html#/login, admin.html#/overview, ...).
export default function AdminApp() {
  return (
    <HashRouter>
      <AppProvider>
        <ThemeHost>
          <Routes>
            <Route path="/login" element={<LoginRoute />} />
            {SECTIONS.map(x => <Route key={x} path={`/${x}`} element={<AdminRoute section={x} />} />)}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </ThemeHost>
      </AppProvider>
    </HashRouter>
  );
}
