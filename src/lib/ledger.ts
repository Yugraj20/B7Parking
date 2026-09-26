// Shared domain layer. Public dashboard, admin dashboard, dues tables,
// reports and recurring generation must all read money and dates through
// this module instead of recomputing their own formulas.
import type { AppData, Resident } from "../types";

export type DuesStatus = "paid" | "partial" | "pending" | "credit" | "clear";

export interface ResidentLedgerRow {
  resident: Resident;
  owedCents: number;
  paidCents: number;
  remainingCents: number; // owed - paid; negative = credit
  status: DuesStatus;
}

export interface LedgerTotals {
  expenseCents: number;
  allocatedCents: number;
  collectedCents: number;
  outstandingCents: number;
  creditCents: number;
}

export interface MonthlyPoint { month: string; monthKey: string; amount: number }
export interface CategoryPoint { name: string; amount: number }

export interface Ledger {
  rows: ResidentLedgerRow[];
  byResidentId: Map<string, ResidentLedgerRow>;
  totals: LedgerTotals;
  flatNumber: (flatId: string) => string;
  residentName: (residentId: string) => string;
  categoryName: (categoryId: string) => string;
  monthlySeries: (limit?: number) => MonthlyPoint[];
  categorySeries: (limit?: number) => CategoryPoint[];
}

export function statusForRow(owedCents: number, paidCents: number): DuesStatus {
  if (owedCents === 0 && paidCents === 0) return "clear";
  if (paidCents > owedCents) return "credit";
  const remaining = owedCents - paidCents;
  if (remaining <= 0) return "paid";
  if (paidCents > 0) return "partial";
  return "pending";
}

export function buildLedger(data: AppData): Ledger {
  const owed = new Map<string, number>();
  const paid = new Map<string, number>();

  // Allocated shares of every expense, regardless of who paid.
  data.expenses.forEach(e => {
    Object.entries(e.split ?? {}).forEach(([residentId, amount]) => {
      owed.set(residentId, (owed.get(residentId) || 0) + Number(amount || 0));
    });
  });

  // The payer of an expense is auto-credited for their own allocated share.
  data.expenses.forEach(e => {
    const ownShare = Number(e.split?.[e.payerId] ?? 0);
    if (ownShare) paid.set(e.payerId, (paid.get(e.payerId) || 0) + ownShare);
  });

  // Recorded payments on top of that self-credit.
  data.payments.forEach(p => {
    paid.set(p.residentId, (paid.get(p.residentId) || 0) + Number(p.amountCents || 0));
  });

  const rows: ResidentLedgerRow[] = data.residents.map(resident => {
    const owedCents = owed.get(resident.id) || 0;
    const paidCents = paid.get(resident.id) || 0;
    const remainingCents = owedCents - paidCents;
    return { resident, owedCents, paidCents, remainingCents, status: statusForRow(owedCents, paidCents) };
  });

  const totals: LedgerTotals = {
    expenseCents: data.expenses.reduce((a, e) => a + e.amountCents, 0),
    allocatedCents: rows.reduce((a, r) => a + r.owedCents, 0),
    collectedCents: rows.reduce((a, r) => a + r.paidCents, 0),
    outstandingCents: rows.reduce((a, r) => a + Math.max(0, r.remainingCents), 0),
    creditCents: rows.reduce((a, r) => a + Math.max(0, -r.remainingCents), 0)
  };

  const flatMap = new Map(data.flats.map(f => [f.id, f.number]));
  const residentMap = new Map(data.residents.map(r => [r.id, r.name]));
  const categoryMap = new Map(data.categories.map(c => [c.id, c.name]));

  const monthlySeries = (limit = 8): MonthlyPoint[] => {
    const m = new Map<string, number>();
    data.expenses.forEach(e => {
      const key = localMonthKey(e.date);
      m.set(key, (m.get(key) || 0) + e.amountCents);
    });
    const all = [...m.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, cents]) => ({ month: monthLabelFor(key), monthKey: key, amount: cents / 100 }));
    return limit ? all.slice(-limit) : all;
  };

  const categorySeries = (limit = 6): CategoryPoint[] => {
    const m = new Map<string, number>();
    data.expenses.forEach(e => {
      const name = categoryMap.get(e.categoryId) || "Uncategorised";
      m.set(name, (m.get(name) || 0) + e.amountCents);
    });
    const all = [...m.entries()].sort((a, b) => b[1] - a[1]).map(([name, c]) => ({ name, amount: c / 100 }));
    return limit ? all.slice(0, limit) : all;
  };

  return {
    rows,
    byResidentId: new Map(rows.map(r => [r.resident.id, r])),
    totals,
    flatNumber: (flatId: string) => flatMap.get(flatId) || "—",
    residentName: (residentId: string) => residentMap.get(residentId) || "Unknown",
    categoryName: (categoryId: string) => categoryMap.get(categoryId) || "Uncategorised",
    monthlySeries,
    categorySeries
  };
}

