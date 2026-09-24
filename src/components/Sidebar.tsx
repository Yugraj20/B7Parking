import { NavLink } from "react-router-dom";
import {
  BarChart3, Building2, CreditCard, FileText, LayoutDashboard, Receipt,
  Settings, Users, WalletCards, Repeat2, ScrollText, Tags, DoorOpen
} from "lucide-react";
import type { ReactNode } from "react";

const publicItems = [
  ["overview", "Overview", LayoutDashboard],
  ["dues", "Current Dues", CreditCard],
  ["expenses", "Expenses", Receipt],
  ["payments", "Payments", WalletCards],
  ["balances", "Balances", Building2],
  ["history", "Monthly History", ScrollText],
  ["analytics", "Analytics", BarChart3],
  ["reports", "Reports", FileText]
] as const;

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
] as const;

export function Sidebar({ admin = false }: { admin?: boolean }) {
  const items = admin ? adminItems : publicItems;
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">P</div>
        <div>
          <div className="brand-name">ParkLedger</div>
          <div className="brand-kicker">{admin ? "Admin Console" : "Public Ledger"}</div>
        </div>
      </div>
      <nav className="nav-list" aria-label={admin ? "Admin navigation" : "Dashboard navigation"}>
        {items.map(([path, label, Icon]) => (
          <NavLink key={path} to={admin ? `/admin/${path}` : `/${path}`} className={({isActive}) => `nav-link ${isActive ? "active" : ""}`}>
            <Icon size={17} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-foot">
        <span className="live-dot" />
        Firestore live
      </div>
    </aside>
  );
}

export function MobileNav({ admin = false }: { admin?: boolean }) {
  const items = admin ? adminItems.slice(0, 5) : publicItems.slice(0, 5);
  return (
    <nav className="mobile-nav">
      {items.map(([path, label, Icon]) => (
        <NavLink key={path} to={admin ? `/admin/${path}` : `/${path}`} className={({isActive}) => `mobile-nav-link ${isActive ? "active" : ""}`}>
          <Icon size={18} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}