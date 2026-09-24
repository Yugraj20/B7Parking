import { jsx as _jsx } from "react/jsx-runtime";
import { Moon, Sun } from "lucide-react";
export function ThemeToggle({ theme, onChange }) {
    return (_jsx("button", { className: "icon-btn", "aria-label": `Switch to ${theme === "dark" ? "light" : "dark"} theme`, onClick: () => onChange(theme === "dark" ? "light" : "dark"), title: "Toggle theme", children: theme === "dark" ? _jsx(Sun, { size: 18 }) : _jsx(Moon, { size: 18 }) }));
}
