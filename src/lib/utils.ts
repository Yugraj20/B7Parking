export const money = (cents: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format((Number.isFinite(cents) ? cents : 0) / 100);
export const rupees = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0);
export const cents = (value: number | string) => { const n = Number(value); return Number.isFinite(n) ? Math.round(n * 100) : 0; };
export const safeDate = (value?: string | null) => { if (!value) return ""; const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[1]}-${m[2]}-${m[3]}` : ""; };
export const localISODate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
export const localMonthKey = (date = new Date()) => localISODate(date).slice(0,7);
export const monthKey = (date: string) => safeDate(date).slice(0, 7);
export const monthLabel = (key: string) => { const [y,m] = key.split("-").map(Number); if (!y || !m) return key; return new Intl.DateTimeFormat("en-IN", {month:"short",year:"numeric"}).format(new Date(y,m-1,1)); };
export const currentMonth = () => localMonthKey();
export const sanitize = (value: string) => value.replace(/[<>]/g, "").replace(/[\u0000-\u001F\u007F]/g, "").trim();
export const excelSafe = (value: unknown) => { const s = String(value ?? ""); return /^[=+\-@]/.test(s) ? `'${s}` : s; };

export type SplitMode = "shares" | "equal" | "custom";
export class SplitError extends Error {}

export function exactSplit(totalCents: number, residents: { id: string; shares: number }[], mode: SplitMode, custom?: Record<string, number>): Record<string, number> {
  const active = residents.filter(r => r.id);
  if (!active.length || totalCents <= 0) return {};
  const weights = active.map(r => ({ id:r.id, weight: mode === "equal" ? 1 : mode === "custom" ? Math.max(0, Number(custom?.[r.id] ?? 0)) : Math.max(0, Number(r.shares ?? 0)) }));
  const sum = weights.reduce((a,b) => a + b.weight, 0);
  if (sum <= 0) throw new SplitError("Custom split weights must total more than zero.");
  const raw = weights.map(w => ({...w, exact:(totalCents*w.weight)/sum, base:Math.floor((totalCents*w.weight)/sum)}));
  const result: Record<string,number> = Object.fromEntries(raw.map(r => [r.id,r.base]));
  let remainder = totalCents - raw.reduce((a,r)=>a+r.base,0);
  const largest = raw.reduce((best,r)=>r.weight > best.weight ? r : best, raw[0]);
  result[largest.id] += remainder;
  if (Object.values(result).reduce((a,b)=>a+b,0) !== totalCents) throw new SplitError("Split total does not match expense amount.");
  return result;
}

export function timestampValue(value: unknown): number { if (!value) return 0; if (typeof value === "string") return new Date(value).getTime(); if (typeof value === "object" && value && "toMillis" in value && typeof (value as {toMillis?:unknown}).toMillis === "function") return (value as {toMillis:()=>number}).toMillis(); return 0; }
export function timestampLabel(value: unknown) { const n = timestampValue(value); return n ? new Intl.DateTimeFormat("en-IN", {dateStyle:"medium", timeStyle:"short"}).format(new Date(n)) : "—"; }
export function downloadText(name: string, text: string, type = "text/plain") { const blob = new Blob([text], {type}); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),0); }
