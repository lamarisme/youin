"use client";

import { create } from "zustand";

import type {
  PinComment,
  PinItem,
  PinPriority,
  SpacePriority,
  UserProfile,
  Workspace,
  WorkspaceSpace,
} from "@/lib/collab-types";
import * as ws from "@/lib/workspace/actions";
import type { ProfileUpdates } from "@/lib/workspace/actions";
import { labelColorClass } from "@/lib/workspace/label-styles";
import { formatPinDisplayKey } from "@/lib/workspace/mark-display-id";
import { normalizeMarkPageUrl } from "@/lib/workspace/mark-page-url";
import type { WorkspaceBootstrap } from "@/lib/workspace/workspace-types";

function emptyWorkspace(): Workspace {
  return {
    id: "",
    name: "",
    spaces: [],
    labels: [],
    members: [],
    invites: [],
    pins: [],
    comments: [],
    markEvents: [],
  };
}

function emptyProfile(): UserProfile {
  return {
    id: "",
    name: "",
    email: "",
    title: "",
    about: "",
    avatarUrl: "",
    timezone: "UTC",
  };
}

interface CreatePinInput {
  title: string;
  description: string;
  page: string;
  spaceId: string;
  labelIds: string[];
  assigneeId?: string | null;
  priority?: PinPriority;
}

interface CollabStoreState {
  workspaceId: string;
  userId: string;
  workspace: Workspace;
  profile: UserProfile;
  hydrate: (bundle: WorkspaceBootstrap) => void;
  createSpace: (name: string, notes: string) => Promise<WorkspaceSpace>;
  updateSpace: (
    spaceId: string,
    updates: Pick<WorkspaceSpace, "name" | "notes">,
  ) => Promise<void>;
  toggleSpacePinned: (spaceId: string) => Promise<void>;
  updateSpacePriority: (spaceId: string, priority: SpacePriority) => Promise<void>;
  deleteSpace: (spaceId: string) => Promise<void>;
  createPin: (input: CreatePinInput) => Promise<PinItem>;
  togglePinStatus: (pinId: string) => Promise<void>;
  togglePinPinned: (pinId: string) => Promise<void>;
  updatePinPriority: (pinId: string, priority: PinPriority) => Promise<void>;
  deletePin: (pinId: string) => Promise<void>;
  updatePin: (pinId: string, updates: { title?: string; description?: string; page?: string; spaceId?: string }) => Promise<void>;
  addComments: (comments: PinComment[]) => Promise<void>;
  updateComment: (commentId: string, body: string) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;
  updateProfile: (updates: ProfileUpdates) => Promise<void>;
  updateMyWorkspaceUsername: (username: string) => Promise<void>;
  updateWorkspace: (updates: { name: string }) => Promise<void>;
  inviteMember: (email: string) => Promise<void>;
  cancelInvite: (inviteId: string) => Promise<void>;
  removeMember: (memberUserId: string) => Promise<void>;
  createLabel: (name: string) => Promise<void>;
  deleteLabel: (labelId: string) => Promise<void>;
  assignMark: (pinId: string, assigneeId: string | null) => Promise<void>;
  setMarkLabels: (pinId: string, labelIds: string[]) => Promise<void>;
}

