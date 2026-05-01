"use client";

import { create } from "zustand";

import type { PinComment, PinItem, Workspace, WorkspaceSpace } from "@/lib/collab-types";
import { mockWorkspace } from "@/lib/mock-workspace";

interface CreatePinInput {
  title: string;
  description: string;
  page: string;
  spaceId: string;
  tagIds: string[];
  assigneeId?: string;
}

interface CollabStoreState {
  workspace: Workspace;
  createSpace: (name: string, notes: string) => WorkspaceSpace;
  updateSpace: (spaceId: string, updates: Pick<WorkspaceSpace, "name" | "notes">) => void;
  deleteSpace: (spaceId: string) => void;
  createPin: (input: CreatePinInput) => PinItem;
  togglePinStatus: (pinId: string) => void;
  updateLinearLink: (pinId: string, linearUrl: string) => void;
  addComments: (comments: PinComment[]) => void;
}

export const useCollabStore = create<CollabStoreState>()((set) => ({
  workspace: mockWorkspace,

  createSpace: (name, notes) => {
    const created: WorkspaceSpace = {
      id: `spc_${Date.now()}`,
      name: name.trim(),
      notes: notes.trim() || "No description",
      createdAt: new Date().toISOString(),
    };
    set((state) => ({
      workspace: {
        ...state.workspace,
        spaces: [created, ...state.workspace.spaces],
      },
    }));
    return created;
  },

  updateSpace: (spaceId, updates) => {
    set((state) => ({
      workspace: {
        ...state.workspace,
        spaces: state.workspace.spaces.map((space) =>
          space.id === spaceId
            ? {
                ...space,
                name: updates.name.trim(),
                notes: updates.notes.trim(),
              }
            : space,
        ),
      },
    }));
  },

  deleteSpace: (spaceId) => {
    set((state) => ({
      workspace: {
        ...state.workspace,
        spaces: state.workspace.spaces.filter((space) => space.id !== spaceId),
        pins: state.workspace.pins.filter((pin) => pin.spaceId !== spaceId),
        comments: state.workspace.comments.filter((comment) =>
          state.workspace.pins.some((pin) => pin.id === comment.pinId && pin.spaceId !== spaceId),
        ),
      },
    }));
  },

  createPin: (input) => {
    const created: PinItem = {
      id: `MRK-${Date.now()}`,
      title: input.title.trim(),
      description: input.description.trim() || "No description yet.",
      page: input.page.trim(),
      spaceId: input.spaceId,
      status: "open",
      tagIds: input.tagIds,
      assigneeId: input.assigneeId,
    };
    set((state) => ({
      workspace: {
        ...state.workspace,
        pins: [created, ...state.workspace.pins],
      },
    }));
    return created;
  },

  togglePinStatus: (pinId) => {
    set((state) => ({
      workspace: {
        ...state.workspace,
        pins: state.workspace.pins.map((pin) =>
          pin.id === pinId
            ? { ...pin, status: pin.status === "open" ? ("closed" as const) : ("open" as const) }
            : pin,
        ),
      },
    }));
  },

  updateLinearLink: (pinId, linearUrl) => {
    set((state) => ({
      workspace: {
        ...state.workspace,
        pins: state.workspace.pins.map((pin) => (pin.id === pinId ? { ...pin, linearUrl } : pin)),
      },
    }));
  },

  addComments: (comments) => {
    if (!comments.length) return;
    set((state) => ({
      workspace: {
        ...state.workspace,
        comments: [...comments, ...state.workspace.comments],
      },
    }));
  },
}));
