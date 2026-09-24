import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function Metric({ label, value, note, icon }) {
    return (_jsxs("div", { className: "metric", children: [_jsxs("div", { className: "metric-top", children: [_jsx("span", { children: label }), icon] }), _jsx("strong", { children: value }), note && _jsx("small", { children: note })] }));
}
