import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import { Navigate } from "react-router-dom";
import { Plus, Save, Trash2, UserPlus, RefreshCw, Download, Upload, ShieldCheck, Receipt, Users, Wallet } from "lucide-react";
import { useApp } from "../context/AppContext";
import { cents, currentMonth, exactSplit, money, monthKey, monthLabel, sanitize, statusFor } from "../lib/utils";
import { saveDoc, removeDoc, recordPayment, writeActivity, updateSettings } from "../lib/firestore";
import { exportBackup, exportLegacyTxt, parseBackup } from "../lib/backup";
import { Metric } from "../components/Metric";
import { MonthlyBar, CategoryDonut } from "../components/Charts";
import { Modal } from "../components/Modal";
import { StatusBadge } from "../components/StatusBadge";

export function AdminDashboard({ section="overview" }: { section?: string }) {
  const { data, user, isAdmin } = useApp();
  const [modal,setModal]=useState<string|null>(null);
  const [saving,setSaving]=useState(false);
  const [toast,setToast]=useState("");
  if (!user || !isAdmin) return <Navigate to="/login" replace/>;

  const residentMap = new Map(data.residents.map(r=>[r.id,r]));
  const categoryMap = new Map(data.categories.map(c=>[c.id,c.name]));
  const split = new Map<string,number>();
  data.expenses.forEach(e=>Object.entries(e.split||{}).forEach(([id,v])=>split.set(id,(split.get(id)||0)+Number(v))));
  const paid = new Map<string,number>();
  data.payments.forEach(p=>paid.set(p.residentId,(paid.get(p.residentId)||0)+p.amountCents));
  const total = data.expenses.reduce((a,e)=>a+e.amountCents,0);
  const monthly = data.expenses.filter(e=>monthKey(e.date)===currentMonth()).reduce((a,e)=>a+e.amountCents,0);
  data.expenses.forEach(e => {
    const ownShare = Number(e.split?.[e.payerId] ?? 0);
    if (ownShare) paid.set(e.payerId, (paid.get(e.payerId)||0) + ownShare);
  });
  const pending = [...split.entries()].reduce((a,[id,v])=>a+Math.max(0,v-(paid.get(id)||0)),0);
  const monthlyData = useMemo(()=>{const m=new Map<string,number>(); data.expenses.forEach(e=>m.set(monthKey(e.date),(m.get(monthKey(e.date))||0)+e.amountCents)); return [...m.entries()].sort().slice(-8).map(([m,amount])=>({month:monthLabel(m),amount}));},[data.expenses]);
  const cats = useMemo(()=>{const m=new Map<string,number>(); data.expenses.forEach(e=>{const n=categoryMap.get(e.categoryId)||"Other";m.set(n,(m.get(n)||0)+e.amountCents)});return [...m.entries()].map(([name,amount])=>({name,amount}));},[data.expenses]);

  const notify = (s:string) => { setToast(s); window.setTimeout(()=>setToast(""),2800); };
  const activity = async (action:any, recordId?:string, recordLabel?:string) => writeActivity({action, actorEmail:user.email||"", recordId, recordLabel});

  const generateMonthly = async () => {
    setSaving(true);
    try {
      const month = currentMonth();
      let created=0;
      for (const r of data.recurringExpenses.filter(x=>x.active)) {
        if (r.lastGeneratedMonth === month) continue;
        const exists=data.expenses.some(e=>e.recurringId===r.id && monthKey(e.date)===month);
        if (exists) continue;
        const splitMap=exactSplit(r.amountCents,data.residents.filter(x=>x.active),r.splitMode,r.split);
        const id=await saveDoc("expenses",undefined,{title:r.title,amountCents:r.amountCents,categoryId:r.categoryId,payerId:r.payerId,date:`${month}-${String(r.dayOfMonth).padStart(2,"0")}`,type:"monthly",recurringId:r.id,splitMode:r.splitMode,split:splitMap});
        await saveDoc("recurringExpenses",r.id,{lastGeneratedMonth:month});
        await activity("monthly.generated",id,r.title); created++;
      }
      notify(created ? `${created} recurring expense(s) generated.` : "Nothing new to generate.");
    } finally { setSaving(false); }
  };

  const restore = async (file: File) => {
    setSaving(true);
    try {
      const text=await file.text(); const restored=parseBackup(text);
      if(!window.confirm("Restore this backup? Existing records with the same IDs will be replaced. New records will be added.")) return;
      for(const r of restored.residents) await saveDoc("residents",r.id,r as any);
      for(const f of restored.flats) await saveDoc("flats",f.id,f as any);
      for(const c of restored.categories) await saveDoc("categories",c.id,c as any);
      for(const e of restored.expenses) await saveDoc("expenses",e.id,e as any);
      for(const p of restored.payments) await saveDoc("payments",p.id,p as any);
      for(const r of restored.recurringExpenses) await saveDoc("recurringExpenses",r.id,r as any);
      await updateSettings(restored.settings);
      await activity("backup.restored",undefined,"Backup restore");
      notify("Backup restored successfully.");
    } catch(e:any) { notify(e.message || "Restore failed."); }
    finally { setSaving(false); }
  };

  return <>{toast && <div className="toast"><ShieldCheck size={17}/>{toast}</div>}
    <div className="page-header"><div><div className="eyebrow">Protected administrator workspace</div><h1>Run the ledger.</h1><p>Changes here are written to Firestore and flow to the public dashboard in real time.</p></div><div className="header-actions"><button className="secondary-btn" onClick={generateMonthly} disabled={saving}><RefreshCw size={16}/> Generate dues</button><button className="primary-btn" onClick={()=>setModal("expense")}><Plus size={16}/> New expense</button></div></div>
    {section==="overview" && <><div className="metrics-grid"><Metric label="Total expenses" value={money(total)} note={`${data.expenses.length} records`} icon={<Receipt size={16}/>}/><Metric label="This month" value={money(monthly)} note={monthLabel(currentMonth())} icon={<Wallet size={16}/>}/><Metric label="Outstanding" value={money(pending)} note="Calculated from live splits" icon={<Wallet size={16}/>}/><Metric label="Active residents" value={String(data.residents.filter(r=>r.active).length)} note={`${data.flats.filter(f=>f.active).length} active flats`} icon={<Users size={16}/>}/></div><div className="dashboard-grid"><section className="panel span-2"><div className="panel-head"><div><h2>Monthly spending</h2><p>Last eight recorded months</p></div></div><MonthlyBar data={monthlyData}/></section><section className="panel"><div className="panel-head"><div><h2>Category spend</h2><p>Current ledger</p></div></div><CategoryDonut data={cats}/></section><section className="panel span-2"><div className="panel-head"><div><h2>Outstanding balances</h2><p>Who still owes money</p></div></div><AdminDues data={data}/></section><section className="panel"><div className="panel-head"><div><h2>Recent activity</h2><p>Audit trail</p></div></div><div className="activity-list">{data.activityLogs.slice().sort((a:any,b:any)=>String(b.createdAt||"").localeCompare(String(a.createdAt||""))).slice(0,8).map(a=><div className="activity-row" key={a.id}><div className="activity-icon"><ShieldCheck size={16}/></div><div><strong>{a.action}</strong><small>{a.recordLabel||a.recordId||"Ledger"} · {a.actorEmail}</small></div></div>)}</div></section></div></>}
    {section==="expenses" && <ExpenseAdmin data={data} notify={notify} activity={activity} onAdd={()=>setModal("expense")}/>}
    {section==="payments" && <PaymentAdmin data={data} notify={notify} activity={activity} onAdd={()=>setModal("payment")}/>}
    {section==="residents" && <ResidentsAdmin data={data} notify={notify} activity={activity} onAdd={()=>setModal("resident")}/>}
    {section==="flats" && <SimpleAdmin title="Flats" items={data.flats} fields={["number","label","active"]} collection="flats" notify={notify}/>}
    {section==="charges" && <ChargesAdmin data={data} notify={notify}/>}
    {section==="categories" && <SimpleAdmin title="Categories" items={data.categories} fields={["name","color","active"]} collection="categories" notify={notify}/>}
    {section==="recurring" && <RecurringAdmin data={data} notify={notify} onAdd={()=>setModal("recurring")}/>}
    {section==="reports" && <ReportsAdmin data={data}/>}
    {section==="activity" && <ActivityAdmin data={data}/>}
    {section==="settings" && <SettingsAdmin data={data} notify={notify} onExport={()=>exportBackup(data)} onTxt={()=>exportLegacyTxt(data)} onRestore={restore}/>}
    <Modal open={modal==="expense"} title="New expense" onClose={()=>setModal(null)} wide><ExpenseForm data={data} onDone={()=>{setModal(null);notify("Expense created.");}} activity={activity}/></Modal>
    <Modal open={modal==="payment"} title="Record payment" onClose={()=>setModal(null)}><PaymentForm data={data} onDone={()=>{setModal(null);notify("Payment recorded.");}} activity={activity}/></Modal>
    <Modal open={modal==="resident"} title="Add resident" onClose={()=>setModal(null)}><ResidentForm data={data} onDone={()=>{setModal(null);notify("Resident added.");}} activity={activity}/></Modal>
    <Modal open={modal==="recurring"} title="Recurring expense" onClose={()=>setModal(null)}><RecurringForm data={data} onDone={()=>{setModal(null);notify("Recurring expense created.");}}/></Modal>
  </>;
}

