export const money = (cents: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format((Number.isFinite(cents) ? cents : 0) / 100);

export const cents = (value: number | string) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

export const safeDate = (value?: string | null) => {
  if (!value) return "";
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
};

export const monthKey = (date: string) => safeDate(date).slice(0, 7);

export const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year: "numeric"
  }).format(new Date(y, m - 1, 1));
};

export const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const sanitize = (value: string) =>
  value.replace(/[<>]/g, "").replace(/[\u0000-\u001F\u007F]/g, "").trim();

export function exactSplit(
  totalCents: number,
  residents: { id: string; shares: number }[],
  mode: "shares" | "equal" | "custom",
  custom?: Record<string, number>
): Record<string, number> {
  const active = residents.filter(r => r.id);
  if (!active.length || totalCents <= 0) return {};

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
  if (sum <= 0) return exactSplit(totalCents, active, "equal");

  const raw = weights.map(w => ({
    ...w,
    exact: (totalCents * w.weight) / sum
  }));
  const result: Record<string, number> = {};
  let allocated = 0;

  raw.forEach((r, i) => {
    const base = Math.floor(r.exact);
    result[r.id] = base;
    allocated += base;
    if (i === raw.length - 1) result[r.id] += totalCents - allocated;
  });

  return result;
}

export function statusFor(owedCents: number, paidCents: number) {
  const remaining = Math.max(0, owedCents - paidCents);
  if (remaining <= 0) return "paid" as const;
  if (paidCents > 0) return "partial" as const;
  return "pending" as const;
}

export function timestampValue(value: unknown): number {
  if (!value) return 0;
  if (typeof value === "string") return new Date(value).getTime();
  if (typeof value === "object" && value && "toMillis" in value && typeof (value as {toMillis?: unknown}).toMillis === "function") {
    return (value as {toMillis: () => number}).toMillis();
  }
  return 0;
}

export function downloadText(name: string, text: string, type = "text/plain") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}