export const useCollabStore = create<CollabStoreState>()((set, get) => ({
  workspaceId: "",
  userId: "",
  workspace: emptyWorkspace(),
  profile: emptyProfile(),

  hydrate: (bundle) => {
    set({
      workspaceId: bundle.workspaceId,
      userId: bundle.userId,
      workspace: bundle.workspace,
      profile: bundle.profile,
    });
  },

  // -----------------------------------------------------------------------
  // Spaces
  // -----------------------------------------------------------------------

  createSpace: async (name, notes) => {
    const created = await ws.createSpaceAction(name, notes);
    const space: WorkspaceSpace = {
      id: created.id,
      code: created.code,
      name: created.name,
      notes: created.notes,
      priority: created.priority,
      pinned: created.pinned,
      createdAt: created.createdAt,
    };
    const { workspace } = get();
    set({ workspace: { ...workspace, spaces: [...workspace.spaces, space] } });
    return space;
  },

  updateSpace: async (spaceId, updates) => {
    const { workspace } = get();
    const before = workspace;
    set({
      workspace: {
        ...workspace,
        spaces: workspace.spaces.map((s) =>
          s.id === spaceId ? { ...s, name: updates.name, notes: updates.notes } : s,
        ),
      },
    });
    try {
      await ws.updateSpaceAction(spaceId, updates);
    } catch (e) {
      set({ workspace: before });
      throw e;
    }
  },

  toggleSpacePinned: async (spaceId) => {
    const { workspace } = get();
    const space = workspace.spaces.find((s) => s.id === spaceId);
    if (!space) return;
    const before = workspace;
    set({
      workspace: {
        ...workspace,
        spaces: workspace.spaces.map((s) =>
          s.id === spaceId ? { ...s, pinned: !space.pinned } : s,
        ),
      },
    });
    try {
      await ws.toggleSpacePinnedAction(spaceId);
    } catch (e) {
      set({ workspace: before });
      throw e;
    }
  },

  updateSpacePriority: async (spaceId, priority) => {
    const { workspace } = get();
    const before = workspace;
    set({
      workspace: {
        ...workspace,
        spaces: workspace.spaces.map((s) => (s.id === spaceId ? { ...s, priority } : s)),
      },
    });
    try {
      await ws.updateSpacePriorityAction(spaceId, priority);
    } catch (e) {
      set({ workspace: before });
      throw e;
    }
  },

  deleteSpace: async (spaceId) => {
    const { workspace } = get();
    const before = workspace;
    set({
      workspace: {
        ...workspace,
        spaces: workspace.spaces.filter((s) => s.id !== spaceId),
        pins: workspace.pins.filter((p) => p.spaceId !== spaceId),
      },
    });
    try {
      await ws.deleteSpaceAction(spaceId);
    } catch (e) {
      set({ workspace: before });
      throw e;
    }
  },

  // -----------------------------------------------------------------------
  // Pins (marks)
  // -----------------------------------------------------------------------

  createPin: async (input) => {
    const created = await ws.createPinAction(input);
    const { workspace } = get();
    const space = workspace.spaces.find((s) => s.id === input.spaceId);
    const spaceCode = space?.code ?? "?";
    const pin: PinItem = {
      id: created.id,
      spaceId: input.spaceId,
      spaceCode,
      seq: created.seq,
      displayKey: formatPinDisplayKey(spaceCode, created.seq),
      title: input.title.trim(),
      page: normalizeMarkPageUrl(input.page),
      description: input.description.trim() || "",
      status: "open",
      priority: input.priority ?? "medium",
      pinned: false,
      labelIds: [...input.labelIds],
      assigneeId: input.assigneeId ?? undefined,
      createdAt: created.createdAt,
    };
    set({ workspace: { ...workspace, pins: [...workspace.pins, pin] } });
    return pin;
  },

  togglePinStatus: async (pinId) => {
    const { workspace } = get();
    const pin = workspace.pins.find((p) => p.id === pinId);
    if (!pin) return;
    const before = workspace;
    const next = pin.status === "closed" ? "open" : "closed";
    set({
      workspace: {
        ...workspace,
        pins: workspace.pins.map((p) => (p.id === pinId ? { ...p, status: next } : p)),
      },
    });
    try {
      await ws.togglePinStatusAction(pinId);
    } catch (e) {
      set({ workspace: before });
      throw e;
    }
  },

  togglePinPinned: async (pinId) => {
    const { workspace } = get();
    const pin = workspace.pins.find((p) => p.id === pinId);
    if (!pin) return;
    const before = workspace;
    set({
      workspace: {
        ...workspace,
        pins: workspace.pins.map((p) =>
          p.id === pinId ? { ...p, pinned: !pin.pinned } : p,
        ),
      },
    });
    try {
      await ws.togglePinPinnedAction(pinId);
    } catch (e) {
      set({ workspace: before });
      throw e;
    }
  },

  updatePinPriority: async (pinId, priority) => {
    const { workspace } = get();
    const before = workspace;
    set({
      workspace: {
        ...workspace,
        pins: workspace.pins.map((p) => (p.id === pinId ? { ...p, priority } : p)),
      },
    });
    try {
      await ws.updatePinPriorityAction(pinId, priority);
    } catch (e) {
      set({ workspace: before });
      throw e;
    }
  },

  deletePin: async (pinId) => {
    const { workspace } = get();
    const before = workspace;
    set({
      workspace: {
        ...workspace,
        pins: workspace.pins.filter((p) => p.id !== pinId),
        comments: workspace.comments.filter((c) => c.pinId !== pinId),
      },
    });
    try {
      await ws.deletePinAction(pinId);
    } catch (e) {
      set({ workspace: before });
      throw e;
    }
  },

  updatePin: async (pinId, updates) => {
    const { workspace } = get();
    const before = workspace;
    const nextSpace = updates.spaceId
      ? workspace.spaces.find((s) => s.id === updates.spaceId)
      : undefined;
    set({
      workspace: {
        ...workspace,
        pins: workspace.pins.map((p) =>
          p.id === pinId
            ? {
                ...p,
                ...(typeof updates.title === "string" ? { title: updates.title } : {}),
                ...(typeof updates.description === "string"
                  ? { description: updates.description }
                  : {}),
                ...(typeof updates.page === "string" ? { page: updates.page } : {}),
                ...(updates.spaceId
                  ? {
                      spaceId: updates.spaceId,
                      spaceCode: nextSpace?.code ?? p.spaceCode,
                      displayKey: formatPinDisplayKey(
                        nextSpace?.code ?? p.spaceCode,
                        p.seq,
                      ),
                    }
                  : {}),
              }
            : p,
        ),
      },
    });
    try {
      await ws.updatePinFieldsAction(pinId, updates);
    } catch (e) {
      set({ workspace: before });
      throw e;
    }
  },

  assignMark: async (pinId, assigneeId) => {
    const { workspace } = get();
    const pin = workspace.pins.find((p) => p.id === pinId);
    if (!pin) return;
    const before = workspace;
    set({
      workspace: {
        ...workspace,
        pins: workspace.pins.map((p) =>
          p.id === pinId ? { ...p, assigneeId: assigneeId ?? undefined } : p,
        ),
      },
    });
    try {
      await ws.assignMarkAction(pinId, assigneeId);
    } catch (e) {
      set({ workspace: before });
      throw e;
    }
  },

  setMarkLabels: async (pinId, labelIds) => {
    const { workspace } = get();
    const pin = workspace.pins.find((p) => p.id === pinId);
    if (!pin) return;
    const before = workspace;
    const nextLabelIds = Array.from(new Set(labelIds));
    set({
      workspace: {
        ...workspace,
        pins: workspace.pins.map((p) =>
          p.id === pinId ? { ...p, labelIds: nextLabelIds } : p,
        ),
      },
    });
    try {
      await ws.setMarkLabelsAction(pinId, labelIds);
    } catch (e) {
      set({ workspace: before });
      throw e;
    }
  },

  // -----------------------------------------------------------------------
  // Comments
  // -----------------------------------------------------------------------

  addComments: async (comments) => {
    if (!comments.length) return;
    const pinId = comments[0].pinId;
    const { workspace } = get();
    const before = workspace;
    set({
      workspace: { ...workspace, comments: [...workspace.comments, ...comments] },
    });
    try {
      await ws.addMarkCommentsAction(
        pinId,
        comments.map((c) => ({
          type: c.type === "image" ? "image" : "text",
          body: c.body,
          imageUrl: c.imageUrl,
        })),
      );
    } catch (e) {
      set({ workspace: before });
      throw e;
    }
  },

  updateComment: async (commentId, body) => {
    const { workspace } = get();
    const target = workspace.comments.find((c) => c.id === commentId);
    if (!target) return;
    const before = workspace;
    set({
      workspace: {
        ...workspace,
        comments: workspace.comments.map((c) =>
          c.id === commentId ? { ...c, body } : c,
        ),
      },
    });
    try {
      await ws.updateMarkCommentAction(commentId, body);
    } catch (e) {
      set({ workspace: before });
      throw e;
    }
  },

  deleteComment: async (commentId) => {
    const { workspace } = get();
    const target = workspace.comments.find((c) => c.id === commentId);
    if (!target) return;
    const before = workspace;
    set({
      workspace: {
        ...workspace,
        comments: workspace.comments.filter((c) => c.id !== commentId),
      },
    });
    try {
      await ws.deleteMarkCommentAction(commentId);
    } catch (e) {
      set({ workspace: before });
      throw e;
    }
  },

  // -----------------------------------------------------------------------
  // Profile + workspace
  // -----------------------------------------------------------------------

  updateProfile: async (updates) => {
    const { profile } = get();
    const before = profile;
    set({
      profile: {
        ...profile,
        ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
        ...(updates.title !== undefined ? { title: updates.title.trim() } : {}),
        ...(updates.about !== undefined ? { about: updates.about.trim() } : {}),
        ...(updates.avatarUrl !== undefined
          ? { avatarUrl: updates.avatarUrl.trim() }
          : {}),
        ...(updates.timezone !== undefined
          ? { timezone: updates.timezone.trim() || "UTC" }
          : {}),
      },
    });
    try {
      await ws.updateProfileAction(updates);
    } catch (e) {
      set({ profile: before });
      throw e;
    }
  },

  updateMyWorkspaceUsername: async (username) => {
    const { workspace, userId } = get();
    const before = workspace;
    const trimmed = username.trim().toLowerCase();
    set({
      workspace: {
        ...workspace,
        members: workspace.members.map((m) =>
          m.id === userId ? { ...m, username: trimmed } : m,
        ),
      },
    });
    try {
      await ws.updateMyWorkspaceUsernameAction(username);
    } catch (e) {
      set({ workspace: before });
      throw e;
    }
  },

  updateWorkspace: async (updates) => {
    const { workspace } = get();
    const before = workspace;
    set({ workspace: { ...workspace, name: updates.name.trim() } });
    try {
      await ws.updateWorkspaceAction(updates);
    } catch (e) {
      set({ workspace: before });
      throw e;
    }
  },

  // -----------------------------------------------------------------------
  // Members + invites
  // -----------------------------------------------------------------------

  inviteMember: async (email) => {
    const { workspace, profile } = get();
    const before = workspace;
    const tempId = crypto.randomUUID();
    const trimmed = email.trim().toLowerCase();
    set({
      workspace: {
        ...workspace,
        invites: [
          ...workspace.invites,
          {
            id: tempId,
            email: trimmed,
            invitedAt: new Date().toISOString(),
            invitedBy: profile.name || profile.email?.split("@")[0] || "You",
          },
        ],
      },
    });
    try {
      await ws.inviteMemberAction(email);
    } catch (e) {
      set({ workspace: before });
      throw e;
    }
  },

  cancelInvite: async (inviteId) => {
    const { workspace } = get();
    const before = workspace;
    set({
      workspace: {
        ...workspace,
        invites: workspace.invites.filter((i) => i.id !== inviteId),
      },
    });
    try {
      await ws.cancelInviteAction(inviteId);
    } catch (e) {
      set({ workspace: before });
      throw e;
    }
  },

  removeMember: async (memberUserId) => {
    const { workspace } = get();
    const before = workspace;
    set({
      workspace: {
        ...workspace,
        members: workspace.members.filter((m) => m.id !== memberUserId),
      },
    });
    try {
      await ws.removeMemberAction(memberUserId);
    } catch (e) {
      set({ workspace: before });
      throw e;
    }
  },

  // -----------------------------------------------------------------------
  // Labels
  // -----------------------------------------------------------------------

  createLabel: async (name) => {
    const { workspace } = get();
    const before = workspace;
    const tempId = crypto.randomUUID();
    const trimmed = name.trim();
    set({
      workspace: {
        ...workspace,
        labels: [
          ...workspace.labels,
          { id: tempId, name: trimmed, colorClass: labelColorClass(tempId) },
        ],
      },
    });
    try {
      const created = await ws.createLabelAction(name);
      const cur = get().workspace;
      set({
        workspace: {
          ...cur,
          labels: cur.labels.map((l) =>
            l.id === tempId
              ? { id: created.id, name: created.name, colorClass: labelColorClass(created.id) }
              : l,
          ),
        },
      });
    } catch (e) {
      set({ workspace: before });
      throw e;
    }
  },

  deleteLabel: async (labelId) => {
    const { workspace } = get();
    const before = workspace;
    set({
      workspace: {
        ...workspace,
        labels: workspace.labels.filter((l) => l.id !== labelId),
        pins: workspace.pins.map((p) =>
          p.labelIds.includes(labelId)
            ? { ...p, labelIds: p.labelIds.filter((id) => id !== labelId) }
            : p,
        ),
      },
    });
    try {
      await ws.deleteLabelAction(labelId);
    } catch (e) {
      set({ workspace: before });
      throw e;
    }
  },
}));