function AdminDues({data}:any){const split=new Map<string,number>();data.expenses.forEach((e:any)=>Object.entries(e.split||{}).forEach(([id,v])=>split.set(id,(split.get(id)||0)+Number(v))));const paid=new Map<string,number>();data.expenses.forEach((e:any)=>{const ownShare=Number(e.split?.[e.payerId]??0);if(ownShare)paid.set(e.payerId,(paid.get(e.payerId)||0)+ownShare)});data.payments.forEach((p:any)=>paid.set(p.residentId,(paid.get(p.residentId)||0)+p.amountCents));return <div className="table-wrap"><table><thead><tr><th>Resident</th><th>Owed</th><th>Paid</th><th>Remaining</th><th>Status</th></tr></thead><tbody>{data.residents.filter((r:any)=>r.active).map((r:any)=>{const o=split.get(r.id)||0,p=paid.get(r.id)||0,rem=Math.max(0,o-p);return <tr key={r.id}><td><strong>{r.name}</strong><small>Flat {r.flatId}</small></td><td>{money(o)}</td><td>{money(p)}</td><td>{money(rem)}</td><td><StatusBadge status={statusFor(o,p)}/></td></tr>})}</tbody></table></div>}

function ExpenseAdmin({data,notify,activity,onAdd}:any){const [q,setQ]=useState("");const cats = new Map<string,string>(data.categories.map((c:any) => [String(c.id), String(c.name)]));const residents = new Map<string,string>(data.residents.map((r:any) => [String(r.id), String(r.name)]));const list=data.expenses.filter((e:any)=>`${e.title} ${cats.get(e.categoryId)||""} ${residents.get(e.payerId)||""}`.toLowerCase().includes(q.toLowerCase()));return <section className="panel"><div className="panel-head"><div><h2>Expenses</h2><p>Full write access, search and deletion</p></div><button className="primary-btn" onClick={onAdd}><Plus size={15}/> Add expense</button></div><div className="filters"><label className="search-box"><Receipt size={16}/><input placeholder="Search ledger" value={q} onChange={e=>setQ(e.target.value)}/></label></div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Expense</th><th>Category</th><th>Payer</th><th>Amount</th><th></th></tr></thead><tbody>{list.map((e:any)=><tr key={e.id}><td>{e.date}</td><td><strong>{e.title}</strong><small>{e.type}</small></td><td>{cats.get(e.categoryId)||"—"}</td><td>{residents.get(e.payerId)||"—"}</td><td><strong>{money(e.amountCents)}</strong></td><td><button className="icon-btn danger" onClick={async()=>{if(!confirm("Delete this expense?"))return;await removeDoc("expenses",e.id);await activity("expense.deleted",e.id,e.title);notify("Expense deleted.")}}><Trash2 size={15}/></button></td></tr>)}</tbody></table></div></section>}

