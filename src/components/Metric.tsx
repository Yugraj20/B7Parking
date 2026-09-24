import type { ReactNode } from "react";
export function Metric({ label, value, note, icon }: { label: string; value: string; note?: string; icon?: ReactNode }) {
  return (
    <div className="metric">
      <div className="metric-top"><span>{label}</span>{icon}</div>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}