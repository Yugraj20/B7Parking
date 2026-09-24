import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import { ArrowUpRight, CalendarDays, CheckCircle2, CircleDollarSign, Download, Search, Users, Wallet, Receipt, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { money, currentMonth, monthKey, monthLabel, statusFor } from "../lib/utils";
import { Metric } from "../components/Metric";
import { StatusBadge } from "../components/StatusBadge";
import { MonthlyBar, CategoryDonut } from "../components/Charts";

export function PublicDashboard({ section="overview" }: { section?: string }) {
  const { data, error } = useApp();
  const goToAdmin = () => window.location.assign(`${import.meta.env.BASE_URL}admin.html#/login`);
  const navigate = useNavigate();
  const [month, setMonth] = useState(currentMonth());
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  const categoryMap = useMemo(() => new Map(data.categories.map(c => [c.id,c.name])), [data.categories]);
  const residentMap = useMemo(() => new Map(data.residents.map(r => [r.id,r])), [data.residents]);
  const paidByResident = useMemo(() => {
    const m = new Map<string,number>();
    // The upfront payer is automatically credited for their own allocated share.
    data.expenses.forEach(e => {
      const ownShare = Number(e.split?.[e.payerId] ?? 0);
      if (ownShare) m.set(e.payerId, (m.get(e.payerId)||0) + ownShare);
    });
    data.payments.forEach(p => m.set(p.residentId, (m.get(p.residentId)||0)+p.amountCents));
    return m;
  }, [data.expenses, data.payments]);

  const expenseSplits = useMemo(() => {
    const m = new Map<string, number>();
    data.expenses.forEach(e => Object.entries(e.split ?? {}).forEach(([rid,amount]) => m.set(rid,(m.get(rid)||0)+Number(amount))));
    return m;
  }, [data.expenses]);

  const stats = useMemo(() => {
    const total = data.expenses.reduce((a,e)=>a+e.amountCents,0);
    const monthly = data.expenses.filter(e=>monthKey(e.date)===month).reduce((a,e)=>a+e.amountCents,0);
    const owed = [...expenseSplits.values()].reduce((a,v)=>a+v,0);
    const paid = data.payments.reduce((a,p)=>a+p.amountCents,0);
    return {total,monthly,owed,paid,pending:Math.max(0,owed-paid)};
  }, [data.expenses,data.payments,expenseSplits,month]);

  const dues = data.residents.filter(r=>r.active).map(r => {
    const owed = expenseSplits.get(r.id)||0;
    const paid = paidByResident.get(r.id)||0;
    return {r,owed,paid,remaining:Math.max(0,owed-paid),status:statusFor(owed,paid)};
  }).sort((a,b)=>b.remaining-a.remaining);

  const filteredExpenses = data.expenses.filter(e => {
    const text = `${e.title} ${e.description||""} ${categoryMap.get(e.categoryId)||""} ${residentMap.get(e.payerId)?.name||""}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (category==="all" || e.categoryId===category) && (month==="all" || monthKey(e.date)===month);
  }).sort((a,b)=>b.date.localeCompare(a.date));

  const monthly = useMemo(() => {
    const map = new Map<string,number>();
    data.expenses.forEach(e => map.set(monthKey(e.date),(map.get(monthKey(e.date))||0)+e.amountCents));
    return [...map.entries()].sort().slice(-8).map(([m,amount])=>({month:monthLabel(m),amount}));
  }, [data.expenses]);

  const cats = useMemo(() => {
    const map = new Map<string,number>();
    data.expenses.forEach(e => map.set(categoryMap.get(e.categoryId)||"Uncategorised",(map.get(categoryMap.get(e.categoryId)||"Uncategorised")||0)+e.amountCents));
    return [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6).map(([name,amount])=>({name,amount}));
  }, [data.expenses,categoryMap]);

  const exportCsv = () => {
    const rows = [["Date","Expense","Category","Payer","Amount","Type"], ...filteredExpenses.map(e=>[
      e.date,e.title,categoryMap.get(e.categoryId)||"",residentMap.get(e.payerId)?.name||"",String(e.amountCents/100),e.type
    ])];
    const csv = rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");
    const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"})); a.download="parkledger-public-ledger.csv"; a.click();
  };
  const exportXlsx = () => {
    const rows = filteredExpenses.map(e => ({
      Date:e.date, Expense:e.title, Category:categoryMap.get(e.categoryId)||"",
      Payer:residentMap.get(e.payerId)?.name||"", Amount_INR:e.amountCents/100, Type:e.type
    }));
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),"Expenses");
    XLSX.writeFile(wb,"parkledger-public-ledger.xlsx");
  };
  const exportPdf = () => {
    const doc=new jsPDF({orientation:"landscape"}); doc.setFontSize(18); doc.text("ParkLedger Public Ledger",14,16);
    doc.setFontSize(9); let y=25; doc.text("Date",14,y); doc.text("Expense",40,y); doc.text("Category",130,y); doc.text("Payer",180,y); doc.text("Amount",250,y); y+=6;
    filteredExpenses.slice(0,35).forEach(e=>{doc.text(e.date,14,y);doc.text(e.title.slice(0,42),40,y);doc.text((categoryMap.get(e.categoryId)||"").slice(0,22),130,y);doc.text((residentMap.get(e.payerId)?.name||"").slice(0,22),180,y);doc.text(money(e.amountCents),250,y);y+=6});
    doc.save("parkledger-public-ledger.pdf");
  };

  return (
    <>
      <div className="page-header">
        <div><div className="eyebrow">Shared parking ledger</div><h1>Know what the lot costs.</h1><p>Transparent, read-only figures for residents and stakeholders.</p></div>
        <div className="header-actions"><div className="header-actions"><button className="secondary-btn" onClick={exportCsv}><Download size={16}/> CSV</button><button className="secondary-btn" onClick={exportXlsx}>Excel</button><button className="secondary-btn" onClick={exportPdf}>PDF</button></div><button className="primary-btn" onClick={goToAdmin}>Admin access <ArrowUpRight size={16}/></button></div>
      </div>
      {error && <div className="notice error"><strong>Live data unavailable.</strong> {error}</div>}
      {section==="overview" && <>
        <div className="metrics-grid">
          <Metric label="Total expenses" value={money(stats.total)} note={`${data.expenses.length} records`} icon={<Wallet size={16}/>} />
          <Metric label="This month" value={money(stats.monthly)} note={monthLabel(month)} icon={<CalendarDays size={16}/>} />
          <Metric label="Collected" value={money(stats.paid)} note={`${stats.owed ? Math.round((stats.paid/stats.owed)*100) : 0}% of allocated`} icon={<CheckCircle2 size={16}/>} />
          <Metric label="Outstanding" value={money(stats.pending)} note={`${dues.filter(d=>d.remaining>0).length} people with dues`} icon={<CircleDollarSign size={16}/>} />
        </div>
        <div className="dashboard-grid">
          <section className="panel span-2">
            <div className="panel-head"><div><h2>Spending over time</h2><p>Latest recorded months</p></div><span className="section-tag">INR</span></div>
            <MonthlyBar data={monthly}/>
          </section>
          <section className="panel">
            <div className="panel-head"><div><h2>By category</h2><p>Where the money goes</p></div></div>
            {cats.length ? <CategoryDonut data={cats}/> : <Empty text="No expenses yet."/>}
          </section>
          <section className="panel span-2">
            <div className="panel-head"><div><h2>Current dues</h2><p>Allocated shares against recorded payments</p></div><button className="text-btn" onClick={()=>navigate("/dues")}>View all <ArrowUpRight size={14}/></button></div>
            <DuesTable dues={dues.slice(0,6)}/>
          </section>
          <section className="panel">
            <div className="panel-head"><div><h2>Recent activity</h2><p>Latest ledger entries</p></div></div>
            <div className="activity-list">{data.expenses.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6).map(e=><div className="activity-row" key={e.id}><div className="activity-icon"><ReceiptIcon/></div><div><strong>{e.title}</strong><small>{e.date} · {categoryMap.get(e.categoryId)||"Uncategorised"}</small></div><b>{money(e.amountCents)}</b></div>)}</div>
          </section>
        </div>
      </>}
      {section==="dues" && <section className="panel"><div className="panel-head"><div><h2>Current dues</h2><p>Person-wise balances with payment status</p></div></div><DuesTable dues={dues}/></section>}
      {section==="expenses" && <section className="panel"><ExpenseLedger expenses={filteredExpenses} categories={data.categories} categoryMap={categoryMap} residentMap={residentMap} query={query} setQuery={setQuery} category={category} setCategory={setCategory} month={month} setMonth={setMonth}/></section>}
      {section==="payments" && <section className="panel"><PaymentLedger payments={data.payments} residents={residentMap}/></section>}
      {section==="balances" && <section className="panel"><DuesTable dues={dues}/></section>}
      {section==="history" && <section className="panel"><History data={monthly}/></section>}
      {section==="analytics" && <div className="dashboard-grid"><section className="panel span-2"><div className="panel-head"><div><h2>Monthly trend</h2><p>Recorded spending</p></div></div><MonthlyBar data={monthly}/></section><section className="panel"><div className="panel-head"><div><h2>Category mix</h2><p>All time</p></div></div><CategoryDonut data={cats}/></section></div>}
      {section==="reports" && <Reports onExport={exportCsv}/>}
    </>
  );
}

function DuesTable({dues}: {dues:{r:any;owed:number;paid:number;remaining:number;status:any}[]}) {
  return <div className="table-wrap"><table><thead><tr><th>Resident</th><th>Allocated</th><th>Paid</th><th>Remaining</th><th>Status</th></tr></thead><tbody>{dues.map(d=><tr key={d.r.id}><td><strong>{d.r.name}</strong><small>Flat {d.r.flatId}</small></td><td>{money(d.owed)}</td><td>{money(d.paid)}</td><td className={d.remaining ? "danger-text" : ""}>{money(d.remaining)}</td><td><StatusBadge status={d.status}/></td></tr>)}</tbody></table></div>;
}
function ExpenseLedger({expenses,categories,categoryMap,residentMap,query,setQuery,category,setCategory,month,setMonth}:any) {
  const months: string[] = Array.from(new Set<string>(expenses.map((e:any)=>String(monthKey(e.date))))).sort().reverse();
  return <><div className="filters"><label className="search-box"><Search size={16}/><input placeholder="Search expenses, people, categories…" value={query} onChange={e=>setQuery(e.target.value)}/></label><select value={month} onChange={e=>setMonth(e.target.value)}><option value="all">All months</option>{months.map((m:string)=><option key={m} value={m}>{monthLabel(m)}</option>)}</select><select value={category} onChange={e=>setCategory(e.target.value)}><option value="all">All categories</option>{categories.map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Expense</th><th>Category</th><th>Payer</th><th>Type</th><th>Amount</th></tr></thead><tbody>{expenses.map((e:any)=><tr key={e.id}><td>{e.date}</td><td><strong>{e.title}</strong><small>{e.description||"No notes"}</small></td><td>{categoryMap.get(e.categoryId)||"Uncategorised"}</td><td>{residentMap.get(e.payerId)?.name||"Unknown"}</td><td><span className="section-tag">{e.type}</span></td><td><strong>{money(e.amountCents)}</strong></td></tr>)}</tbody></table></div></>;
}
function PaymentLedger({payments,residents}:any) { return <div className="table-wrap"><table><thead><tr><th>Date</th><th>Resident</th><th>Amount</th><th>Note</th></tr></thead><tbody>{payments.slice().sort((a:any,b:any)=>b.date.localeCompare(a.date)).map((p:any)=><tr key={p.id}><td>{p.date}</td><td>{residents.get(p.residentId)?.name||"Unknown"}</td><td><strong>{money(p.amountCents)}</strong></td><td>{p.note||"—"}</td></tr>)}</tbody></table></div>; }
function History({data}:{data:{month:string;amount:number}[]}) { return <div className="history-grid">{data.map(x=><div className="history-item" key={x.month}><span>{x.month}</span><strong>{money(x.amount)}</strong></div>)}</div>; }
function Reports({onExport}:{onExport:()=>void}) { return <div className="report-grid">{["Monthly report","Yearly overview","Expense report","Payment report","Outstanding dues","Resident report"].map(x=><div className="report-card" key={x}><FileIcon/><h3>{x}</h3><p>Generate from the live Firestore ledger.</p><button className="secondary-btn" onClick={onExport}>Export CSV <Download size={14}/></button></div>)}</div>; }
function Empty({text}:{text:string}) { return <div className="empty">{text}</div>; }
function ReceiptIcon(){return <Receipt size={17}/>}
function FileIcon(){return <FileText size={20}/>}