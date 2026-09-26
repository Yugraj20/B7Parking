import { useMemo, useState } from "react";
import { serverTimestamp } from "firebase/firestore";
import { Navigate } from "react-router-dom";
import { Plus, Save, Trash2, UserPlus, RefreshCw, Download, Upload, ShieldCheck, Receipt, Users, Wallet, Pencil, AlertTriangle, FileText, X } from "lucide-react";
import { useApp } from "../context/AppContext";
import { cents, currentMonth, money, monthKey, monthLabel, sanitize, timestampValue } from "../lib/utils";
import { buildLedger, currentBillingMonth, exactSplit, isSplitError, monthsBetween, type SplitParticipant } from "../lib/ledger";
import { buildReports, exportReportCsv, exportReportXlsx, exportReportPdf, type ReportDef } from "../lib/reports";
import { saveDoc, removeDoc, recordPayment, saveResident, migrateResidentContactFields, writeActivity, updateSettings, generateRecurringBatch, newId, type RecurringOccurrence } from "../lib/firestore";
import { exportBackup, exportLegacyTxt, parseBackup } from "../lib/backup";
import { uploadReceipt, removeReceiptByUrl, validateReceiptFile } from "../lib/storage";
import { Metric } from "../components/Metric";
import { MonthlyBar, CategoryDonut } from "../components/Charts";
import { Modal } from "../components/Modal";
import { StatusBadge } from "../components/StatusBadge";

