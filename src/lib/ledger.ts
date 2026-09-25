import type { AppData, Resident } from "../types";
import { monthKey } from "./utils";

export type LedgerStatus = "paid" | "partial" | "pending" | "credit" | "clear";

export interface LedgerRow {
  resident: Resident;
  owedCents: number;
  paidCents: number;
  remainingCents: number;
  status: LedgerStatus;
}

export interface LedgerResult {
  rows: LedgerRow[];
  totals: {
    expenseCents: number;
    allocatedCents: number;
    collectedCents: number;
    outstandingCents: number;
    creditCents: number;
  };
  flatNumber: (flatId: string) => string;
  residentName: (residentId: string) => string;
  categoryName: (categoryId: string) => string;
  monthly: { month: string; amount: number }[];
  categories: { name: string; amount: number }[];
}

export function statusForLedger(owedCents: number, paidCents: number): LedgerStatus {
  if (owedCents === 0 && paidCents === 0) return "clear";
  if (paidCents > owedCents) return "credit";
  if (owedCents === paidCents) return "paid";
  if (paidCents > 0) return "partial";
  return "pending";
}

export function buildLedger(data: AppData): LedgerResult {
  const flatMap = new Map(data.flats.map(f => [f.id, f.number]));
  const residentMap = new Map(data.residents.map(r => [r.id, r.name]));
  const categoryMap = new Map(data.categories.map(c => [c.id, c.name]));
  const owed = new Map<string, number>();
  const paid = new Map<string, number>();

  let expenseCents = 0;
  let allocatedCents = 0;
  for (const expense of data.expenses) {
    expenseCents += Number(expense.amountCents) || 0;
    for (const [residentId, value] of Object.entries(expense.split ?? {})) {
      const amount = Number(value) || 0;
      allocatedCents += amount;
      owed.set(residentId, (owed.get(residentId) ?? 0) + amount);
    }
    const ownShare = Number(expense.split?.[expense.payerId] ?? 0);
    if (ownShare > 0) paid.set(expense.payerId, (paid.get(expense.payerId) ?? 0) + ownShare);
  }

  for (const payment of data.payments) {
    paid.set(payment.residentId, (paid.get(payment.residentId) ?? 0) + (Number(payment.amountCents) || 0));
  }

  const rows = data.residents.map(resident => {
    const owedCents = owed.get(resident.id) ?? 0;
    const paidCents = paid.get(resident.id) ?? 0;
    return {
      resident,
      owedCents,
      paidCents,
      remainingCents: owedCents - paidCents,
      status: statusForLedger(owedCents, paidCents)
    };
  });

  const collectedCents = rows.reduce((sum, row) => sum + row.paidCents, 0);
  const outstandingCents = rows.reduce((sum, row) => sum + Math.max(0, row.remainingCents), 0);
  const creditCents = rows.reduce((sum, row) => sum + Math.max(0, -row.remainingCents), 0);

  const monthlyMap = new Map<string, number>();
  for (const expense of data.expenses) {
    const key = monthKey(expense.date);
    monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + expense.amountCents / 100);
  }
  const categoryMapTotals = new Map<string, number>();
  for (const expense of data.expenses) {
    const name = categoryMap.get(expense.categoryId) ?? "Uncategorised";
    categoryMapTotals.set(name, (categoryMapTotals.get(name) ?? 0) + expense.amountCents / 100);
  }

  return {
    rows,
    totals: { expenseCents, allocatedCents, collectedCents, outstandingCents, creditCents },
    flatNumber: id => flatMap.get(id) ?? "—",
    residentName: id => residentMap.get(id) ?? "Unknown",
    categoryName: id => categoryMap.get(id) ?? "Uncategorised",
    monthly: [...monthlyMap.entries()].sort().map(([month, amount]) => ({ month, amount })),
    categories: [...categoryMapTotals.entries()].sort((a, b) => b[1] - a[1]).map(([name, amount]) => ({ name, amount }))
  };
}

export function billingPeriodKey(date: Date | string, monthStartDay = 1): string {
  const d = typeof date === "string" ? new Date(`${date}T12:00:00`) : new Date(date);
  const day = d.getDate();
  if (day < Math.max(1, Math.min(28, monthStartDay))) d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function currentBillingPeriod(monthStartDay = 1): string {
  return billingPeriodKey(new Date(), monthStartDay);
}