function PaymentAdmin({data,notify,activity,onAdd}:any){return <section className="panel"><div className="panel-head"><div><h2>Payments</h2><p>Partial and full settlements</p></div><button className="primary-btn" onClick={onAdd}><Plus size={15}/> Record payment</button></div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Resident</th><th>Amount</th><th>Note</th></tr></thead><tbody>{data.payments.slice().sort((a:any,b:any)=>b.date.localeCompare(a.date)).map((p:any)=><tr key={p.id}><td>{p.date}</td><td>{data.residents.find((r:any)=>r.id===p.residentId)?.name||"Unknown"}</td><td><strong>{money(p.amountCents)}</strong></td><td>{p.note||"—"}</td></tr>)}</tbody></table></div></section>}

function ResidentsAdmin({data,notify,activity,onAdd}:any){return <section className="panel"><div className="panel-head"><div><h2>Residents</h2><p>Shares, flats and active status</p></div><button className="primary-btn" onClick={onAdd}><UserPlus size={15}/> Add resident</button></div><div className="resident-grid">{data.residents.map((r:any)=><div className="resident-admin" key={r.id}><div><strong>{r.name}</strong><small>Flat {r.flatId} · {r.shares} shares · {r.active?"Active":"Inactive"}</small></div><span className="section-tag">{r.phone||"No phone"}</span></div>)}</div></section>}

