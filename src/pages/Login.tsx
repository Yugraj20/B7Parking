import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Chrome } from "lucide-react";
import { BorderBeam } from "border-beam";
import { useApp } from "../context/AppContext";
import { ADMIN_EMAIL } from "../lib/firebase";

export function AdminLogin() {
  const { user, isAdmin, authReady, login } = useApp();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!authReady) return;
    if (user && isAdmin) {
      navigate("/admin/overview", { replace: true });
    } else if (user && !isAdmin) {
      setMessage(
        `This Google account is not authorized for admin access. Signed in as: ${user.email || "unknown account"}`
      );
    }
  }, [authReady, user, isAdmin, navigate]);

  if (authReady && user && isAdmin) {
    return <Navigate to="/admin/overview" replace />;
  }

  const go = async () => {
    setBusy(true);
    setMessage("");

    try {
      await login();
      // The popup result updates Firebase auth state; the route guard then opens the admin dashboard.
    } catch (e: any) {
      setMessage(
        e?.code === "auth/unauthorized-domain"
          ? "This site is not authorized in Firebase Authentication. Add yugraj20.github.io under Firebase Authentication → Settings → Authorized domains."
          : e?.code === "auth/popup-blocked"
            ? "Google sign-in popup was blocked. Allow popups for yugraj20.github.io and try again."
            : e?.code === "auth/popup-closed-by-user"
              ? "Sign-in cancelled."
              : (e?.message || "Sign-in failed.")
      );
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <BorderBeam active={true} size="md" colorVariant="mono" strength={0.25}>
        <div className="login-card">
          <div className="brand large">
            <div className="brand-mark">P</div>
            <div>
              <div className="brand-name">ParkLedger</div>
              <div className="brand-kicker">Secure admin access</div>
            </div>
          </div>
          <div className="login-copy">
            <div className="eyebrow">Protected area</div>
            <h1>Manage the ledger.</h1>
            <p>Google Authentication is required. Firestore rules independently enforce administrator write access.</p>
          </div>
          <button className="primary-btn wide" onClick={go} disabled={busy || !authReady}>
            <Chrome size={17}/>
            {busy ? "Opening Google…" : "Continue with Google"}
          </button>
          <div className="login-note">
            Authorised administrator: <strong>{ADMIN_EMAIL}</strong>
          </div>
          {message && <div className="notice error">{message}</div>}
          <button className="text-btn" onClick={() => navigate("/")}>
            ← Back to public dashboard
          </button>
        </div>
      </BorderBeam>
    </div>
  );
}
