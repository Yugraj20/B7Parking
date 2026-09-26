// Shared report layer. Each of the 6 report cards (Public and Admin) reads
// its rows from here so every report actually exports a distinct dataset
// instead of all six re-exporting the same expense list.
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import type { AppData } from "../types";
import { buildLedger } from "./ledger";

// ---- Excel/Sheets formula-injection sanitizing ----------------------------
// A cell whose text begins with =, +, - or @ can be auto-interpreted as a
// formula when the exported file is opened in Excel/Sheets/LibreOffice —
// dangerous when the text originated from user input (expense titles,
// resident names, notes). Prefix with an apostrophe to force literal text.
// Only applied to text cells; numeric amounts are written as real numbers
// so a legitimately negative figure is never mistaken for a formula.
const DANGEROUS_PREFIX = /^[=+\-@]/;
export function sanitizeCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return DANGEROUS_PREFIX.test(s) ? `'${s}` : s;
}

export interface ReportColumn {
  header: string;
  numeric?: boolean; // written as a real number, never sanitized
}

export interface ReportDef {
  id: string;
  label: string;
  description: string;
  filenameBase: string;
  columns: ReportColumn[];
  rows: (string | number)[][];
}

function two(cents: number): number {
  return Math.round((cents / 100) * 100) / 100;
}

export function buildReports(data: AppData): ReportDef[] {
  const ledger = buildLedger(data);
  const categoryMap = new Map(data.categories.map(c => [c.id, c.name]));
  const residentMap = new Map(data.residents.map(r => [r.id, r]));
  const expenseTitleMap = new Map(data.expenses.map(e => [e.id, e.title]));

  // 1. Monthly — expense count + total per calendar month, every month on record.
  const monthlyRows = ledger.monthlySeries(0).map(m => {
    const count = data.expenses.filter(e => e.date.slice(0, 7) === m.monthKey).length;
    return [m.month, count, Number(m.amount.toFixed(2))] as (string | number)[];
  });

  // 2. Yearly — same idea, rolled up to calendar year.
  const yearTotals = new Map<string, { count: number; totalCents: number }>();
  data.expenses.forEach(e => {
    const year = String(e.date || "").slice(0, 4) || "Unknown";
    const cur = yearTotals.get(year) || { count: 0, totalCents: 0 };
    cur.count += 1;
    cur.totalCents += e.amountCents;
    yearTotals.set(year, cur);
  });
  const yearlyRows = [...yearTotals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, v]) => [year, v.count, two(v.totalCents)] as (string | number)[]);

  // 3. Expense — the full expense ledger.
  const expenseRows = data.expenses
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(e => [
      e.date,
      e.title,
      categoryMap.get(e.categoryId) || "Uncategorised",
      residentMap.get(e.payerId)?.name || "Unknown",
      e.type,
      two(e.amountCents)
    ] as (string | number)[]);

  // 4. Payment — the full payment ledger.
  const paymentRows = data.payments
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(p => [
      p.date,
      residentMap.get(p.residentId)?.name || "Unknown",
      two(p.amountCents),
      p.expenseId ? (expenseTitleMap.get(p.expenseId) || "—") : "—",
      p.note || ""
    ] as (string | number)[]);

  // 5. Outstanding dues — only residents who currently owe money.
  const outstandingRows = ledger.rows
    .filter(r => r.remainingCents > 0)
    .sort((a, b) => b.remainingCents - a.remainingCents)
    .map(r => [
      r.resident.name,
      ledger.flatNumber(r.resident.flatId),
      two(r.owedCents),
      two(r.paidCents),
      two(r.remainingCents),
      r.status
    ] as (string | number)[]);

  // 6. Resident — per-resident balance summary, every resident (active or not).
  const residentRows = ledger.rows
    .slice()
    .sort((a, b) => a.resident.name.localeCompare(b.resident.name))
    .map(r => [
      r.resident.name,
      ledger.flatNumber(r.resident.flatId),
      r.resident.shares,
      r.resident.active ? "Active" : "Inactive",
      two(r.owedCents),
      two(r.paidCents),
      two(r.remainingCents), // positive = owes, negative = credit
      r.status
    ] as (string | number)[]);

  return [
    {
      id: "monthly",
      label: "Monthly report",
      description: "Expense count and total, one row per calendar month.",
      filenameBase: "monthly-report",
      columns: [
        { header: "Month" },
        { header: "Expenses", numeric: true },
        { header: "Total (INR)", numeric: true }
      ],
      rows: monthlyRows
    },
    {
      id: "yearly",
      label: "Yearly report",
      description: "Expense count and total, one row per calendar year.",
      filenameBase: "yearly-report",
      columns: [
        { header: "Year" },
        { header: "Expenses", numeric: true },
        { header: "Total (INR)", numeric: true }
      ],
      rows: yearlyRows
    },
    {
      id: "expense",
      label: "Expense report",
      description: "The full expense ledger, newest first.",
      filenameBase: "expense-report",
      columns: [
        { header: "Date" },
        { header: "Expense" },
        { header: "Category" },
        { header: "Payer" },
        { header: "Type" },
        { header: "Amount (INR)", numeric: true }
      ],
      rows: expenseRows
    },
    {
      id: "payment",
      label: "Payment report",
      description: "Every recorded payment, newest first.",
      filenameBase: "payment-report",
      columns: [
        { header: "Date" },
        { header: "Resident" },
        { header: "Amount (INR)", numeric: true },
        { header: "Linked expense" },
        { header: "Note" }
      ],
      rows: paymentRows
    },
    {
      id: "outstanding",
      label: "Outstanding dues",
      description: "Residents who currently owe money, largest balance first.",
      filenameBase: "outstanding-dues",
      columns: [
        { header: "Resident" },
        { header: "Flat" },
        { header: "Owed (INR)", numeric: true },
        { header: "Paid (INR)", numeric: true },
        { header: "Outstanding (INR)", numeric: true },
        { header: "Status" }
      ],
      rows: outstandingRows
    },
    {
      id: "resident",
      label: "Resident report",
      description: "Per-resident balance summary, active and inactive.",
      filenameBase: "resident-report",
      columns: [
        { header: "Resident" },
        { header: "Flat" },
        { header: "Shares", numeric: true },
        { header: "Active" },
        { header: "Owed (INR)", numeric: true },
        { header: "Paid (INR)", numeric: true },
        { header: "Balance (INR)", numeric: true },
        { header: "Status" }
      ],
      rows: residentRows
    }
  ];
}

