import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Chrome } from "lucide-react";
import { BorderBeam } from "border-beam";
import { useApp } from "../context/AppContext";
import { ADMIN_EMAIL } from "../lib/firebase";

const AUTH_MESSAGES: Record<string,string> = {
  "auth/unauthorized-domain": "This domain is not authorised for Firebase sign-in. Add it under Firebase Authentication > Settings > Authorized domains.",
  "auth/popup-blocked": "The sign-in popup was blocked by the browser. Allow popups for this site and try again.",
  "auth/popup-closed-by-user": "Sign-in cancelled.",
  "auth/cancelled-popup-request": "Sign-in cancelled.",
  "auth/operation-not-allowed": "Google sign-in is not enabled for this Firebase project.",
  "auth/invalid-api-key": "The Firebase API key is invalid or missing from this build."
};
const authMessage = (e:any) => AUTH_MESSAGES[e?.code] || e?.message || "Sign-in failed.";

export function AdminLogin() {
  const { user, isAdmin, login } = useApp();
  const navigate = useNavigate();
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  if (user && isAdmin) return <Navigate to="/overview" replace/>;

  const go = async () => {
    setBusy(true); setMessage("");
    try {
      const signedInUser = await login();
      const signedInEmail = signedInUser.email?.trim().toLowerCase();
      const adminEmail = ADMIN_EMAIL.trim().toLowerCase();

      if (!signedInEmail || signedInEmail !== adminEmail) {
        setMessage(`This Google account is not authorized for admin access. Signed in as: ${signedInUser.email || "unknown account"}`);
        return;
      }

      // Auth state is updated asynchronously. Navigate only after the popup
      // has returned an explicitly verified administrator account.
      navigate("/overview", { replace: true });
    } catch (e:any) {
      setMessage(authMessage(e));
    } finally { setBusy(false); }
  };

  return <div className="login-page"><BorderBeam active={true} size="md" colorVariant="mono" strength={0.25}><div className="login-card"><div className="brand large"><div className="brand-mark">P</div><div><div className="brand-name">ParkLedger</div><div className="brand-kicker">Secure admin access</div></div></div><div className="login-copy"><div className="eyebrow">Protected area</div><h1>Manage the ledger.</h1><p>Google Authentication is required. Firestore rules independently enforce administrator write access.</p></div><button className="primary-btn wide" onClick={go} disabled={busy}><Chrome size={17}/>{busy ? "Opening Google…" : "Continue with Google"}</button><div className="login-note">Authorised administrator: <strong>{ADMIN_EMAIL}</strong></div>{message && <div className="notice error">{message}</div>}<button className="text-btn" onClick={()=>window.location.assign(import.meta.env.BASE_URL)}>← Back to public dashboard</button></div></BorderBeam></div>;
}