import { jsx as _jsx } from "react/jsx-runtime";
export function StatusBadge({ status }) {
    const labels = { paid: "Paid", partial: "Partial", pending: "Pending" };
    return _jsx("span", { className: `status-badge status-${status}`, children: labels[status] });
}
