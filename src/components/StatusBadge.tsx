import type { PaymentStatus } from "../types";

export function StatusBadge({ status }: { status: PaymentStatus }) {
  const labels = { paid: "Paid", partial: "Partial", pending: "Pending" };
  return <span className={`status-badge status-${status}`}>{labels[status]}</span>;
}