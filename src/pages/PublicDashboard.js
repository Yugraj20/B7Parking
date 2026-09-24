import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import { ArrowUpRight, CalendarDays, CheckCircle2, CircleDollarSign, Download, Search, Wallet, Receipt, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { money, currentMonth, monthKey, monthLabel, statusFor } from "../lib/utils";
import { Metric } from "../components/Metric";
import { StatusBadge } from "../components/StatusBadge";
import { MonthlyBar, CategoryDonut } from "../components/Charts";
export function PublicDashboard({ section = "overview" }) {
    const { data, login, error } = useApp();
    const navigate = useNavigate();
    const [month, setMonth] = useState(currentMonth());
    const [query, setQuery] = useState("");
    const [category, setCategory] = useState("all");
    const categoryMap = useMemo(() => new Map(data.categories.map(c => [c.id, c.name])), [data.categories]);
    const residentMap = useMemo(() => new Map(data.residents.map(r => [r.id, r])), [data.residents]);
    const paidByResident = useMemo(() => {
        const m = new Map();
        // The upfront payer is automatically credited for their own allocated share.
        data.expenses.forEach(e => {
            const ownShare = Number(e.split?.[e.payerId] ?? 0);
            if (ownShare)
                m.set(e.payerId, (m.get(e.payerId) || 0) + ownShare);
        });
        data.payments.forEach(p => m.set(p.residentId, (m.get(p.residentId) || 0) + p.amountCents));
        return m;
    }, [data.expenses, data.payments]);
    const expenseSplits = useMemo(() => {
        const m = new Map();
        data.expenses.forEach(e => Object.entries(e.split ?? {}).forEach(([rid, amount]) => m.set(rid, (m.get(rid) || 0) + Number(amount))));
        return m;
    }, [data.expenses]);
    const stats = useMemo(() => {
        const total = data.expenses.reduce((a, e) => a + e.amountCents, 0);
        const monthly = data.expenses.filter(e => monthKey(e.date) === month).reduce((a, e) => a + e.amountCents, 0);
        const owed = [...expenseSplits.values()].reduce((a, v) => a + v, 0);
        const paid = data.payments.reduce((a, p) => a + p.amountCents, 0);
        return { total, monthly, owed, paid, pending: Math.max(0, owed - paid) };
    }, [data.expenses, data.payments, expenseSplits, month]);
    const dues = data.residents.filter(r => r.active).map(r => {
        const owed = expenseSplits.get(r.id) || 0;
        const paid = paidByResident.get(r.id) || 0;
        return { r, owed, paid, remaining: Math.max(0, owed - paid), status: statusFor(owed, paid) };
    }).sort((a, b) => b.remaining - a.remaining);
    const filteredExpenses = data.expenses.filter(e => {
        const text = `${e.title} ${e.description || ""} ${categoryMap.get(e.categoryId) || ""} ${residentMap.get(e.payerId)?.name || ""}`.toLowerCase();
        return text.includes(query.toLowerCase()) && (category === "all" || e.categoryId === category) && (month === "all" || monthKey(e.date) === month);
    }).sort((a, b) => b.date.localeCompare(a.date));
    const monthly = useMemo(() => {
        const map = new Map();
        data.expenses.forEach(e => map.set(monthKey(e.date), (map.get(monthKey(e.date)) || 0) + e.amountCents));
        return [...map.entries()].sort().slice(-8).map(([m, amount]) => ({ month: monthLabel(m), amount }));
    }, [data.expenses]);
    const cats = useMemo(() => {
        const map = new Map();
        data.expenses.forEach(e => map.set(categoryMap.get(e.categoryId) || "Uncategorised", (map.get(categoryMap.get(e.categoryId) || "Uncategorised") || 0) + e.amountCents));
        return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, amount]) => ({ name, amount }));
    }, [data.expenses, categoryMap]);
    const exportCsv = () => {
        const rows = [["Date", "Expense", "Category", "Payer", "Amount", "Type"], ...filteredExpenses.map(e => [
                e.date, e.title, categoryMap.get(e.categoryId) || "", residentMap.get(e.payerId)?.name || "", String(e.amountCents / 100), e.type
            ])];
        const csv = rows.map(r => r.map(v => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n");
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
        a.download = "parkledger-public-ledger.csv";
        a.click();
    };
    const exportXlsx = () => {
        const rows = filteredExpenses.map(e => ({
            Date: e.date, Expense: e.title, Category: categoryMap.get(e.categoryId) || "",
            Payer: residentMap.get(e.payerId)?.name || "", Amount_INR: e.amountCents / 100, Type: e.type
        }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Expenses");
        XLSX.writeFile(wb, "parkledger-public-ledger.xlsx");
    };
    const exportPdf = () => {
        const doc = new jsPDF({ orientation: "landscape" });
        doc.setFontSize(18);
        doc.text("ParkLedger Public Ledger", 14, 16);
        doc.setFontSize(9);
        let y = 25;
        doc.text("Date", 14, y);
        doc.text("Expense", 40, y);
        doc.text("Category", 130, y);
        doc.text("Payer", 180, y);
        doc.text("Amount", 250, y);
        y += 6;
        filteredExpenses.slice(0, 35).forEach(e => { doc.text(e.date, 14, y); doc.text(e.title.slice(0, 42), 40, y); doc.text((categoryMap.get(e.categoryId) || "").slice(0, 22), 130, y); doc.text((residentMap.get(e.payerId)?.name || "").slice(0, 22), 180, y); doc.text(money(e.amountCents), 250, y); y += 6; });
        doc.save("parkledger-public-ledger.pdf");
    };
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "page-header", children: [_jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: "Shared parking ledger" }), _jsx("h1", { children: "Know what the lot costs." }), _jsx("p", { children: "Transparent, read-only figures for residents and stakeholders." })] }), _jsxs("div", { className: "header-actions", children: [_jsxs("div", { className: "header-actions", children: [_jsxs("button", { className: "secondary-btn", onClick: exportCsv, children: [_jsx(Download, { size: 16 }), " CSV"] }), _jsx("button", { className: "secondary-btn", onClick: exportXlsx, children: "Excel" }), _jsx("button", { className: "secondary-btn", onClick: exportPdf, children: "PDF" })] }), _jsxs("button", { className: "primary-btn", onClick: login, children: ["Admin access ", _jsx(ArrowUpRight, { size: 16 })] })] })] }), error && _jsxs("div", { className: "notice error", children: [_jsx("strong", { children: "Live data unavailable." }), " ", error] }), section === "overview" && _jsxs(_Fragment, { children: [_jsxs("div", { className: "metrics-grid", children: [_jsx(Metric, { label: "Total expenses", value: money(stats.total), note: `${data.expenses.length} records`, icon: _jsx(Wallet, { size: 16 }) }), _jsx(Metric, { label: "This month", value: money(stats.monthly), note: monthLabel(month), icon: _jsx(CalendarDays, { size: 16 }) }), _jsx(Metric, { label: "Collected", value: money(stats.paid), note: `${stats.owed ? Math.round((stats.paid / stats.owed) * 100) : 0}% of allocated`, icon: _jsx(CheckCircle2, { size: 16 }) }), _jsx(Metric, { label: "Outstanding", value: money(stats.pending), note: `${dues.filter(d => d.remaining > 0).length} people with dues`, icon: _jsx(CircleDollarSign, { size: 16 }) })] }), _jsxs("div", { className: "dashboard-grid", children: [_jsxs("section", { className: "panel span-2", children: [_jsxs("div", { className: "panel-head", children: [_jsxs("div", { children: [_jsx("h2", { children: "Spending over time" }), _jsx("p", { children: "Latest recorded months" })] }), _jsx("span", { className: "section-tag", children: "INR" })] }), _jsx(MonthlyBar, { data: monthly })] }), _jsxs("section", { className: "panel", children: [_jsx("div", { className: "panel-head", children: _jsxs("div", { children: [_jsx("h2", { children: "By category" }), _jsx("p", { children: "Where the money goes" })] }) }), cats.length ? _jsx(CategoryDonut, { data: cats }) : _jsx(Empty, { text: "No expenses yet." })] }), _jsxs("section", { className: "panel span-2", children: [_jsxs("div", { className: "panel-head", children: [_jsxs("div", { children: [_jsx("h2", { children: "Current dues" }), _jsx("p", { children: "Allocated shares against recorded payments" })] }), _jsxs("button", { className: "text-btn", onClick: () => navigate("/dues"), children: ["View all ", _jsx(ArrowUpRight, { size: 14 })] })] }), _jsx(DuesTable, { dues: dues.slice(0, 6) })] }), _jsxs("section", { className: "panel", children: [_jsx("div", { className: "panel-head", children: _jsxs("div", { children: [_jsx("h2", { children: "Recent activity" }), _jsx("p", { children: "Latest ledger entries" })] }) }), _jsx("div", { className: "activity-list", children: data.expenses.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6).map(e => _jsxs("div", { className: "activity-row", children: [_jsx("div", { className: "activity-icon", children: _jsx(ReceiptIcon, {}) }), _jsxs("div", { children: [_jsx("strong", { children: e.title }), _jsxs("small", { children: [e.date, " \u00B7 ", categoryMap.get(e.categoryId) || "Uncategorised"] })] }), _jsx("b", { children: money(e.amountCents) })] }, e.id)) })] })] })] }), section === "dues" && _jsxs("section", { className: "panel", children: [_jsx("div", { className: "panel-head", children: _jsxs("div", { children: [_jsx("h2", { children: "Current dues" }), _jsx("p", { children: "Person-wise balances with payment status" })] }) }), _jsx(DuesTable, { dues: dues })] }), section === "expenses" && _jsx("section", { className: "panel", children: _jsx(ExpenseLedger, { expenses: filteredExpenses, categories: data.categories, categoryMap: categoryMap, residentMap: residentMap, query: query, setQuery: setQuery, category: category, setCategory: setCategory, month: month, setMonth: setMonth }) }), section === "payments" && _jsx("section", { className: "panel", children: _jsx(PaymentLedger, { payments: data.payments, residents: residentMap }) }), section === "balances" && _jsx("section", { className: "panel", children: _jsx(DuesTable, { dues: dues }) }), section === "history" && _jsx("section", { className: "panel", children: _jsx(History, { data: monthly }) }), section === "analytics" && _jsxs("div", { className: "dashboard-grid", children: [_jsxs("section", { className: "panel span-2", children: [_jsx("div", { className: "panel-head", children: _jsxs("div", { children: [_jsx("h2", { children: "Monthly trend" }), _jsx("p", { children: "Recorded spending" })] }) }), _jsx(MonthlyBar, { data: monthly })] }), _jsxs("section", { className: "panel", children: [_jsx("div", { className: "panel-head", children: _jsxs("div", { children: [_jsx("h2", { children: "Category mix" }), _jsx("p", { children: "All time" })] }) }), _jsx(CategoryDonut, { data: cats })] })] }), section === "reports" && _jsx(Reports, { onExport: exportCsv })] }));
}
function DuesTable({ dues }) {
    return _jsx("div", { className: "table-wrap", children: _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Resident" }), _jsx("th", { children: "Allocated" }), _jsx("th", { children: "Paid" }), _jsx("th", { children: "Remaining" }), _jsx("th", { children: "Status" })] }) }), _jsx("tbody", { children: dues.map(d => _jsxs("tr", { children: [_jsxs("td", { children: [_jsx("strong", { children: d.r.name }), _jsxs("small", { children: ["Flat ", d.r.flatId] })] }), _jsx("td", { children: money(d.owed) }), _jsx("td", { children: money(d.paid) }), _jsx("td", { className: d.remaining ? "danger-text" : "", children: money(d.remaining) }), _jsx("td", { children: _jsx(StatusBadge, { status: d.status }) })] }, d.r.id)) })] }) });
}
function ExpenseLedger({ expenses, categories, categoryMap, residentMap, query, setQuery, category, setCategory, month, setMonth }) {
    const months = [...new Set(expenses.map((e) => monthKey(e.date)))].sort().reverse();
    return _jsxs(_Fragment, { children: [_jsxs("div", { className: "filters", children: [_jsxs("label", { className: "search-box", children: [_jsx(Search, { size: 16 }), _jsx("input", { placeholder: "Search expenses, people, categories\u2026", value: query, onChange: e => setQuery(e.target.value) })] }), _jsxs("select", { value: month, onChange: e => setMonth(e.target.value), children: [_jsx("option", { value: "all", children: "All months" }), months.map((m) => _jsx("option", { value: m, children: monthLabel(m) }, m))] }), _jsxs("select", { value: category, onChange: e => setCategory(e.target.value), children: [_jsx("option", { value: "all", children: "All categories" }), categories.map((c) => _jsx("option", { value: c.id, children: c.name }, c.id))] })] }), _jsx("div", { className: "table-wrap", children: _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Date" }), _jsx("th", { children: "Expense" }), _jsx("th", { children: "Category" }), _jsx("th", { children: "Payer" }), _jsx("th", { children: "Type" }), _jsx("th", { children: "Amount" })] }) }), _jsx("tbody", { children: expenses.map((e) => _jsxs("tr", { children: [_jsx("td", { children: e.date }), _jsxs("td", { children: [_jsx("strong", { children: e.title }), _jsx("small", { children: e.description || "No notes" })] }), _jsx("td", { children: categoryMap.get(e.categoryId) || "Uncategorised" }), _jsx("td", { children: residentMap.get(e.payerId)?.name || "Unknown" }), _jsx("td", { children: _jsx("span", { className: "section-tag", children: e.type }) }), _jsx("td", { children: _jsx("strong", { children: money(e.amountCents) }) })] }, e.id)) })] }) })] });
}
function PaymentLedger({ payments, residents }) { return _jsx("div", { className: "table-wrap", children: _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Date" }), _jsx("th", { children: "Resident" }), _jsx("th", { children: "Amount" }), _jsx("th", { children: "Note" })] }) }), _jsx("tbody", { children: payments.slice().sort((a, b) => b.date.localeCompare(a.date)).map((p) => _jsxs("tr", { children: [_jsx("td", { children: p.date }), _jsx("td", { children: residents.get(p.residentId)?.name || "Unknown" }), _jsx("td", { children: _jsx("strong", { children: money(p.amountCents) }) }), _jsx("td", { children: p.note || "—" })] }, p.id)) })] }) }); }
function History({ data }) { return _jsx("div", { className: "history-grid", children: data.map(x => _jsxs("div", { className: "history-item", children: [_jsx("span", { children: x.month }), _jsx("strong", { children: money(x.amount) })] }, x.month)) }); }
function Reports({ onExport }) { return _jsx("div", { className: "report-grid", children: ["Monthly report", "Yearly overview", "Expense report", "Payment report", "Outstanding dues", "Resident report"].map(x => _jsxs("div", { className: "report-card", children: [_jsx(FileIcon, {}), _jsx("h3", { children: x }), _jsx("p", { children: "Generate from the live Firestore ledger." }), _jsxs("button", { className: "secondary-btn", onClick: onExport, children: ["Export CSV ", _jsx(Download, { size: 14 })] })] }, x)) }); }
function Empty({ text }) { return _jsx("div", { className: "empty", children: text }); }
function ReceiptIcon() { return _jsx(Receipt, { size: 17 }); }
function FileIcon() { return _jsx(FileText, { size: 20 }); }