function SimpleAdmin({title,items,fields,collection,notify}:any){const [name,setName]=useState("");return <section className="panel"><div className="panel-head"><div><h2>{title}</h2><p>Manage {title.toLowerCase()} without hardcoding</p></div></div><div className="inline-form"><input value={name} onChange={e=>setName(e.target.value)} placeholder={`${title.slice(0,-1)} name`}/><button className="primary-btn" onClick={async()=>{if(!name.trim())return;await saveDoc(collection,undefined,{[fields[0]]:sanitize(name),active:true});setName("");notify(`${title.slice(0,-1)} added.`)}}><Plus size={15}/> Add</button></div><div className="simple-list">{items.map((x:any)=><div key={x.id} className="simple-row"><div><strong>{x[fields[0]]}</strong><small>{x.label||x.color||""}</small></div><span className="section-tag">{x.active?"Active":"Inactive"}</span></div>)}</div></section>}

function ChargesAdmin({data,notify}:any){return <section className="panel"><div className="panel-head"><div><h2>Monthly charges</h2><p>Use recurring expenses for automatic monthly generation.</p></div></div><div className="callout"><strong>Guarded monthly generation</strong><p>ParkLedger checks both the recurring record's lastGeneratedMonth and existing expense.recurringId + month before creating a record, preventing duplicates.</p></div><button className="secondary-btn" onClick={()=>notify("Use Recurring Expenses to define monthly charges.")}>Review recurring charges</button></section>}

function RecurringAdmin({data,notify,onAdd}:any){return <section className="panel"><div className="panel-head"><div><h2>Recurring expenses</h2><p>Automatic monthly generation with duplicate protection</p></div><button className="primary-btn" onClick={onAdd}><Plus size={15}/> Add recurring</button></div><div className="simple-list">{data.recurringExpenses.map((r:any)=><div className="simple-row" key={r.id}><div><strong>{r.title}</strong><small>{money(r.amountCents)} · day {r.dayOfMonth} · {r.active?"Active":"Paused"}</small></div><span className="section-tag">{r.lastGeneratedMonth||"Not generated"}</span></div>)}</div></section>}

function ReportsAdmin({data}:any){
  const rows=data.expenses.map((e:any)=>({
    Date:e.date, Title:e.title, Amount_INR:e.amountCents/100, Type:e.type,
    Category:data.categories.find((c:any)=>c.id===e.categoryId)?.name||"",
    Payer:data.residents.find((r:any)=>r.id===e.payerId)?.name||""
  }));
  const csv=()=>{const ws=XLSX.utils.json_to_sheet(rows);const csv=XLSX.utils.sheet_to_csv(ws);const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="parkledger-report.csv";a.click()};
  const xlsx=()=>{const wb=XLSX.utils.book_new();const ws=XLSX.utils.json_to_sheet(rows);XLSX.utils.book_append_sheet(wb,ws,"Expenses");XLSX.writeFile(wb,"parkledger-report.xlsx")};
  const pdf=()=>{const doc=new jsPDF({orientation:"landscape"});doc.setFontSize(18);doc.text("ParkLedger Expense Report",14,16);doc.setFontSize(9);let y=25;doc.text("Date",14,y);doc.text("Expense",40,y);doc.text("Category",125,y);doc.text("Payer",175,y);doc.text("Amount",245,y);y+=6;rows.slice(0,35).forEach((r:any)=>{doc.text(String(r.Date||""),14,y);doc.text(String(r.Title||"").slice(0,42),40,y);doc.text(String(r.Category||"").slice(0,22),125,y);doc.text(String(r.Payer||"").slice(0,22),175,y);doc.text(`₹${Number(r.Amount_INR||0).toLocaleString("en-IN")}`,245,y);y+=6});doc.save("parkledger-report.pdf")};
  return <section className="panel"><div className="panel-head"><div><h2>Reports</h2><p>Export the live ledger in common formats.</p></div></div><div className="report-grid">{["Monthly report","Yearly report","Expense report","Payment report","Outstanding dues","Resident report"].map(x=><div className="report-card" key={x}><Receipt size={20}/><h3>{x}</h3><p>Generate from current Firestore data.</p><div className="button-stack"><button className="secondary-btn" onClick={csv}><Download size={14}/> CSV</button><button className="secondary-btn" onClick={xlsx}>Excel</button><button className="secondary-btn" onClick={pdf}>PDF</button></div></div>)}</div></section>
}

function ActivityAdmin({data}:any){return <section className="panel"><div className="panel-head"><div><h2>Activity log</h2><p>Administrative changes</p></div></div><div className="table-wrap"><table><thead><tr><th>Action</th><th>Record</th><th>User</th><th>Timestamp</th></tr></thead><tbody>{data.activityLogs.slice().reverse().map((a:any)=><tr key={a.id}><td><span className="section-tag">{a.action}</span></td><td>{a.recordLabel||a.recordId||"—"}</td><td>{a.actorEmail}</td><td>{String(a.createdAt||"").slice(0,24)}</td></tr>)}</tbody></table></div></section>}

function SettingsAdmin({data,notify,onExport,onTxt,onRestore}:any){return <section className="panel"><div className="panel-head"><div><h2>Settings & backup</h2><p>Exports are non-destructive. Restore requires confirmation.</p></div></div><div className="settings-grid"><div className="setting-card"><h3>Property name</h3><input defaultValue={data.settings.propertyName} onBlur={async e=>{await updateSettings({propertyName:sanitize(e.target.value)});notify("Settings saved.")}}/><small>Shown throughout the public ledger.</small></div><div className="setting-card"><h3>Backups</h3><div className="button-stack"><button className="secondary-btn" onClick={onExport}><Download size={15}/> JSON backup</button><button className="secondary-btn" onClick={onTxt}><Download size={15}/> Legacy TXT</button><label className="secondary-btn"><Upload size={15}/> Restore backup<input type="file" accept=".json,.txt" hidden onChange={e=>e.target.files?.[0]&&onRestore(e.target.files[0])}/></label></div></div></div></section>}

function ExpenseForm({data,onDone,activity}:any){const [title,setTitle]=useState("");const [amount,setAmount]=useState("");const [cat,setCat]=useState(data.categories[0]?.id||"");const [payer,setPayer]=useState(data.residents[0]?.id||"");const [date,setDate]=useState(new Date().toISOString().slice(0,10));const [type,setType]=useState("one-time");const [saving,setSaving]=useState(false);return <form className="form-grid" onSubmit={async e=>{e.preventDefault();setSaving(true);try{const amountC=cents(amount);const split=exactSplit(amountC,data.residents.filter((r:any)=>r.active),"shares");const id=await saveDoc("expenses",undefined,{title:sanitize(title),amountCents:amountC,categoryId:cat,payerId:payer,date,type,splitMode:"shares",split});await activity("expense.created",id,title);onDone()}finally{setSaving(false)}}}><label>Title<input required value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Amount (₹)<input required min="0.01" step="0.01" type="number" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>Category<select value={cat} onChange={e=>setCat(e.target.value)}>{data.categories.map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Payer<select value={payer} onChange={e=>setPayer(e.target.value)}>{data.residents.filter((r:any)=>r.active).map((r:any)=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label><label>Date<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Type<select value={type} onChange={e=>setType(e.target.value)}><option value="one-time">One-time</option><option value="monthly">Monthly</option><option value="recurring">Recurring</option></select></label><div className="form-actions"><button className="primary-btn" disabled={saving}><Save size={15}/> {saving?"Saving…":"Create expense"}</button></div></form>}

function PaymentForm({data,onDone,activity}:any){const [rid,setRid]=useState(data.residents[0]?.id||"");const [amount,setAmount]=useState("");const [date,setDate]=useState(new Date().toISOString().slice(0,10));const [note,setNote]=useState("");return <form className="form-grid" onSubmit={async e=>{e.preventDefault();const id=await recordPayment({residentId:rid,amountCents:cents(amount),date,note:sanitize(note)});await activity("payment.recorded",id,data.residents.find((r:any)=>r.id===rid)?.name);onDone()}}><label>Resident<select value={rid} onChange={e=>setRid(e.target.value)}>{data.residents.filter((r:any)=>r.active).map((r:any)=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label><label>Amount (₹)<input required min="0.01" step="0.01" type="number" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>Date<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Note<textarea value={note} onChange={e=>setNote(e.target.value)}/></label><div className="form-actions"><button className="primary-btn"><Save size={15}/> Record payment</button></div></form>}

function ResidentForm({data,onDone,activity}:any){const [name,setName]=useState("");const [flat,setFlat]=useState(data.flats[0]?.id||"");const [shares,setShares]=useState("1");const [phone,setPhone]=useState("");return <form className="form-grid" onSubmit={async e=>{e.preventDefault();const id=await saveDoc("residents",undefined,{name:sanitize(name),flatId:flat,shares:Number(shares),phone:sanitize(phone),active:true});await activity("resident.created",id,name);onDone()}}><label>Name<input required value={name} onChange={e=>setName(e.target.value)}/></label><label>Flat<select value={flat} onChange={e=>setFlat(e.target.value)}>{data.flats.filter((f:any)=>f.active).map((f:any)=><option key={f.id} value={f.id}>{f.number}</option>)}</select></label><label>Shares<input min="0.01" step="0.01" type="number" value={shares} onChange={e=>setShares(e.target.value)}/></label><label>Phone<input value={phone} onChange={e=>setPhone(e.target.value)}/></label><div className="form-actions"><button className="primary-btn"><UserPlus size={15}/> Add resident</button></div></form>}

function RecurringForm({data,onDone}:any){const [title,setTitle]=useState("");const [amount,setAmount]=useState("");const [cat,setCat]=useState(data.categories[0]?.id||"");const [payer,setPayer]=useState(data.residents[0]?.id||"");const [day,setDay]=useState("1");return <form className="form-grid" onSubmit={async e=>{e.preventDefault();const id=await saveDoc("recurringExpenses",undefined,{title:sanitize(title),amountCents:cents(amount),categoryId:cat,payerId:payer,dayOfMonth:Math.min(28,Math.max(1,Number(day))),active:true,splitMode:"shares",startMonth:currentMonth()});onDone()}}><label>Title<input required value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Amount<input type="number" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>Day of month<input type="number" min="1" max="28" value={day} onChange={e=>setDay(e.target.value)}/></label><label>Category<select value={cat} onChange={e=>setCat(e.target.value)}>{data.categories.map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Payer<select value={payer} onChange={e=>setPayer(e.target.value)}>{data.residents.filter((r:any)=>r.active).map((r:any)=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label><div className="form-actions"><button className="primary-btn"><Repeat2Icon/> Create recurring</button></div></form>}
function Repeat2Icon(){return <RefreshCw size={15}/>}