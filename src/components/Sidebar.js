import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { NavLink } from "react-router-dom";
import { BarChart3, Building2, CreditCard, FileText, LayoutDashboard, Receipt, Settings, Users, WalletCards, Repeat2, ScrollText, Tags, DoorOpen } from "lucide-react";
const publicItems = [
    ["overview", "Overview", LayoutDashboard],
    ["dues", "Current Dues", CreditCard],
    ["expenses", "Expenses", Receipt],
    ["payments", "Payments", WalletCards],
    ["balances", "Balances", Building2],
    ["history", "Monthly History", ScrollText],
    ["analytics", "Analytics", BarChart3],
    ["reports", "Reports", FileText]
];
const adminItems = [
    ["overview", "Overview", LayoutDashboard],
    ["expenses", "Expenses", Receipt],
    ["payments", "Payments", WalletCards],
    ["residents", "Residents", Users],
    ["flats", "Flats", DoorOpen],
    ["charges", "Monthly Charges", CreditCard],
    ["categories", "Categories", Tags],
    ["recurring", "Recurring Expenses", Repeat2],
    ["reports", "Reports", FileText],
    ["activity", "Activity Log", ScrollText],
    ["settings", "Settings", Settings]
];
export function Sidebar({ admin = false }) {
    const items = admin ? adminItems : publicItems;
    return (_jsxs("aside", { className: "sidebar", children: [_jsxs("div", { className: "brand", children: [_jsx("div", { className: "brand-mark", children: "P" }), _jsxs("div", { children: [_jsx("div", { className: "brand-name", children: "ParkLedger" }), _jsx("div", { className: "brand-kicker", children: admin ? "Admin Console" : "Public Ledger" })] })] }), _jsx("nav", { className: "nav-list", "aria-label": admin ? "Admin navigation" : "Dashboard navigation", children: items.map(([path, label, Icon]) => (_jsxs(NavLink, { to: admin ? `/admin/${path}` : `/${path}`, className: ({ isActive }) => `nav-link ${isActive ? "active" : ""}`, children: [_jsx(Icon, { size: 17 }), _jsx("span", { children: label })] }, path))) }), _jsxs("div", { className: "sidebar-foot", children: [_jsx("span", { className: "live-dot" }), "Firestore live"] })] }));
}
export function MobileNav({ admin = false }) {
    const items = admin ? adminItems.slice(0, 5) : publicItems.slice(0, 5);
    return (_jsx("nav", { className: "mobile-nav", children: items.map(([path, label, Icon]) => (_jsxs(NavLink, { to: admin ? `/admin/${path}` : `/${path}`, className: ({ isActive }) => `mobile-nav-link ${isActive ? "active" : ""}`, children: [_jsx(Icon, { size: 18 }), _jsx("span", { children: label })] }, path))) }));
}
