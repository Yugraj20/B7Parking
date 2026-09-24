import { Moon, Sun } from "lucide-react";

export function ThemeToggle({ theme, onChange }: { theme: "light" | "dark"; onChange: (v: "light" | "dark") => void }) {
  return (
    <button
      className="icon-btn"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      onClick={() => onChange(theme === "dark" ? "light" : "dark")}
      title="Toggle theme"
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}