"use client";

import { create } from "zustand";

import type { PinComment, PinItem, PinPriority, SpacePriority, Workspace, WorkspaceSpace } from "@/lib/collab-types";
import { mockWorkspace } from "@/lib/mock-workspace";

interface CreatePinInput {
  title: string;
  description: string;
  page: string;
  spaceId: string;
  tagIds: string[];
  assigneeId?: string;
  priority?: PinPriority;
}

interface CollabStoreState {
  workspace: Workspace;
  createSpace: (name: string, notes: string) => WorkspaceSpace;
  updateSpace: (spaceId: string, updates: Pick<WorkspaceSpace, "name" | "notes">) => void;
  toggleSpacePinned: (spaceId: string) => void;
  updateSpacePriority: (spaceId: string, priority: SpacePriority) => void;
  deleteSpace: (spaceId: string) => void;
  createPin: (input: CreatePinInput) => PinItem;
  togglePinStatus: (pinId: string) => void;
  togglePinPinned: (pinId: string) => void;
  updatePinPriority: (pinId: string, priority: PinPriority) => void;
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
      priority: "medium",
      pinned: false,
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

  toggleSpacePinned: (spaceId) => {
    set((state) => ({
      workspace: {
        ...state.workspace,
        spaces: state.workspace.spaces.map((space) =>
          space.id === spaceId ? { ...space, pinned: !space.pinned } : space,
        ),
      },
    }));
  },

  updateSpacePriority: (spaceId, priority) => {
    set((state) => ({
      workspace: {
        ...state.workspace,
        spaces: state.workspace.spaces.map((space) =>
          space.id === spaceId ? { ...space, priority } : space,
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
      priority: input.priority ?? "medium",
      pinned: false,
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

  togglePinPinned: (pinId) => {
    set((state) => ({
      workspace: {
        ...state.workspace,
        pins: state.workspace.pins.map((pin) =>
          pin.id === pinId ? { ...pin, pinned: !pin.pinned } : pin,
        ),
      },
    }));
  },

  updatePinPriority: (pinId, priority) => {
    set((state) => ({
      workspace: {
        ...state.workspace,
        pins: state.workspace.pins.map((pin) =>
          pin.id === pinId ? { ...pin, priority } : pin,
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
