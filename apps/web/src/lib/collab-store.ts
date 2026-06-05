"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Theme = "light" | "dark";

interface WorkspaceUiPersistedState {
  sidebarCollapsed: boolean;
  theme: Theme;
}

interface WorkspaceUiStoreState {
  commandPaletteOpen: boolean;
  sidebarCollapsed: boolean;
  theme: Theme;
  setCommandPaletteOpen: (open: boolean) => void;
  openCommandPalette: () => void;
  toggleCommandPalette: () => void;
  toggleSidebarCollapsed: () => void;
  toggleTheme: () => void;
}

function readLegacySidebarCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem("youin-sidebar-collapsed") === "true";
  } catch {
    return false;
  }
}

function readLegacyTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const raw = window.localStorage.getItem("youin-theme");
    const theme = raw ? JSON.parse(raw) : null;
    return theme === "light" || theme === "dark" ? theme : "dark";
  } catch {
    return "dark";
  }
}

/**
 * Zustand is intentionally limited to local UI memory. Server-synced workspace
 * data lives in the React Query workspace bootstrap cache.
 */
export const useWorkspaceUiStore = create<WorkspaceUiStoreState>()(
  persist(
    (set) => ({
      commandPaletteOpen: false,
      sidebarCollapsed: readLegacySidebarCollapsed(),
      theme: readLegacyTheme(),
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
      openCommandPalette: () => set({ commandPaletteOpen: true }),
      toggleCommandPalette: () =>
        set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),
      toggleSidebarCollapsed: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      toggleTheme: () =>
        set((state) => ({
          theme: state.theme === "dark" ? "light" : "dark",
        })),
    }),
    {
      name: "youin:workspace-ui",
      storage: createJSONStorage(() => window.localStorage),
      partialize: (state): WorkspaceUiPersistedState => ({
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
      }),
    },
  ),
);