// ---- Split helper -------------------------------------------------------

export interface SplitParticipant { id: string; shares: number }

export function exactSplit(
  totalCents: number,
  residents: SplitParticipant[],
  mode: "shares" | "equal" | "custom",
  custom?: Record<string, number>
): Record<string, number> | { error: string } {
  const active = residents.filter(r => r.id);
  if (!active.length || totalCents <= 0) return {};

  if (mode === "custom" && custom) {
    // If explicit paise are supplied and already sum to the total, use them
    // verbatim and only distribute rounding remainder if they are off.
    const explicit = active.every(r => Number.isFinite(custom[r.id]));
    if (explicit) {
      const sum = active.reduce((a, r) => a + Math.round(Number(custom[r.id] || 0)), 0);
      if (sum === totalCents) {
        const out: Record<string, number> = {};
        active.forEach(r => (out[r.id] = Math.round(Number(custom[r.id] || 0))));
        return out;
      }
    }
  }

  const weights = active.map(r => ({
    id: r.id,
    weight:
      mode === "equal"
        ? 1
        : mode === "custom"
          ? Math.max(0, Number(custom?.[r.id] ?? 0))
          : Math.max(0, Number(r.shares ?? 0))
  }));

  const sum = weights.reduce((a, b) => a + b.weight, 0);
  if (sum <= 0) {
    if (mode === "custom") return { error: "Custom weights must sum to more than zero." };
    return exactSplit(totalCents, active, "equal");
  }

  const raw = weights.map(w => ({ ...w, exact: (totalCents * w.weight) / sum }));
  const result: Record<string, number> = {};
  let allocated = 0;
  let largestIdx = 0;
  raw.forEach((r, i) => {
    const base = Math.floor(r.exact);
    result[r.id] = base;
    allocated += base;
    if (r.weight > raw[largestIdx].weight) largestIdx = i;
  });
  // Remainder paise go to the largest-weight participant, not "last in array".
  result[raw[largestIdx].id] += totalCents - allocated;
  return result;
}

export function isSplitError(v: Record<string, number> | { error: string }): v is { error: string } {
  return typeof (v as { error?: string }).error === "string";
}

// ---- Date helpers (local calendar, IST-friendly) -------------------------

export function localISODate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function localMonthKey(dateStr: string): string {
  const m = String(dateStr || "").match(/^(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : "";
}

export function monthLabelFor(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" }).format(new Date(y, m - 1, 1));
}

export function currentBillingMonth(monthStartDay = 1, now: Date = new Date()): string {
  const day = now.getDate();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed
  if (monthStartDay > 1 && day < monthStartDay) {
    const prev = new Date(y, m - 1, 1);
    return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  }
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

// Inclusive list of yyyy-mm keys from startMonth through endMonth. Used by
// recurring-expense "catch up missed months" generation.
export function monthsBetween(startMonth: string, endMonth: string): string[] {
  const [sy, sm] = startMonth.split("-").map(Number);
  const [ey, em] = endMonth.split("-").map(Number);
  if (!sy || !sm || !ey || !em) return [];
  const months: string[] = [];
  let y = sy, m = sm;
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}