// ---- Export -----------------------------------------------------------

function sanitizedGrid(report: ReportDef): (string | number)[][] {
  const headers = report.columns.map(c => c.header);
  const rows = report.rows.map(row =>
    row.map((cell, i) => (report.columns[i].numeric ? cell : sanitizeCell(cell)))
  );
  return [headers, ...rows];
}

export function exportReportCsv(report: ReportDef) {
  const grid = sanitizedGrid(report);
  const csv = grid
    .map(row => row.map(v => `"${String(v).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `parkledger-${report.filenameBase}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportReportXlsx(report: ReportDef) {
  const grid = sanitizedGrid(report);
  const ws = XLSX.utils.aoa_to_sheet(grid);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, report.label.slice(0, 31));
  XLSX.writeFile(wb, `parkledger-${report.filenameBase}.xlsx`);
}

export function exportReportPdf(report: ReportDef) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(18);
  doc.text(`ParkLedger — ${report.label}`, 14, 16);
  doc.setFontSize(9);

  const rowsPerPage = 32;
  const usableWidth = 270;
  const colX = report.columns.map((_, i) => 14 + i * (usableWidth / report.columns.length));
  let y = 25;

  const header = () => {
    report.columns.forEach((c, i) => doc.text(c.header, colX[i], y));
    y += 6;
  };
  header();

  report.rows.forEach((row, idx) => {
    if (idx > 0 && idx % rowsPerPage === 0) {
      doc.addPage();
      y = 20;
      header();
    }
    row.forEach((cell, i) => {
      const text =
        report.columns[i].numeric && typeof cell === "number"
          ? cell.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : String(cell);
      doc.text(text.slice(0, 28), colX[i], y);
    });
    y += 6;
  });

  doc.save(`parkledger-${report.filenameBase}.pdf`);
}
