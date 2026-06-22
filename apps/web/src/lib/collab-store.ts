"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { WorkspaceBootstrap } from "@/lib/workspace/workspace-types";

export type Theme = "light" | "dark";

interface WorkspaceUiPersistedState {
  sidebarCollapsed: boolean;
  theme: Theme;
}

interface WorkspaceUiStoreState {
  commandPaletteOpen: boolean;
  optimisticWorkspace: WorkspaceBootstrap | null;
  pendingOptimisticMutationIds: string[];
  sidebarCollapsed: boolean;
  selectedMarkIds: string[];
  theme: Theme;
  beginOptimisticMutation: (id: string) => void;
  clearOptimisticWorkspace: () => void;
  clearSelectedMarks: () => void;
  finishOptimisticMutation: (id: string) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setOptimisticWorkspace: (workspace: WorkspaceBootstrap | null) => void;
  setSelectedMarkIds: (ids: Iterable<string>) => void;
  openCommandPalette: () => void;
  pruneSelectedMarkIds: (validIds: Iterable<string>) => void;
  toggleMarkSelection: (id: string, selected?: boolean) => void;
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
 * Zustand owns ephemeral client intent: UI state, selections, and optimistic
 * workspace overlays. Canonical workspace data lives in the TanStack Query cache.
 */
export const useWorkspaceUiStore = create<WorkspaceUiStoreState>()(
  persist(
    (set) => ({
      commandPaletteOpen: false,
      optimisticWorkspace: null,
      pendingOptimisticMutationIds: [],
      sidebarCollapsed: readLegacySidebarCollapsed(),
      selectedMarkIds: [],
      theme: readLegacyTheme(),
      beginOptimisticMutation: (id) =>
        set((state) =>
          state.pendingOptimisticMutationIds.includes(id)
            ? state
            : {
                pendingOptimisticMutationIds: [
                  ...state.pendingOptimisticMutationIds,
                  id,
                ],
              },
        ),
      clearOptimisticWorkspace: () => set({ optimisticWorkspace: null }),
      clearSelectedMarks: () => set({ selectedMarkIds: [] }),
      finishOptimisticMutation: (id) =>
        set((state) => ({
          pendingOptimisticMutationIds:
            state.pendingOptimisticMutationIds.filter((item) => item !== id),
        })),
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
      setOptimisticWorkspace: (workspace) =>
        set({ optimisticWorkspace: workspace }),
      setSelectedMarkIds: (ids) =>
        set({ selectedMarkIds: Array.from(new Set(ids)) }),
      openCommandPalette: () => set({ commandPaletteOpen: true }),
      pruneSelectedMarkIds: (validIds) =>
        set((state) => {
          const valid = new Set(validIds);
          const selectedMarkIds = state.selectedMarkIds.filter((id) =>
            valid.has(id),
          );
          return selectedMarkIds.length === state.selectedMarkIds.length
            ? state
            : { selectedMarkIds };
        }),
      toggleMarkSelection: (id, selected) =>
        set((state) => {
          const selectedMarkIds = new Set(state.selectedMarkIds);
          const nextSelected = selected ?? !selectedMarkIds.has(id);
          if (nextSelected) {
            selectedMarkIds.add(id);
          } else {
            selectedMarkIds.delete(id);
          }
          return { selectedMarkIds: Array.from(selectedMarkIds) };
        }),
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
