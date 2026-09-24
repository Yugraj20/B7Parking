import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { X } from "lucide-react";
export function Modal({ open, title, children, onClose, wide = false }) {
    if (!open)
        return null;
    return (_jsx("div", { className: "modal-backdrop", role: "dialog", "aria-modal": "true", onMouseDown: e => { if (e.target === e.currentTarget)
            onClose(); }, children: _jsxs("div", { className: `modal ${wide ? "modal-wide" : ""}`, children: [_jsxs("div", { className: "modal-head", children: [_jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: "ParkLedger" }), _jsx("h2", { children: title })] }), _jsx("button", { className: "icon-btn", onClick: onClose, "aria-label": "Close", children: _jsx(X, { size: 18 }) })] }), children] }) }));
}
