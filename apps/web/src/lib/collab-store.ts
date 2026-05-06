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
import * as ws from "@/lib/workspace/workspace-actions";
import type { ProfileUpdates } from "@/lib/workspace/workspace-actions";
import type { WorkspaceBootstrap } from "@/lib/workspace/workspace-types";

function workspaceStateFromBundle(bundle: WorkspaceBootstrap) {
  return {
    workspaceId: bundle.workspaceId,
    userId: bundle.userId,
    workspace: bundle.workspace,
    profile: bundle.profile,
  };
}

function emptyWorkspace(): Workspace {
  return {
    id: "",
    name: "",
    spaces: [],
    tags: [],
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
  tagIds: string[];
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
  updateSpace: (spaceId: string, updates: Pick<WorkspaceSpace, "name" | "notes">) => Promise<void>;
  toggleSpacePinned: (spaceId: string) => Promise<void>;
  updateSpacePriority: (spaceId: string, priority: SpacePriority) => Promise<void>;
  deleteSpace: (spaceId: string) => Promise<void>;
  createPin: (input: CreatePinInput) => Promise<PinItem>;
  togglePinStatus: (pinId: string) => Promise<void>;
  togglePinPinned: (pinId: string) => Promise<void>;
  updatePinPriority: (pinId: string, priority: PinPriority) => Promise<void>;
  updateLinearLink: (pinId: string, linearUrl: string) => Promise<void>;
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
  createTag: (label: string) => Promise<void>;
  deleteTag: (tagId: string) => Promise<void>;
  assignMark: (pinId: string, assigneeId: string | null) => Promise<void>;
  setMarkTags: (pinId: string, tagIds: string[]) => Promise<void>;
}

export const useCollabStore = create<CollabStoreState>()((set, get) => ({
  workspaceId: "",
  userId: "",
  workspace: emptyWorkspace(),
  profile: emptyProfile(),

  hydrate: (bundle) => {
    set(workspaceStateFromBundle(bundle));
  },

  createSpace: async (name, notes) => {
    const [bundle, createdId] = await ws.createSpaceAction(name, notes);
    const space = bundle.workspace.spaces.find((s) => s.id === createdId)!;
    set(workspaceStateFromBundle(bundle));
    return space;
  },

  updateSpace: async (spaceId, updates) => {
    const bundle = await ws.updateSpaceAction(spaceId, {
      name: updates.name,
      notes: updates.notes,
    });
    set(workspaceStateFromBundle(bundle));
  },

  toggleSpacePinned: async (spaceId) => {
    const { workspace } = get();
    const space = workspace.spaces.find((s) => s.id === spaceId);
    if (!space) return;
    const before = workspace;
    const nextPinned = !space.pinned;
    set({
      workspace: {
        ...workspace,
        spaces: workspace.spaces.map((s) =>
          s.id === spaceId ? { ...s, pinned: nextPinned } : s,
        ),
      },
    });
    try {
      const bundle = await ws.toggleSpacePinnedAction(spaceId);
      set(workspaceStateFromBundle(bundle));
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
      const bundle = await ws.updateSpacePriorityAction(spaceId, priority);
      set(workspaceStateFromBundle(bundle));
    } catch (e) {
      set({ workspace: before });
      throw e;
    }
  },

  deleteSpace: async (spaceId) => {
    const bundle = await ws.deleteSpaceAction(spaceId);
    set(workspaceStateFromBundle(bundle));
  },

  createPin: async (input) => {
    const [bundle, markId] = await ws.createPinAction({
      title: input.title,
      description: input.description,
      page: input.page,
      spaceId: input.spaceId,
      tagIds: input.tagIds,
      assigneeId: input.assigneeId ?? null,
      priority: input.priority,
    });
    set(workspaceStateFromBundle(bundle));
    return bundle.workspace.pins.find((p) => p.id === markId)!;
  },

  togglePinStatus: async (pinId) => {
    const { workspace } = get();
    const pin = workspace.pins.find((p) => p.id === pinId);
    if (!pin) return;
    const before = workspace;
    const nextStatus = pin.status === "closed" ? "open" : "closed";
    set({
      workspace: {
        ...workspace,
        pins: workspace.pins.map((p) => (p.id === pinId ? { ...p, status: nextStatus } : p)),
      },
    });
    try {
      const bundle = await ws.togglePinStatusAction(pinId);
      set(workspaceStateFromBundle(bundle));
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
    const nextPinned = !pin.pinned;
    set({
      workspace: {
        ...workspace,
        pins: workspace.pins.map((p) => (p.id === pinId ? { ...p, pinned: nextPinned } : p)),
      },
    });
    try {
      const bundle = await ws.togglePinPinnedAction(pinId);
      set(workspaceStateFromBundle(bundle));
    } catch (e) {
      set({ workspace: before });
      throw e;
    }
  },

  updatePinPriority: async (pinId, priority) => {
    const { workspace } = get();
    const pin = workspace.pins.find((p) => p.id === pinId);
    if (!pin) return;
    const before = workspace;
    set({
      workspace: {
        ...workspace,
        pins: workspace.pins.map((p) => (p.id === pinId ? { ...p, priority } : p)),
      },
    });
    try {
      const bundle = await ws.updatePinPriorityAction(pinId, priority);
      set(workspaceStateFromBundle(bundle));
    } catch (e) {
      set({ workspace: before });
      throw e;
    }
  },

  updateLinearLink: async (pinId, linearUrl) => {
    const bundle = await ws.updateLinearLinkAction(pinId, linearUrl);
    set(workspaceStateFromBundle(bundle));
  },

  deletePin: async (pinId) => {
    const { workspace } = get();
    const before = workspace;
    set({
      workspace: {
        ...workspace,
        pins: workspace.pins.filter((p) => p.id !== pinId),
      },
    });
    try {
      const bundle = await ws.deletePinAction(pinId);
      set(workspaceStateFromBundle(bundle));
    } catch (e) {
      set({ workspace: before });
      throw e;
    }
  },

  updatePin: async (pinId, updates) => {
    const { workspace } = get();
    const before = workspace;
    set({
      workspace: {
        ...workspace,
        pins: workspace.pins.map((p) =>
          p.id === pinId
            ? {
                ...p,
                ...(typeof updates.title === "string" ? { title: updates.title } : {}),
                ...(typeof updates.description === "string" ? { description: updates.description } : {}),
                ...(typeof updates.page === "string" ? { page: updates.page } : {}),
              }
            : p,
        ),
      },
    });
    try {
      const bundle = await ws.updatePinFieldsAction(pinId, updates);
      set(workspaceStateFromBundle(bundle));
    } catch (e) {
      set({ workspace: before });
      throw e;
    }
  },

  addComments: async (comments) => {
    if (!comments.length) return;
    const pinId = comments[0].pinId;
    const bundle = await ws.addMarkCommentsAction(
      pinId,
      comments.map((c) => ({
        type: c.type === "image" ? "image" : "text",
        body: c.body,
        imageUrl: c.imageUrl,
      })),
    );
    set(workspaceStateFromBundle(bundle));
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
      const bundle = await ws.updateMarkCommentAction(commentId, body);
      set(workspaceStateFromBundle(bundle));
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
      const bundle = await ws.deleteMarkCommentAction(commentId);
      set(workspaceStateFromBundle(bundle));
    } catch (e) {
      set({ workspace: before });
      throw e;
    }
  },

  updateProfile: async (updates) => {
    const bundle = await ws.updateProfileAction(updates);
    set(workspaceStateFromBundle(bundle));
  },

  updateMyWorkspaceUsername: async (username) => {
    const bundle = await ws.updateMyWorkspaceUsernameAction(username);
    set(workspaceStateFromBundle(bundle));
  },

  updateWorkspace: async (updates) => {
    const bundle = await ws.updateWorkspaceAction(updates);
    set(workspaceStateFromBundle(bundle));
  },

  inviteMember: async (email) => {
    const bundle = await ws.inviteMemberAction(email);
    set(workspaceStateFromBundle(bundle));
  },

  cancelInvite: async (inviteId) => {
    const bundle = await ws.cancelInviteAction(inviteId);
    set(workspaceStateFromBundle(bundle));
  },

  removeMember: async (memberUserId) => {
    const bundle = await ws.removeMemberAction(memberUserId);
    set(workspaceStateFromBundle(bundle));
  },

  createTag: async (label) => {
    const bundle = await ws.createTagAction(label);
    set(workspaceStateFromBundle(bundle));
  },

  deleteTag: async (tagId) => {
    const bundle = await ws.deleteTagAction(tagId);
    set(workspaceStateFromBundle(bundle));
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
      const bundle = await ws.assignMarkAction(pinId, assigneeId);
      set(workspaceStateFromBundle(bundle));
    } catch (e) {
      set({ workspace: before });
      throw e;
    }
  },

  setMarkTags: async (pinId, tagIds) => {
    const { workspace } = get();
    const pin = workspace.pins.find((p) => p.id === pinId);
    if (!pin) return;
    const before = workspace;
    const nextTagIds = Array.from(new Set(tagIds));
    set({
      workspace: {
        ...workspace,
        pins: workspace.pins.map((p) =>
          p.id === pinId ? { ...p, tagIds: nextTagIds } : p,
        ),
      },
    });
    try {
      const bundle = await ws.setMarkTagsAction(pinId, tagIds);
      set(workspaceStateFromBundle(bundle));
    } catch (e) {
      set({ workspace: before });
      throw e;
    }
  },
}));
