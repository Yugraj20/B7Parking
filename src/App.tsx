import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppProvider } from "./context/AppContext";
import { ThemeHost, useTheme } from "./context/ThemeContext";
import { AppShell } from "./components/AppShell";
import { PublicDashboard } from "./pages/PublicDashboard";

// The admin panel is a separate application (admin.html). GitHub Pages is
// static hosting, so the Admin button performs a real page navigation.
const ADMIN_URL = `${import.meta.env.BASE_URL}admin.html#/login`;
const goToAdmin = () => window.location.assign(ADMIN_URL);

function PublicRoute({ section }: { section: string }) {
  const { theme, setTheme } = useTheme();
  return <AppShell theme={theme} onTheme={setTheme} onLogin={goToAdmin}><PublicDashboard section={section} /></AppShell>;
}

export default function App() {
  const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || undefined;
  return (
    <BrowserRouter basename={basename}>
      <AppProvider>
        <ThemeHost>
          <Routes>
            <Route path="/" element={<PublicRoute section="overview" />} />
            {["overview", "dues", "expenses", "payments", "balances", "history", "analytics", "reports"].map(x => (
              <Route key={x} path={`/${x}`} element={<PublicRoute section={x} />} />
            ))}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ThemeHost>
      </AppProvider>
    </BrowserRouter>
  );
}
