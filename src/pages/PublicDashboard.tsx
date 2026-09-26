import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import { ArrowUpRight, CalendarDays, CheckCircle2, CircleDollarSign, Download, Search, Users, Wallet, Receipt, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { money, currentMonth, monthLabel } from "../lib/utils";
import { buildLedger, localMonthKey, type Ledger } from "../lib/ledger";
import { buildReports, exportReportCsv, exportReportXlsx, exportReportPdf, type ReportDef } from "../lib/reports";
import { Metric } from "../components/Metric";
import { StatusBadge } from "../components/StatusBadge";
import { MonthlyBar, CategoryDonut } from "../components/Charts";

export function PublicDashboard({ section = "overview" }: { section?: string }) {
  const { data, error } = useApp();
  const goToAdmin = () => window.location.assign(`${import.meta.env.BASE_URL}admin.html#/login`);
  const navigate = useNavigate();
  const [month, setMonth] = useState(currentMonth());
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  const categoryMap = useMemo(() => new Map(data.categories.map(c => [c.id, c.name])), [data.categories]);
  const residentMap = useMemo(() => new Map(data.residents.map(r => [r.id, r])), [data.residents]);

  // Single source of truth for every money figure on this page: Overview
  // metrics, the dues table and Balances all read from the same ledger, so
  // "Collected" / "Outstanding" can never drift from the dues rows.
  const ledger = useMemo(() => buildLedger(data), [data]);

  const stats = useMemo(() => {
    const monthlyCents = data.expenses.filter(e => localMonthKey(e.date) === month).reduce((a, e) => a + e.amountCents, 0);
    return {
      total: ledger.totals.expenseCents,
      monthly: monthlyCents,
      owed: ledger.totals.allocatedCents,
      paid: ledger.totals.collectedCents,
      pending: ledger.totals.outstandingCents
    };
  }, [ledger, data.expenses, month]);

  const dues = ledger.rows
    .filter(row => row.resident.active)
    .map(row => ({ r: row.resident, owed: row.owedCents, paid: row.paidCents, remaining: row.remainingCents, status: row.status }))
    .sort((a, b) => b.remaining - a.remaining);

  const filteredExpenses = data.expenses.filter(e => {
    const text = `${e.title} ${e.description || ""} ${categoryMap.get(e.categoryId) || ""} ${residentMap.get(e.payerId)?.name || ""}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (category === "all" || e.categoryId === category) && (month === "all" || localMonthKey(e.date) === month);
  }).sort((a, b) => b.date.localeCompare(a.date));

  // Chart series are pre-converted to rupees by the ledger — never feed
  // Recharts or money() raw paise, or the axis reads 100x too large.
  const monthly = useMemo(() => ledger.monthlySeries(8), [ledger]);
  const monthlyAll = useMemo(() => ledger.monthlySeries(0), [ledger]);
  const cats = useMemo(() => ledger.categorySeries(6), [ledger]);
  const reports = useMemo(() => buildReports(data), [data]);

  const exportCsv = () => {
    const rows = [["Date", "Expense", "Category", "Payer", "Amount", "Type"], ...filteredExpenses.map(e => [
      e.date, e.title, categoryMap.get(e.categoryId) || "", residentMap.get(e.payerId)?.name || "", String(e.amountCents / 100), e.type
    ])];
    const csv = rows.map(r => r.map(v => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "parkledger-public-ledger.csv"; a.click();
  };
  const exportXlsx = () => {
    const rows = filteredExpenses.map(e => ({
      Date: e.date, Expense: e.title, Category: categoryMap.get(e.categoryId) || "",
      Payer: residentMap.get(e.payerId)?.name || "", Amount_INR: e.amountCents / 100, Type: e.type
    }));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Expenses");
    XLSX.writeFile(wb, "parkledger-public-ledger.xlsx");
  };
  const exportPdf = () => {
    const doc = new jsPDF({ orientation: "landscape" }); doc.setFontSize(18); doc.text("ParkLedger Public Ledger", 14, 16);
    doc.setFontSize(9);
    const rowsPerPage = 32;
    let y = 25;
    const header = () => { doc.text("Date", 14, y); doc.text("Expense", 40, y); doc.text("Category", 130, y); doc.text("Payer", 180, y); doc.text("Amount", 250, y); y += 6; };
    header();
    filteredExpenses.forEach((e, i) => {
      if (i > 0 && i % rowsPerPage === 0) { doc.addPage(); y = 20; header(); }
      doc.text(e.date, 14, y); doc.text(e.title.slice(0, 42), 40, y); doc.text((categoryMap.get(e.categoryId) || "").slice(0, 22), 130, y); doc.text((residentMap.get(e.payerId)?.name || "").slice(0, 22), 180, y); doc.text(money(e.amountCents), 250, y); y += 6;
    });
    doc.save("parkledger-public-ledger.pdf");
  };

  return (
    <>
      <div className="page-header">
        <div><div className="eyebrow">Shared parking ledger</div><h1>Know what the lot costs.</h1><p>Transparent, read-only figures for residents and stakeholders.</p></div>
        <div className="header-actions"><div className="header-actions"><button className="secondary-btn" onClick={exportCsv}><Download size={16} /> CSV</button><button className="secondary-btn" onClick={exportXlsx}>Excel</button><button className="secondary-btn" onClick={exportPdf}>PDF</button></div><button className="primary-btn" onClick={goToAdmin}>Admin access <ArrowUpRight size={16} /></button></div>
      </div>
      {error && <div className="notice error"><strong>Live data unavailable.</strong> {error}</div>}
      {section === "overview" && <>
        <div className="metrics-grid">
          <Metric label="Total expenses" value={money(stats.total)} note={`${data.expenses.length} records`} icon={<Wallet size={16} />} />
          <Metric label="This month" value={money(stats.monthly)} note={monthLabel(month)} icon={<CalendarDays size={16} />} />
          <Metric label="Collected" value={money(stats.paid)} note={`${stats.owed ? Math.round((stats.paid / stats.owed) * 100) : 0}% of allocated`} icon={<CheckCircle2 size={16} />} />
          <Metric label="Outstanding" value={money(stats.pending)} note={`${dues.filter(d => d.remaining > 0).length} people with dues`} icon={<CircleDollarSign size={16} />} />
        </div>
        <div className="dashboard-grid">
          <section className="panel span-2">
            <div className="panel-head"><div><h2>Spending over time</h2><p>Latest recorded months</p></div><span className="section-tag">INR</span></div>
            <MonthlyBar data={monthly} />
          </section>
          <section className="panel">
            <div className="panel-head"><div><h2>By category</h2><p>Where the money goes</p></div></div>
            {cats.length ? <CategoryDonut data={cats} /> : <Empty text="No expenses yet." />}
          </section>
          <section className="panel span-2">
            <div className="panel-head"><div><h2>Current dues</h2><p>Allocated shares against recorded payments</p></div><button className="text-btn" onClick={() => navigate("/dues")}>View all <ArrowUpRight size={14} /></button></div>
            <DuesTable dues={dues.slice(0, 6)} ledger={ledger} />
          </section>
          <section className="panel">
            <div className="panel-head"><div><h2>Recent activity</h2><p>Latest ledger entries</p></div></div>
            <div className="activity-list">{data.expenses.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6).map(e => <div className="activity-row" key={e.id}><div className="activity-icon"><ReceiptIcon /></div><div><strong>{e.title}</strong><small>{e.date} · {categoryMap.get(e.categoryId) || "Uncategorised"}</small></div><b>{money(e.amountCents)}</b></div>)}</div>
          </section>
        </div>
      </>}
      {section === "dues" && <section className="panel"><div className="panel-head"><div><h2>Current dues</h2><p>Person-wise balances with payment status</p></div></div><DuesTable dues={dues} ledger={ledger} /></section>}
      {section === "expenses" && <section className="panel"><ExpenseLedger expenses={filteredExpenses} categories={data.categories} categoryMap={categoryMap} residentMap={residentMap} query={query} setQuery={setQuery} category={category} setCategory={setCategory} month={month} setMonth={setMonth} /></section>}
      {section === "payments" && <section className="panel"><PaymentLedger payments={data.payments} residents={residentMap} expenses={data.expenses} /></section>}
      {section === "balances" && <section className="panel"><div className="panel-head"><div><h2>Balances</h2><p>Running credits and outstanding dues</p></div></div><DuesTable dues={dues} ledger={ledger} showCredit /></section>}
      {section === "history" && <section className="panel"><History data={monthlyAll} /></section>}
      {section === "analytics" && <div className="dashboard-grid"><section className="panel span-2"><div className="panel-head"><div><h2>Monthly trend</h2><p>Recorded spending</p></div></div><MonthlyBar data={monthly} /></section><section className="panel"><div className="panel-head"><div><h2>Category mix</h2><p>All time</p></div></div><CategoryDonut data={cats} /></section></div>}
      {section === "reports" && <Reports reports={reports} />}
    </>
  );
}

function DuesTable({ dues, ledger, showCredit }: { dues: { r: any; owed: number; paid: number; remaining: number; status: any }[]; ledger: Ledger; showCredit?: boolean }) {
  return <div className="table-wrap"><table><thead><tr><th>Resident</th><th>Allocated</th><th>Paid</th><th>{showCredit ? "Balance" : "Remaining"}</th><th>Status</th></tr></thead><tbody>{dues.map(d => {
    const isCredit = d.remaining < 0;
    const displayCents = showCredit ? Math.abs(d.remaining) : Math.max(0, d.remaining);
    return <tr key={d.r.id}><td><strong>{d.r.name}</strong><small>Flat {ledger.flatNumber(d.r.flatId)}</small></td><td>{money(d.owed)}</td><td>{money(d.paid)}</td><td className={d.remaining > 0 ? "danger-text" : ""}>{isCredit ? "+ " : ""}{money(displayCents)}</td><td><StatusBadge status={d.status} /></td></tr>;
  })}</tbody></table></div>;
}
function ExpenseLedger({ expenses, categories, categoryMap, residentMap, query, setQuery, category, setCategory, month, setMonth }: any) {
  const months: string[] = Array.from(new Set<string>(expenses.map((e: any) => String(e.date).slice(0, 7)))).sort().reverse();
  return <><div className="filters"><label className="search-box"><Search size={16} /><input placeholder="Search expenses, people, categories…" value={query} onChange={e => setQuery(e.target.value)} /></label><select value={month} onChange={e => setMonth(e.target.value)}><option value="all">All months</option>{months.map((m: string) => <option key={m} value={m}>{monthLabel(m)}</option>)}</select><select value={category} onChange={e => setCategory(e.target.value)}><option value="all">All categories</option>{categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>{expenses.length ? <div className="table-wrap"><table><thead><tr><th>Date</th><th>Expense</th><th>Category</th><th>Payer</th><th>Type</th><th>Amount</th></tr></thead><tbody>{expenses.map((e: any) => <tr key={e.id}><td>{e.date}{e.dueDate && e.dueDate < new Date().toISOString().slice(0, 10) && <small className="danger-text"> · Overdue</small>}</td><td><strong>{e.title}</strong><small>{e.description || "No notes"}</small></td><td>{categoryMap.get(e.categoryId) || "Uncategorised"}</td><td>{residentMap.get(e.payerId)?.name || "Unknown"}</td><td><span className="section-tag">{e.type}</span></td><td><strong>{money(e.amountCents)}</strong></td></tr>)}</tbody></table></div> : <Empty text="No expenses match these filters." />}</>;
}
function PaymentLedger({ payments, residents, expenses }: any) {
  const expenseMap = new Map<string, string>(expenses.map((e: any) => [e.id, e.title]));
  return payments.length ? <div className="table-wrap"><table><thead><tr><th>Date</th><th>Resident</th><th>Amount</th><th>Linked expense</th><th>Note</th></tr></thead><tbody>{payments.slice().sort((a: any, b: any) => b.date.localeCompare(a.date)).map((p: any) => <tr key={p.id}><td>{p.date}</td><td>{residents.get(p.residentId)?.name || "Unknown"}</td><td><strong>{money(p.amountCents)}</strong></td><td>{p.expenseId ? (expenseMap.get(p.expenseId) || "—") : "—"}</td><td>{p.note || "—"}</td></tr>)}</tbody></table></div> : <Empty text="No payments recorded yet." />;
}
function History({ data }: { data: { month: string; amount: number }[] }) { return data.length ? <div className="history-grid">{data.map(x => <div className="history-item" key={x.month}><span>{x.month}</span><strong>{money(x.amount * 100)}</strong></div>)}</div> : <Empty text="No history yet." />; }
function Reports({ reports }: { reports: ReportDef[] }) {
  return <div className="report-grid">{reports.map(r => (
    <div className="report-card" key={r.id}>
      <FileIcon />
      <h3>{r.label}</h3>
      <p>{r.description}</p>
      <div className="button-stack">
        <button className="secondary-btn" onClick={() => exportReportCsv(r)}><Download size={14} /> CSV</button>
        <button className="secondary-btn" onClick={() => exportReportXlsx(r)}>Excel</button>
        <button className="secondary-btn" onClick={() => exportReportPdf(r)}>PDF</button>
      </div>
    </div>
  ))}</div>;
}
function Empty({ text }: { text: string }) { return <div className="empty">{text}</div>; }
function ReceiptIcon() { return <Receipt size={17} /> }
function FileIcon() { return <FileText size={20} /> }
