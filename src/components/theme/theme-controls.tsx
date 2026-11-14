"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect } from "react";
import { setMyTheme } from "@/lib/companies/actions";
import { Button } from "@/components/ui/button";

export function ThemeScript() {
  const code = `(function(){try{var t=localStorage.getItem("ft-theme");document.documentElement.dataset.theme=t==="light"?"light":"dark";}catch(e){document.documentElement.dataset.theme="dark";}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}

export function ThemeSync({ theme }: { theme?: "light" | "dark" | null }) {
  useEffect(() => {
    if (!theme) return;
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("ft-theme", theme);
  }, [theme]);
  return null;
}

export function ThemeToggle({ persist = false }: { persist?: boolean }) {
  async function toggle() {
    const current = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("ft-theme", next);
    if (persist) await setMyTheme(next);
  }

  return (
    <Button type="button" variant="quiet" size="sm" onClick={toggle} aria-label="Toggle color theme">
      <Sun className="theme-icon-sun" size={16} />
      <Moon className="theme-icon-moon" size={16} />
      <span className="hidden sm:inline">Theme</span>
    </Button>
  );
}