export function AdminDashboard({ section = "overview" }: { section?: string }) {
  const { data, user, isAdmin } = useApp();
  const [modal, setModal] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<{ item: any; collection: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  // Hooks must run on every render regardless of admin status (Rules of
  // Hooks) — the gate is a plain conditional return further below, never
  // before a hook call.
  const ledger = useMemo(() => buildLedger(data), [data]);
  const monthlyData = useMemo(() => ledger.monthlySeries(8), [ledger]);
  const cats = useMemo(() => ledger.categorySeries(6), [ledger]);

  if (!user || !isAdmin) return <Navigate to="/login" replace />;

  const total = ledger.totals.expenseCents;
  const monthly = data.expenses.filter(e => monthKey(e.date) === currentMonth()).reduce((a, e) => a + e.amountCents, 0);
  const pending = ledger.totals.outstandingCents;

  const notify = (s: string) => { setToast(s); window.setTimeout(() => setToast(""), 2800); };
  const activity = async (action: any, recordId?: string, recordLabel?: string) => writeActivity({ action, actorEmail: user.email || "", recordId, recordLabel });

  const generateMonthly = async (catchUp: boolean) => {
    setSaving(true);
    try {
      const billingMonth = currentBillingMonth(data.settings.monthStartDay);
      const activeResidents: SplitParticipant[] = data.residents.filter(x => x.active);
      const occurrences: RecurringOccurrence[] = [];
      let skippedFuture = 0;
      let skippedError = 0;

      for (const r of data.recurringExpenses.filter(x => x.active)) {
        if (r.startMonth && r.startMonth > billingMonth) { skippedFuture++; continue; }
        const months = catchUp
          ? monthsBetween(r.startMonth || billingMonth, billingMonth)
          : [billingMonth];

        for (const month of months) {
          if (r.startMonth && month < r.startMonth) continue;
          if (r.lastGeneratedMonth && month <= r.lastGeneratedMonth) continue;
          const exists = data.expenses.some(e => e.recurringId === r.id && monthKey(e.date) === month);
          if (exists) continue;
          const splitMap = exactSplit(r.amountCents, activeResidents, r.splitMode, r.split);
          if (isSplitError(splitMap)) { skippedError++; continue; }
          occurrences.push({
            recurringId: r.id,
            month,
            expense: {
              title: r.title, amountCents: r.amountCents, categoryId: r.categoryId, payerId: r.payerId,
              date: `${month}-${String(Math.min(28, Math.max(1, r.dayOfMonth))).padStart(2, "0")}`,
              type: "monthly", recurringId: r.id, splitMode: r.splitMode, split: splitMap
            }
          });
        }
      }

      if (!occurrences.length) {
        notify(
          skippedError ? "Skipped: a recurring item has an invalid custom split (weights sum to zero)." :
          skippedFuture ? "Nothing to generate yet — some recurring items haven't started." :
          "Nothing new to generate."
        );
        return;
      }

      await generateRecurringBatch(occurrences);
      for (const o of occurrences) await activity("monthly.generated", `exp_${o.recurringId}_${o.month}`, o.expense.title);
      notify(`${occurrences.length} recurring expense(s) generated.${skippedError ? " " + skippedError + " skipped (invalid custom split)." : ""}`);
    } finally { setSaving(false); }
  };

  const restore = async (file: File) => {
    setSaving(true);
    try {
      const text = await file.text(); const restored = parseBackup(text);
      if (!window.confirm("Restore this backup? Existing records with the same IDs will be replaced. New records will be added.")) return;
      for (const r of restored.residents as any[]) {
        await saveResident(r.id, { name: r.name, flatId: r.flatId, shares: r.shares, active: r.active }, { phone: r.phone, notes: r.notes });
      }
      for (const f of restored.flats) await saveDoc("flats", f.id, f as any);
      for (const c of restored.categories) await saveDoc("categories", c.id, c as any);
      for (const e of restored.expenses) await saveDoc("expenses", e.id, e as any);
      for (const p of restored.payments) await saveDoc("payments", p.id, p as any);
      for (const r of restored.recurringExpenses) await saveDoc("recurringExpenses", r.id, r as any);
      await updateSettings(restored.settings);
      await activity("backup.restored", undefined, "Backup restore");
      notify("Backup restored successfully.");
    } catch (e: any) { notify(e.message || "Restore failed."); }
    finally { setSaving(false); }
  };

  const migrateContacts = async () => {
    if (!window.confirm("Scan residents for phone/notes still sitting in the public collection and move them to the admin-only one?")) return;
    setSaving(true);
    try {
      const count = await migrateResidentContactFields();
      await activity("contacts.migrated", undefined, count ? `Migrated ${count} resident(s) to residentPrivate` : "Contact-field migration: nothing to do");
      notify(count ? `Moved contact fields for ${count} resident(s) to the private collection.` : "Nothing to migrate — no public resident doc has phone/notes.");
    } catch (e: any) { notify(e.message || "Migration failed."); }
    finally { setSaving(false); }
  };

  return <>{toast && <div className="toast"><ShieldCheck size={17} />{toast}</div>}
    <div className="page-header"><div><div className="eyebrow">Protected administrator workspace</div><h1>Run the ledger.</h1><p>Changes here are written to Firestore and flow to the public dashboard in real time.</p></div><div className="header-actions"><button className="secondary-btn" onClick={() => generateMonthly(false)} disabled={saving}><RefreshCw size={16} /> Generate dues</button><button className="secondary-btn" onClick={() => generateMonthly(true)} disabled={saving} title="Generate every missing month from each recurring item's start month to now">Catch up missed months</button><button className="primary-btn" onClick={() => setModal("expense")}><Plus size={16} /> New expense</button></div></div>
    {section === "overview" && <><div className="metrics-grid"><Metric label="Total expenses" value={money(total)} note={`${data.expenses.length} records`} icon={<Receipt size={16} />} /><Metric label="This month" value={money(monthly)} note={monthLabel(currentMonth())} icon={<Wallet size={16} />} /><Metric label="Outstanding" value={money(pending)} note="Calculated from live splits" icon={<Wallet size={16} />} /><Metric label="Active residents" value={String(data.residents.filter(r => r.active).length)} note={`${data.flats.filter(f => f.active).length} active flats`} icon={<Users size={16} />} /></div><div className="dashboard-grid"><section className="panel span-2"><div className="panel-head"><div><h2>Monthly spending</h2><p>Last eight recorded months</p></div></div><MonthlyBar data={monthlyData} /></section><section className="panel"><div className="panel-head"><div><h2>Category spend</h2><p>Current ledger</p></div></div><CategoryDonut data={cats} /></section><section className="panel span-2"><div className="panel-head"><div><h2>Outstanding balances</h2><p>Who still owes money</p></div></div><AdminDues data={data} /></section><section className="panel"><div className="panel-head"><div><h2>Recent activity</h2><p>Audit trail</p></div></div><div className="activity-list">{data.activityLogs.slice().sort((a: any, b: any) => timestampValue(b.createdAt) - timestampValue(a.createdAt)).slice(0, 8).map(a => <div className="activity-row" key={a.id}><div className="activity-icon"><ShieldCheck size={16} /></div><div><strong>{a.action}</strong><small>{a.recordLabel || a.recordId || "Ledger"} · {a.actorEmail}</small></div></div>)}</div></section></div></>}
    {section === "expenses" && <ExpenseAdmin data={data} notify={notify} activity={activity} onAdd={() => setModal("expense")} onEdit={(item: any) => setEditItem({ item, collection: "expenses" })} />}
    {section === "payments" && <PaymentAdmin data={data} notify={notify} activity={activity} onAdd={() => setModal("payment")} onEdit={(item: any) => setEditItem({ item, collection: "payments" })} />}
    {section === "residents" && <ResidentsAdmin data={data} notify={notify} activity={activity} onAdd={() => setModal("resident")} onEdit={(item: any) => setEditItem({ item, collection: "residents" })} />}
    {section === "flats" && <SimpleAdmin title="Flats" singular="Flat" items={data.flats} fields={["number", "label", "active"]} collection="flats" notify={notify} onEdit={(item: any) => setEditItem({ item, collection: "flats" })} />}
    {section === "charges" && <ChargesAdmin data={data} notify={notify} onGenerate={() => generateMonthly(false)} saving={saving} />}
    {section === "categories" && <SimpleAdmin title="Categories" singular="Category" items={data.categories} fields={["name", "color", "active"]} collection="categories" notify={notify} onEdit={(item: any) => setEditItem({ item, collection: "categories" })} />}
    {section === "recurring" && <RecurringAdmin data={data} notify={notify} onAdd={() => setModal("recurring")} onEdit={(item: any) => setEditItem({ item, collection: "recurringExpenses" })} />}
    {section === "reports" && <ReportsAdmin data={data} />}
    {section === "activity" && <ActivityAdmin data={data} />}
    {section === "settings" && <SettingsAdmin data={data} notify={notify} onExport={() => exportBackup(data)} onTxt={() => exportLegacyTxt(data)} onRestore={restore} onMigrate={migrateContacts} />}

    <Modal open={modal === "expense"} title="New expense" onClose={() => setModal(null)} wide><ExpenseForm data={data} onDone={() => setModal(null)} activity={activity} notify={notify} /></Modal>
    <Modal open={modal === "payment"} title="Record payment" onClose={() => setModal(null)}><PaymentForm data={data} onDone={() => setModal(null)} activity={activity} notify={notify} /></Modal>
    <Modal open={modal === "resident"} title="Add resident" onClose={() => setModal(null)}><ResidentForm data={data} onDone={() => setModal(null)} activity={activity} notify={notify} /></Modal>
    <Modal open={modal === "recurring"} title="Recurring expense" onClose={() => setModal(null)}><RecurringForm data={data} onDone={() => { setModal(null); notify("Recurring expense created."); }} /></Modal>

    <Modal open={!!editItem} title={editTitle(editItem?.collection)} onClose={() => setEditItem(null)} wide={editItem?.collection === "expenses"}>
      {editItem?.collection === "expenses" && <ExpenseForm data={data} item={editItem.item} onDone={() => setEditItem(null)} activity={activity} notify={notify} />}
      {editItem?.collection === "payments" && <PaymentForm data={data} item={editItem.item} onDone={() => setEditItem(null)} activity={activity} notify={notify} />}
      {editItem?.collection === "residents" && <ResidentForm data={data} item={editItem.item} onDone={() => setEditItem(null)} activity={activity} notify={notify} />}
      {editItem && !["expenses", "payments", "residents"].includes(editItem.collection) &&
        <GenericEditForm item={editItem.item} collection={editItem.collection} onDone={() => setEditItem(null)} notify={notify} />}
    </Modal>
  </>;
}

function editTitle(collection?: string) {
  const labels: Record<string, string> = {
    expenses: "Edit expense", payments: "Edit payment", residents: "Edit resident",
    flats: "Edit flat", categories: "Edit category", recurringExpenses: "Edit recurring expense"
  };
  return (collection && labels[collection]) || "Edit record";
}

function AdminDues({ data }: any) {
  const ledger = buildLedger(data);
  return <div className="table-wrap"><table><thead><tr><th>Resident</th><th>Owed</th><th>Paid</th><th>Remaining</th><th>Status</th></tr></thead><tbody>{ledger.rows.filter(row => row.resident.active).map(row => <tr key={row.resident.id}><td><strong>{row.resident.name}</strong><small>Flat {ledger.flatNumber(row.resident.flatId)}</small></td><td>{money(row.owedCents)}</td><td>{money(row.paidCents)}</td><td className={row.remainingCents > 0 ? "danger-text" : ""}>{money(Math.abs(row.remainingCents))}{row.remainingCents < 0 ? " credit" : ""}</td><td><StatusBadge status={row.status} /></td></tr>)}</tbody></table></div>;
}

function ExpenseAdmin({ data, notify, activity, onAdd, onEdit }: any) { const [q, setQ] = useState(""); const cats = new Map<string, string>(data.categories.map((c: any) => [String(c.id), String(c.name)])); const residents = new Map<string, string>(data.residents.map((r: any) => [String(r.id), String(r.name)])); const list = data.expenses.filter((e: any) => `${e.title} ${cats.get(e.categoryId) || ""} ${residents.get(e.payerId) || ""}`.toLowerCase().includes(q.toLowerCase())); return <section className="panel"><div className="panel-head"><div><h2>Expenses</h2><p>Full write access, search and deletion</p></div><button className="primary-btn" onClick={onAdd}><Plus size={15} /> Add expense</button></div><div className="filters"><label className="search-box"><Receipt size={16} /><input placeholder="Search ledger" value={q} onChange={e => setQ(e.target.value)} /></label></div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Expense</th><th>Category</th><th>Payer</th><th>Amount</th><th></th></tr></thead><tbody>{list.map((e: any) => <tr key={e.id}><td>{e.date}</td><td><strong>{e.title}</strong><small>{e.type}</small></td><td>{cats.get(e.categoryId) || "—"}</td><td>{residents.get(e.payerId) || "—"}</td><td><strong>{money(e.amountCents)}</strong></td><td><div style={{ display: 'flex', gap: '8px' }}><button className="icon-btn" onClick={() => onEdit(e)}><Pencil size={15} /></button><button className="icon-btn danger" onClick={async () => { if (!confirm("Delete this expense?")) return; await removeDoc("expenses", e.id); await activity("expense.deleted", e.id, e.title); notify("Expense deleted.") }}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div></section> }

function PaymentAdmin({ data, notify, activity, onAdd, onEdit }: any) { return <section className="panel"><div className="panel-head"><div><h2>Payments</h2><p>Partial and full settlements</p></div><button className="primary-btn" onClick={onAdd}><Plus size={15} /> Record payment</button></div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Resident</th><th>Amount</th><th>Note</th><th></th></tr></thead><tbody>{data.payments.slice().sort((a: any, b: any) => b.date.localeCompare(a.date)).map((p: any) => <tr key={p.id}><td>{p.date}</td><td>{data.residents.find((r: any) => r.id === p.residentId)?.name || "Unknown"}</td><td><strong>{money(p.amountCents)}</strong></td><td>{p.note || "—"}</td><td><button className="icon-btn" onClick={() => onEdit(p)}><Pencil size={15} /></button></td></tr>)}</tbody></table></div></section> }

function ResidentsAdmin({ data, notify, activity, onAdd, onEdit }: any) { return <section className="panel"><div className="panel-head"><div><h2>Residents</h2><p>Shares, flats and active status</p></div><button className="primary-btn" onClick={onAdd}><UserPlus size={15} /> Add resident</button></div><div className="resident-grid">{data.residents.map((r: any) => <div className="resident-admin" key={r.id}><div><strong>{r.name}</strong><small>Flat {r.flatId} · {r.shares} shares · {r.active ? "Active" : "Inactive"}</small></div><div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><span className="section-tag">{r.phone || "No phone"}</span><button className="icon-btn" onClick={() => onEdit(r)}><Pencil size={15} /></button></div></div>)}</div></section> }

function SimpleAdmin({ title, singular, items, fields, collection, notify, onEdit }: any) {
  // `singular` names the item type for the placeholder/toast (e.g. "Flat",
  // "Category") — deriving it from `title` by chopping the trailing "s"
  // used to produce "Categorie name" for Categories.
  const label = singular || title;
  const [name, setName] = useState("");
  return <section className="panel"><div className="panel-head"><div><h2>{title}</h2><p>Manage {title.toLowerCase()} without hardcoding</p></div></div><div className="inline-form"><input value={name} onChange={e => setName(e.target.value)} placeholder={`${label} name`} /><button className="primary-btn" onClick={async () => { if (!name.trim()) return; await saveDoc(collection, undefined, { [fields[0]]: sanitize(name), active: true }); setName(""); notify(`${label} added.`) }}><Plus size={15} /> Add</button></div><div className="simple-list">{items.map((x: any) => <div key={x.id} className="simple-row"><div><strong>{x[fields[0]]}</strong><small>{x.label || x.color || ""}</small></div><div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><span className="section-tag">{x.active ? "Active" : "Inactive"}</span><button className="icon-btn" onClick={() => onEdit(x)}><Pencil size={15} /></button></div></div>)}</div></section>;
}

function ChargesAdmin({ data, onGenerate, saving }: any) { return <section className="panel"><div className="panel-head"><div><h2>Monthly charges</h2><p>Charges are defined as recurring expenses; generation happens here.</p></div><button className="primary-btn" onClick={onGenerate} disabled={saving}><RefreshCw size={15} /> Generate</button></div><div className="callout"><strong>Guarded monthly generation</strong><p>ParkLedger checks both the recurring record's lastGeneratedMonth and existing expense.recurringId + month before creating a record, preventing duplicates. {data.recurringExpenses.filter((r: any) => r.active).length} active recurring item(s) will be considered.</p></div></section> }

function RecurringAdmin({ data, notify, onAdd, onEdit }: any) { return <section className="panel"><div className="panel-head"><div><h2>Recurring expenses</h2><p>Automatic monthly generation with duplicate protection</p></div><button className="primary-btn" onClick={onAdd}><Plus size={15} /> Add recurring</button></div><div className="simple-list">{data.recurringExpenses.map((r: any) => <div className="simple-row" key={r.id}><div><strong>{r.title}</strong><small>{money(r.amountCents)} · day {r.dayOfMonth} · {r.active ? "Active" : "Paused"}</small></div><div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><span className="section-tag">{r.lastGeneratedMonth || "Not generated"}</span><button className="icon-btn" onClick={() => onEdit(r)}><Pencil size={15} /></button></div></div>)}</div></section> }

function ReportsAdmin({ data }: any) {
  const reports: ReportDef[] = buildReports(data);
  return <section className="panel"><div className="panel-head"><div><h2>Reports</h2><p>Export the live ledger in common formats.</p></div></div><div className="report-grid">{reports.map(r => <div className="report-card" key={r.id}><Receipt size={20} /><h3>{r.label}</h3><p>{r.description}</p><div className="button-stack"><button className="secondary-btn" onClick={() => exportReportCsv(r)}><Download size={14} /> CSV</button><button className="secondary-btn" onClick={() => exportReportXlsx(r)}>Excel</button><button className="secondary-btn" onClick={() => exportReportPdf(r)}>PDF</button></div></div>)}</div></section>
}

function ActivityAdmin({ data }: any) {
  const rows = data.activityLogs.slice().sort((a: any, b: any) => timestampValue(b.createdAt) - timestampValue(a.createdAt)).slice(0, 100);
  return <section className="panel"><div className="panel-head"><div><h2>Activity log</h2><p>Administrative changes · latest 100</p></div></div>{rows.length ? <div className="table-wrap"><table><thead><tr><th>Action</th><th>Record</th><th>User</th><th>Timestamp</th></tr></thead><tbody>{rows.map((a: any) => { const ms = timestampValue(a.createdAt); return <tr key={a.id}><td><span className="section-tag">{a.action}</span></td><td>{a.recordLabel || a.recordId || "—"}</td><td>{a.actorEmail}</td><td>{ms ? new Date(ms).toLocaleString("en-IN") : "—"}</td></tr>; })}</tbody></table></div> : <div className="empty">No activity recorded yet.</div>}</section>;
}

function SettingsAdmin({ data, notify, onExport, onTxt, onRestore, onMigrate }: any) { return <section className="panel"><div className="panel-head"><div><h2>Settings & backup</h2><p>Exports are non-destructive. Restore requires confirmation.</p></div></div><div className="settings-grid"><div className="setting-card"><h3>Property name</h3><input defaultValue={data.settings.propertyName} onBlur={async e => { await updateSettings({ propertyName: sanitize(e.target.value) }); notify("Settings saved.") }} /><small>Shown throughout the public ledger.</small></div><div className="setting-card"><h3>Backups</h3><div className="button-stack"><button className="secondary-btn" onClick={onExport}><Download size={15} /> JSON backup</button><button className="secondary-btn" onClick={onTxt}><Download size={15} /> Legacy TXT</button><label className="secondary-btn"><Upload size={15} /> Restore backup<input type="file" accept=".json,.txt" hidden onChange={e => e.target.files?.[0] && onRestore(e.target.files[0])} /></label></div></div><div className="setting-card"><h3>Resident contact fields</h3><small>Phone/notes now live in an admin-only collection (residentPrivate). Run this once to move any left over from before that change out of the public residents collection.</small><div className="button-stack"><button className="secondary-btn" onClick={onMigrate}><ShieldCheck size={15} /> Migrate contact fields</button></div></div></div></section> }

// Full expense form: live per-resident split preview (via ledger.exactSplit),
// shares/equal/custom modes, and optional receipt upload. Used for both
// create (no `item`) and edit (`item` supplied).
function ExpenseForm({ data, item, onDone, activity, notify }: any) {
  const isEdit = !!item;
  const activeResidents = data.residents.filter((r: any) => r.active);

  const [title, setTitle] = useState(item?.title || "");
  const [amount, setAmount] = useState(item ? String(item.amountCents / 100) : "");
  const [cat, setCat] = useState(item?.categoryId || data.categories[0]?.id || "");
  const [payer, setPayer] = useState(item?.payerId || activeResidents[0]?.id || "");
  const [date, setDate] = useState(item?.date || new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(item?.dueDate || "");
  const [type, setType] = useState(item?.type || "one-time");
  const [splitMode, setSplitMode] = useState<"shares" | "equal" | "custom">(item?.splitMode || "shares");
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>(() => {
    if (item?.splitMode === "custom" && item.split) {
      return Object.fromEntries(activeResidents.map((r: any) => [r.id, item.split[r.id] != null ? String(item.split[r.id] / 100) : ""]));
    }
    return {};
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptError, setReceiptError] = useState("");
  const [removeExistingReceipt, setRemoveExistingReceipt] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const amountCents = cents(amount);
  const customCentsMap = useMemo(() => {
    const out: Record<string, number> = {};
    activeResidents.forEach((r: any) => { out[r.id] = cents(customAmounts[r.id] || "0"); });
    return out;
  }, [customAmounts, activeResidents.length]);

  const split = useMemo(
    () => exactSplit(amountCents, activeResidents, splitMode, splitMode === "custom" ? customCentsMap : undefined),
    [amountCents, activeResidents, splitMode, customCentsMap]
  );
  const splitError = isSplitError(split) ? split.error : null;

  return (
    <form className="form-grid" onSubmit={async e => {
      e.preventDefault();
      setFormError("");
      if (!cat || !payer) { setFormError("Choose a category and payer."); return; }
      if (!activeResidents.length) { setFormError("No active residents to split this expense across."); return; }
      if (isSplitError(split)) { setFormError(split.error); return; }
      setSaving(true);
      try {
        // Only reserve an id up front when one is actually needed (editing,
        // or a receipt is being uploaded and needs a path to live under).
        // saveDoc takes its setDoc-merge branch whenever an id is passed in
        // — which skips setting createdAt — so a plain new expense with no
        // receipt is left with id undefined and goes through the addDoc
        // branch instead, exactly like before this form was rewritten.
        const id: string | undefined = item?.id || (receiptFile ? newId("expenses") : undefined);
        // Firestore's JS SDK rejects `undefined` field values outright, so
        // build the receipt fields as either "leave untouched" (omit the
        // keys — setDoc merge keeps whatever was already there), a fresh
        // upload, or an explicit clear (empty string, never `undefined`).
        const uploadedReceipt = receiptFile ? await uploadReceipt(id!, receiptFile) : null;
        if (removeExistingReceipt && item?.receiptUrl && !uploadedReceipt) await removeReceiptByUrl(item.receiptUrl);
        const receiptFields = uploadedReceipt
          ? { receiptUrl: uploadedReceipt.receiptUrl, receiptName: uploadedReceipt.receiptName }
          : removeExistingReceipt
            ? { receiptUrl: "", receiptName: "" }
            : {};
        const savedId = await saveDoc("expenses", id, {
          title: sanitize(title), amountCents, categoryId: cat, payerId: payer, date,
          dueDate: dueDate || null, type, splitMode, split,
          ...receiptFields,
          // A pre-generated id (receipt case) takes saveDoc's setDoc-merge
          // branch, which never stamps createdAt on its own — set it
          // explicitly here so a fresh expense with a receipt still gets one.
          ...(!isEdit && id ? { createdAt: serverTimestamp() } : {})
        });
        await activity(isEdit ? "expense.updated" : "expense.created", savedId, title);
        notify(isEdit ? "Expense updated." : "Expense created.");
        onDone();
      } catch (err: any) {
        setFormError(err?.message || "Could not save expense.");
      } finally { setSaving(false); }
    }}>
      <label>Title<input required value={title} onChange={e => setTitle(e.target.value)} /></label>
      <label>Amount (₹)<input required min="0.01" step="0.01" type="number" value={amount} onChange={e => setAmount(e.target.value)} /></label>
      <label>Category<select value={cat} onChange={e => setCat(e.target.value)}>{data.categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Payer<select value={payer} onChange={e => setPayer(e.target.value)}>{activeResidents.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
      <label>Date<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
      <label>Due date (optional)<input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></label>
      <label>Type<select value={type} onChange={e => setType(e.target.value)}><option value="one-time">One-time</option><option value="monthly">Monthly</option><option value="recurring">Recurring</option></select></label>
      <div />

      <div className="segmented">
        {(["shares", "equal", "custom"] as const).map(m => (
          <button type="button" key={m} className={splitMode === m ? "active" : ""} onClick={() => setSplitMode(m)}>{m}</button>
        ))}
      </div>

      {splitMode === "custom" && (
        <div className="hint">Enter each resident's exact ₹ amount — if they add up to the total, they're used exactly; otherwise they're treated as relative weights.</div>
      )}

      <div className="split-preview">
        {activeResidents.map((r: any) => (
          <div className="split-row" key={r.id}>
            <div><strong>{r.name}</strong><small>{splitMode === "shares" ? `${r.shares} share(s)` : splitMode === "equal" ? "Equal share" : "Custom"}</small></div>
            {splitMode === "custom"
              ? <input type="number" min="0" step="0.01" value={customAmounts[r.id] ?? ""} onChange={e => setCustomAmounts({ ...customAmounts, [r.id]: e.target.value })} />
              : <strong>{money(isSplitError(split) ? 0 : (split[r.id] || 0))}</strong>}
          </div>
        ))}
        <div className="split-total"><span>Total</span><span>{money(amountCents)}</span></div>
      </div>

      <div className="receipt-field">
        <label>Receipt (optional, image or PDF, under 10MB)</label>
        {item?.receiptUrl && !removeExistingReceipt && !receiptFile && (
          <div className="receipt-current">
            <span><FileText size={14} style={{ verticalAlign: "-2px", marginRight: "6px" }} />{item.receiptName || "Current receipt"}</span>
            <button type="button" className="icon-btn danger" onClick={() => setRemoveExistingReceipt(true)}><X size={14} /></button>
          </div>
        )}
        <input type="file" accept="image/*,application/pdf" onChange={e => {
          const f = e.target.files?.[0] || null;
          setReceiptError("");
          if (f) { const err = validateReceiptFile(f); if (err) { setReceiptError(err); setReceiptFile(null); return; } }
          setReceiptFile(f);
          if (f) setRemoveExistingReceipt(false);
        }} />
        {receiptError && <div className="notice error">{receiptError}</div>}
      </div>

      {(formError || splitError) && <div className="notice error" style={{ gridColumn: "1/-1" }}><AlertTriangle size={14} style={{ verticalAlign: "-2px", marginRight: "6px" }} />{formError || splitError}</div>}
      <div className="form-actions"><button className="primary-btn" disabled={saving}><Save size={15} /> {saving ? "Saving…" : isEdit ? "Save changes" : "Create expense"}</button></div>
    </form>
  );
}

// Payment form with a live resident-balance helper (from buildLedger) and
// an optional link to the specific expense the payment is settling.
function PaymentForm({ data, item, onDone, activity, notify }: any) {
  const isEdit = !!item;
  const activeResidents = data.residents.filter((r: any) => r.active);
  const ledger = useMemo(() => buildLedger(data), [data]);

  const [rid, setRid] = useState(item?.residentId || activeResidents[0]?.id || "");
  const [amount, setAmount] = useState(item ? String(item.amountCents / 100) : "");
  const [date, setDate] = useState(item?.date || new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState(item?.note || "");
  const [expenseId, setExpenseId] = useState(item?.expenseId || "");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const row = ledger.byResidentId.get(rid);
  const remainingCents = row?.remainingCents ?? 0;
  const residentExpenses = data.expenses
    .filter((e: any) => e.split && Number(e.split[rid] || 0) > 0)
    .sort((a: any, b: any) => b.date.localeCompare(a.date));

  return (
    <form className="form-grid" onSubmit={async e => {
      e.preventDefault();
      setFormError("");
      const amountCents = cents(amount);
      if (amountCents <= 0) { setFormError("Enter an amount greater than zero."); return; }
      setSaving(true);
      try {
        const payload: any = { residentId: rid, amountCents, date, note: sanitize(note) };
        if (expenseId) payload.expenseId = expenseId;
        let id: string;
        if (isEdit) { id = item.id; await saveDoc("payments", id, payload); }
        else { id = await recordPayment(payload); }
        await activity(isEdit ? "payment.updated" : "payment.recorded", id, data.residents.find((r: any) => r.id === rid)?.name);
        notify(isEdit ? "Payment updated." : "Payment recorded.");
        onDone();
      } catch (err: any) {
        setFormError(err?.message || "Could not save payment.");
      } finally { setSaving(false); }
    }}>
      <label>Resident<select value={rid} onChange={e => { setRid(e.target.value); setExpenseId(""); }}>{activeResidents.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
      <label>Amount (₹)<input required min="0.01" step="0.01" type="number" value={amount} onChange={e => setAmount(e.target.value)} /></label>

      {row && (
        <div className="hint">
          {remainingCents > 0
            ? <><strong>{money(remainingCents)}</strong> currently owed.{" "}<button type="button" className="text-btn" onClick={() => setAmount(String(remainingCents / 100))}>Use full amount</button></>
            : remainingCents < 0
              ? <>Currently in credit by <strong>{money(-remainingCents)}</strong>.</>
              : <>Fully settled — no balance owed.</>}
        </div>
      )}

      <label>Related expense (optional)<select value={expenseId} onChange={e => setExpenseId(e.target.value)}>
        <option value="">— Not linked to a specific expense —</option>
        {residentExpenses.map((exp: any) => <option key={exp.id} value={exp.id}>{exp.title} · {exp.date} · {money(exp.split[rid])}</option>)}
      </select></label>
      <label>Date<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
      <label>Note<textarea value={note} onChange={e => setNote(e.target.value)} /></label>

      {formError && <div className="notice error" style={{ gridColumn: "1/-1" }}><AlertTriangle size={14} style={{ verticalAlign: "-2px", marginRight: "6px" }} />{formError}</div>}
      <div className="form-actions"><button className="primary-btn" disabled={saving}><Save size={15} /> {saving ? "Saving…" : isEdit ? "Save changes" : "Record payment"}</button></div>
    </form>
  );
}

// Resident form. On edit, deactivating a resident who still has an
// outstanding balance requires an explicit confirmation first, matching
// the confirm() pattern already used for delete/restore elsewhere here.
function ResidentForm({ data, item, onDone, activity, notify }: any) {
  const isEdit = !!item;
  const ledger = useMemo(() => buildLedger(data), [data]);
  const remainingCents = isEdit ? (ledger.byResidentId.get(item.id)?.remainingCents ?? 0) : 0;

  const [name, setName] = useState(item?.name || "");
  const [flat, setFlat] = useState(item?.flatId || data.flats[0]?.id || "");
  const [shares, setShares] = useState(item ? String(item.shares) : "1");
  const [phone, setPhone] = useState(item?.phone || "");
  const [active, setActive] = useState(item ? item.active : true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  return (
    <form className="form-grid" onSubmit={async e => {
      e.preventDefault();
      setFormError("");
      if (isEdit && item.active && !active && remainingCents > 0) {
        const ok = window.confirm(`${item.name} still owes ${money(remainingCents)}. Their balance stays on record, but they'll drop off active dues screens. Deactivate anyway?`);
        if (!ok) return;
      }
      setSaving(true);
      try {
        const payload = { name: sanitize(name), flatId: flat, shares: Number(shares), active };
        const savedId = await saveResident(isEdit ? item.id : undefined, payload, { phone: sanitize(phone) });
        await activity(isEdit ? "resident.updated" : "resident.created", savedId, name);
        notify(isEdit ? "Resident updated." : "Resident added.");
        onDone();
      } catch (err: any) {
        setFormError(err?.message || "Could not save resident.");
      } finally { setSaving(false); }
    }}>
      <label>Name<input required value={name} onChange={e => setName(e.target.value)} /></label>
      <label>Flat<select value={flat} onChange={e => setFlat(e.target.value)}>{data.flats.filter((f: any) => f.active).map((f: any) => <option key={f.id} value={f.id}>{f.number}</option>)}</select></label>
      <label>Shares<input min="0.01" step="0.01" type="number" value={shares} onChange={e => setShares(e.target.value)} /></label>
      <label>Phone<input value={phone} onChange={e => setPhone(e.target.value)} /></label>
      {isEdit && (
        <label style={{ display: "flex", flexDirection: "row", gap: "10px", alignItems: "center" }}>
          <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} style={{ width: "auto" }} />
          <span style={{ textTransform: "none", marginBottom: 0 }}>Active</span>
        </label>
      )}
      {isEdit && item.active && !active && remainingCents > 0 && (
        <div className="notice warning" style={{ gridColumn: "1/-1" }}><AlertTriangle size={14} style={{ verticalAlign: "-2px", marginRight: "6px" }} />Still owes {money(remainingCents)} — you'll be asked to confirm on save.</div>
      )}
      {formError && <div className="notice error" style={{ gridColumn: "1/-1" }}>{formError}</div>}
      <div className="form-actions"><button className="primary-btn" disabled={saving}><UserPlus size={15} /> {saving ? "Saving…" : isEdit ? "Save changes" : "Add resident"}</button></div>
    </form>
  );
}

function RecurringForm({ data, onDone }: any) { const [title, setTitle] = useState(""); const [amount, setAmount] = useState(""); const [cat, setCat] = useState(data.categories[0]?.id || ""); const [payer, setPayer] = useState(data.residents[0]?.id || ""); const [day, setDay] = useState("1"); return <form className="form-grid" onSubmit={async e => { e.preventDefault(); const id = await saveDoc("recurringExpenses", undefined, { title: sanitize(title), amountCents: cents(amount), categoryId: cat, payerId: payer, dayOfMonth: Math.min(28, Math.max(1, Number(day))), active: true, splitMode: "shares", startMonth: currentMonth() }); onDone() }}><label>Title<input required value={title} onChange={e => setTitle(e.target.value)} /></label><label>Amount<input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} /></label><label>Day of month<input type="number" min="1" max="28" value={day} onChange={e => setDay(e.target.value)} /></label><label>Category<select value={cat} onChange={e => setCat(e.target.value)}>{data.categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Payer<select value={payer} onChange={e => setPayer(e.target.value)}>{data.residents.filter((r: any) => r.active).map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label><div className="form-actions"><button className="primary-btn"><Repeat2Icon /> Create recurring</button></div></form> }

function Repeat2Icon() { return <RefreshCw size={15} /> }

// Dynamically adapts based on whether you are editing a Resident, Flat, Category, Payment, etc.
function GenericEditForm({ item, collection, onDone, notify }: any) {
  const [formData, setFormData] = useState(() => {
    const d = { ...item };
    delete d.id; delete d.split; delete d.createdAt; delete d.updatedAt;
    return d;
  });
  const [saving, setSaving] = useState(false);

  return (
    <form className="form-grid" onSubmit={async (e) => {
      e.preventDefault();
      setSaving(true);
      try {
        await saveDoc(collection, item.id, formData);
        notify("Updated successfully.");
        onDone();
      } finally { setSaving(false); }
    }}>
      {Object.entries(formData).map(([k, v]) => {
        if (typeof v === "boolean") {
          return (
            <label key={k} style={{ display: "flex", flexDirection: "row", gap: "10px", alignItems: "center" }}>
              <input type="checkbox" checked={v} onChange={e => setFormData({ ...formData, [k]: e.target.checked })} style={{ width: "auto" }} />
              <span style={{ textTransform: "capitalize", marginBottom: 0 }}>{k}</span>
            </label>
          );
        }
        if (typeof v === "string" || typeof v === "number") {
          return (
            <label key={k}>
              <span style={{ textTransform: "capitalize" }}>{k}</span>
              <input type={typeof v === "number" ? "number" : "text"} step={typeof v === "number" ? "0.01" : undefined} value={v} onChange={e => setFormData({ ...formData, [k]: typeof v === "number" ? Number(e.target.value) : e.target.value })} />
            </label>
          );
        }
        return null;
      })}
      <div className="form-actions">
        <button className="primary-btn" disabled={saving}><Save size={15} /> {saving ? "Saving..." : "Save changes"}</button>
      </div>
    </form>
  );
}