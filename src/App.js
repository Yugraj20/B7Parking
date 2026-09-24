import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppProvider, useApp } from "./context/AppContext";
import { AppShell } from "./components/AppShell";
import { PublicDashboard } from "./pages/PublicDashboard";
import { AdminDashboard } from "./pages/AdminDashboard";
import { AdminLogin } from "./pages/Login";
import { useEffect, useState } from "react";
function ThemeHost({ children }) {
    const [theme, setTheme] = useState(() => localStorage.getItem("parkledger-theme") === "dark" ? "dark" : "light");
    useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem("parkledger-theme", theme); }, [theme]);
    return _jsx(ThemeContext.Provider, { value: { theme, setTheme }, children: children });
}
import { createContext, useContext } from "react";
const ThemeContext = createContext({ theme: "light", setTheme: () => { } });
const useTheme = () => useContext(ThemeContext);
function PublicRoute({ section }) {
    const { login } = useApp();
    const { theme, setTheme } = useTheme();
    return _jsx(AppShell, { theme: theme, onTheme: setTheme, onLogin: login, children: _jsx(PublicDashboard, { section: section }) });
}
function AdminRoute({ section }) {
    const { user, isAdmin, logout } = useApp();
    const { theme, setTheme } = useTheme();
    if (!user || !isAdmin)
        return _jsx(Navigate, { to: "/admin/login", replace: true });
    return _jsx(AppShell, { admin: true, theme: theme, onTheme: setTheme, userEmail: user.email, onLogout: logout, children: _jsx(AdminDashboard, { section: section }) });
}
function LoginRoute() { const { theme, setTheme } = useTheme(); return _jsx(AdminLoginWithTheme, { theme: theme, onTheme: setTheme }); }
function AdminLoginWithTheme({ theme, onTheme }) { return _jsxs("div", { className: "login-root", children: [_jsx("div", { className: "login-theme", children: _jsx("button", { className: "icon-btn", onClick: () => onTheme(theme === "dark" ? "light" : "dark"), children: theme === "dark" ? "☼" : "☾" }) }), _jsx(AdminLogin, {})] }); }
export default function App() {
    const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || undefined;
    return _jsx(BrowserRouter, { basename: basename, children: _jsx(AppProvider, { children: _jsx(ThemeHost, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(PublicRoute, { section: "overview" }) }), ["dues", "expenses", "payments", "balances", "history", "analytics", "reports"].map(x => _jsx(Route, { path: `/${x}`, element: _jsx(PublicRoute, { section: x }) }, x)), _jsx(Route, { path: "/admin/login", element: _jsx(LoginRoute, {}) }), ["overview", "expenses", "payments", "residents", "flats", "charges", "categories", "recurring", "reports", "activity", "settings"].map(x => _jsx(Route, { path: `/admin/${x}`, element: _jsx(AdminRoute, { section: x }) }, x)), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }) }) }) });
}
