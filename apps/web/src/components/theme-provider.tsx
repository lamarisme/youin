"use client";

import { useEffect, type ReactNode } from "react";

import { useWorkspaceUiStore, type Theme } from "@/lib/collab-store";

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useWorkspaceUiStore((state) => state.theme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return children;
}

export function useTheme(): ThemeState {
  const theme = useWorkspaceUiStore((state) => state.theme);
  const toggleTheme = useWorkspaceUiStore((state) => state.toggleTheme);
  return { theme, toggleTheme };
}
