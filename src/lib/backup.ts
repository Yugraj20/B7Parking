import type { AppData } from "../types";
import { downloadText, safeDate } from "./utils";

export const BACKUP_VERSION = 3;

export function createBackup(data: AppData) {
  return JSON.stringify({
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: "ParkLedger",
    data
  }, null, 2);
}

export function exportBackup(data: AppData) {
  downloadText(
    `parkledger-backup-${new Date().toISOString().slice(0,10)}.json`,
    createBackup(data),
    "application/json"
  );
}

export function exportLegacyTxt(data: AppData) {
  const lines = [
    "PARKLEDGER BACKUP",
    `VERSION=${BACKUP_VERSION}`,
    `EXPORTED_AT=${new Date().toISOString()}`,
    "",
    "[RESIDENTS]"
  ];
  data.residents.forEach(r => lines.push([r.id, r.name, r.flatId, r.shares, r.phone ?? "", r.active ? "1" : "0"].join("|")));
  lines.push("", "[FLATS]");
  data.flats.forEach(f => lines.push([f.id, f.number, f.label ?? "", f.active ? "1" : "0"].join("|")));
  lines.push("", "[CATEGORIES]");
  data.categories.forEach(c => lines.push([c.id, c.name, c.color ?? "", c.active ? "1" : "0"].join("|")));
  lines.push("", "[EXPENSES]");
  data.expenses.forEach(e => lines.push([
    e.id, safeDate(e.date), e.title, e.categoryId, e.amountCents, e.payerId, e.type,
    e.splitMode, JSON.stringify(e.split ?? {})
  ].join("|")));
  lines.push("", "[PAYMENTS]");
  data.payments.forEach(p => lines.push([
    p.id, p.residentId, p.amountCents, safeDate(p.date), p.expenseId ?? "", p.note ?? ""
  ].join("|")));
  downloadText(
    `parkledger-legacy-${new Date().toISOString().slice(0,10)}.txt`,
    lines.join("\n")
  );
}

export function parseBackup(text: string): AppData {
  const raw = JSON.parse(text);
  if (!raw || raw.app !== "ParkLedger" || !raw.data) {
    throw new Error("This file is not a valid ParkLedger backup.");
  }
  const d = raw.data;
  if (!Array.isArray(d.residents) || !Array.isArray(d.flats) ||
      !Array.isArray(d.categories) || !Array.isArray(d.expenses) ||
      !Array.isArray(d.payments) || !Array.isArray(d.recurringExpenses)) {
    throw new Error("Backup is missing required collections.");
  }
  return {
    residents: d.residents,
    flats: d.flats,
    categories: d.categories,
    expenses: d.expenses,
    payments: d.payments,
    recurringExpenses: d.recurringExpenses,
    activityLogs: Array.isArray(d.activityLogs) ? d.activityLogs : [],
    settings: d.settings ?? { currency: "INR", propertyName: "ParkLedger", monthStartDay: 1 }
  };
}