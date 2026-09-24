import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Google } from "lucide-react";
import { BorderBeam } from "border-beam";
import { useApp } from "../context/AppContext";
import { ADMIN_EMAIL } from "../lib/firebase";
export function AdminLogin() {
    const { user, isAdmin, login } = useApp();
    const navigate = useNavigate();
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    if (user && isAdmin)
        return _jsx(Navigate, { to: "/admin/overview", replace: true });
    const go = async () => {
        setBusy(true);
        setMessage("");
        try {
            await login();
            navigate("/admin/overview");
        }
        catch (e) {
            setMessage(e?.code === "auth/popup-closed-by-user" ? "Sign-in cancelled." : (e?.message || "Sign-in failed."));
        }
        finally {
            setBusy(false);
        }
    };
    return _jsx("div", { className: "login-page", children: _jsx(BorderBeam, { active: true, size: "md", colorVariant: "mono", strength: 0.25, children: _jsxs("div", { className: "login-card", children: [_jsxs("div", { className: "brand large", children: [_jsx("div", { className: "brand-mark", children: "P" }), _jsxs("div", { children: [_jsx("div", { className: "brand-name", children: "ParkLedger" }), _jsx("div", { className: "brand-kicker", children: "Secure admin access" })] })] }), _jsxs("div", { className: "login-copy", children: [_jsx("div", { className: "eyebrow", children: "Protected area" }), _jsx("h1", { children: "Manage the ledger." }), _jsx("p", { children: "Google Authentication is required. Firestore rules independently enforce administrator write access." })] }), _jsxs("button", { className: "primary-btn wide", onClick: go, disabled: busy, children: [_jsx(Google, { size: 17 }), busy ? "Opening Google…" : "Continue with Google"] }), _jsxs("div", { className: "login-note", children: ["Authorised administrator: ", _jsx("strong", { children: ADMIN_EMAIL })] }), message && _jsx("div", { className: "notice error", children: message }), _jsx("button", { className: "text-btn", onClick: () => navigate("/"), children: "\u2190 Back to public dashboard" })] }) }) });
}
