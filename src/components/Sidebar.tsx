import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";
import {
  BarChart3, Building2, CreditCard, FileText, LayoutDashboard, Receipt,
  Settings, Users, WalletCards, Repeat2, ScrollText, Tags, DoorOpen,
  MoreHorizontal, X
} from "lucide-react";

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

// "/" and "/overview" both render the Overview section (see App.tsx), so the
// Overview link must be marked active on either path, not just an exact
// match on "/overview".
function isOverviewMatch(path: string, pathname: string): boolean {
  if (path !== "overview") return pathname === `/${path}`;
  return pathname === "/" || pathname === "/overview";
}

export function Sidebar({ admin = false }: { admin?: boolean }) {
  const items = admin ? adminItems : publicItems;
  const { pathname } = useLocation();
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
          <NavLink key={path} to={`/${path}`} className={() => `nav-link ${isOverviewMatch(path, pathname) ? "active" : ""}`}>
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
  const items = admin ? adminItems : publicItems;
  const primary = items.slice(0, 5);
  const overflow = items.slice(5);
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMoreOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  const overflowActive = overflow.some(([path]) => isOverviewMatch(path, pathname));

  return (
    <>
      {moreOpen && overflow.length > 0 && (
        <div className="mobile-more-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setMoreOpen(false); }}>
          <div className="mobile-more-sheet" role="dialog" aria-modal="true" aria-label="More navigation">
            <div className="mobile-more-head"><span>More</span><button className="icon-btn" aria-label="Close" onClick={() => setMoreOpen(false)}><X size={18} /></button></div>
            <div className="mobile-more-grid">
              {overflow.map(([path, label, Icon]) => (
                <NavLink key={path} to={`/${path}`} onClick={() => setMoreOpen(false)} className={() => `mobile-more-link ${isOverviewMatch(path, pathname) ? "active" : ""}`}>
                  <Icon size={18} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}
      <nav className="mobile-nav">
        {primary.map(([path, label, Icon]) => (
          <NavLink key={path} to={`/${path}`} className={() => `mobile-nav-link ${isOverviewMatch(path, pathname) ? "active" : ""}`}>
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
        {overflow.length > 0 && (
          <button type="button" className={`mobile-nav-link mobile-nav-more ${overflowActive ? "active" : ""}`} onClick={() => setMoreOpen(true)} aria-haspopup="dialog" aria-expanded={moreOpen}>
            <MoreHorizontal size={18} />
            <span>More</span>
          </button>
        )}
      </nav>
    </>
  );
}