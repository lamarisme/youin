"use client";

import { create } from "zustand";

interface WorkspaceUiStoreState {
  lastOpenedCommand: string | null;
  setLastOpenedCommand: (command: string | null) => void;
}

/**
 * Zustand is intentionally limited to local UI memory. Server-synced workspace
 * data lives in the React Query workspace bootstrap cache.
 */
export const useWorkspaceUiStore = create<WorkspaceUiStoreState>()((set) => ({
  lastOpenedCommand: null,
  setLastOpenedCommand: (command) => set({ lastOpenedCommand: command }),
}));
