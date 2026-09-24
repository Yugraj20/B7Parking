import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";
const ThemeContext = createContext<{ theme: Theme; setTheme: (v: Theme) => void }>({ theme: "light", setTheme: () => {} });

export function ThemeHost({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => localStorage.getItem("parkledger-theme") === "dark" ? "dark" : "light");
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem("parkledger-theme", theme); }, [theme]);
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
