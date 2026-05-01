"use client";

import { create } from "zustand";

import type {
  MarkEvent,
  MarkEventType,
  PinComment,
  PinItem,
  PinPriority,
  SpacePriority,
  Workspace,
  WorkspaceSpace,
} from "@/lib/collab-types";
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

const currentActorId = "usr_1";

function buildMarkEvent(
  pinId: string,
  type: MarkEventType,
  options?: {
    fromValue?: string;
    toValue?: string;
    metadata?: string;
  },
): MarkEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    pinId,
    actorId: currentActorId,
    type,
    createdAt: new Date().toISOString(),
    fromValue: options?.fromValue,
    toValue: options?.toValue,
    metadata: options?.metadata,
  };
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
      workspace: (() => {
        const removedPinIds = state.workspace.pins
          .filter((pin) => pin.spaceId === spaceId)
          .map((pin) => pin.id);
        return {
          ...state.workspace,
          spaces: state.workspace.spaces.filter((space) => space.id !== spaceId),
          pins: state.workspace.pins.filter((pin) => pin.spaceId !== spaceId),
          comments: state.workspace.comments.filter((comment) =>
            state.workspace.pins.some((pin) => pin.id === comment.pinId && pin.spaceId !== spaceId),
          ),
          markEvents: state.workspace.markEvents.filter((event) => !removedPinIds.includes(event.pinId)),
        };
      })(),
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
    const createdEvent = buildMarkEvent(created.id, "created", {
      metadata: "Mark created in triage.",
    });
    set((state) => ({
      workspace: {
        ...state.workspace,
        pins: [created, ...state.workspace.pins],
        markEvents: [createdEvent, ...state.workspace.markEvents],
      },
    }));
    return created;
  },

  togglePinStatus: (pinId) => {
    set((state) => {
      const currentPin = state.workspace.pins.find((pin) => pin.id === pinId);
      if (!currentPin) return state;
      const nextStatus = currentPin.status === "open" ? ("closed" as const) : ("open" as const);
      const event = buildMarkEvent(pinId, "status_changed", {
        fromValue: currentPin.status,
        toValue: nextStatus,
      });
      return {
        workspace: {
          ...state.workspace,
          pins: state.workspace.pins.map((pin) => (pin.id === pinId ? { ...pin, status: nextStatus } : pin)),
          markEvents: [event, ...state.workspace.markEvents],
        },
      };
    });
  },

  togglePinPinned: (pinId) => {
    set((state) => {
      const currentPin = state.workspace.pins.find((pin) => pin.id === pinId);
      if (!currentPin) return state;
      const nextPinned = !currentPin.pinned;
      const event = buildMarkEvent(pinId, "pinned_changed", {
        fromValue: String(currentPin.pinned),
        toValue: String(nextPinned),
      });
      return {
        workspace: {
          ...state.workspace,
          pins: state.workspace.pins.map((pin) => (pin.id === pinId ? { ...pin, pinned: nextPinned } : pin)),
          markEvents: [event, ...state.workspace.markEvents],
        },
      };
    });
  },

  updatePinPriority: (pinId, priority) => {
    set((state) => {
      const currentPin = state.workspace.pins.find((pin) => pin.id === pinId);
      if (!currentPin || currentPin.priority === priority) return state;
      const event = buildMarkEvent(pinId, "priority_changed", {
        fromValue: currentPin.priority,
        toValue: priority,
      });
      return {
        workspace: {
          ...state.workspace,
          pins: state.workspace.pins.map((pin) => (pin.id === pinId ? { ...pin, priority } : pin)),
          markEvents: [event, ...state.workspace.markEvents],
        },
      };
    });
  },

  updateLinearLink: (pinId, linearUrl) => {
    set((state) => {
      const currentPin = state.workspace.pins.find((pin) => pin.id === pinId);
      if (!currentPin || (currentPin.linearUrl ?? "") === linearUrl) return state;
      const normalized = linearUrl.trim();
      const event = buildMarkEvent(pinId, "linear_link_updated", {
        fromValue: currentPin.linearUrl ?? "",
        toValue: normalized,
      });
      return {
        workspace: {
          ...state.workspace,
          pins: state.workspace.pins.map((pin) => (pin.id === pinId ? { ...pin, linearUrl: normalized } : pin)),
          markEvents: [event, ...state.workspace.markEvents],
        },
      };
    });
  },

  addComments: (comments) => {
    if (!comments.length) return;
    set((state) => ({
      workspace: {
        ...state.workspace,
        comments: [...comments, ...state.workspace.comments],
        markEvents: [
          ...comments.map((comment) =>
            buildMarkEvent(comment.pinId, "comment_added", {
              metadata: comment.type === "image" ? "Image comment added." : "Text comment added.",
            }),
          ),
          ...state.workspace.markEvents,
        ],
      },
    }));
  },
}));
