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
    bio: "",
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
  addComments: (comments: PinComment[]) => Promise<void>;
  updateProfile: (updates: ProfileUpdates) => Promise<void>;
  updateWorkspace: (updates: { name: string }) => Promise<void>;
  inviteMember: (email: string) => Promise<void>;
  cancelInvite: (inviteId: string) => Promise<void>;
  removeMember: (memberUserId: string) => Promise<void>;
  createTag: (label: string) => Promise<void>;
  deleteTag: (tagId: string) => Promise<void>;
  assignMark: (pinId: string, assigneeId: string | null) => Promise<void>;
  setMarkTags: (pinId: string, tagIds: string[]) => Promise<void>;
}

export const useCollabStore = create<CollabStoreState>()((set) => ({
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
    const bundle = await ws.toggleSpacePinnedAction(spaceId);
    set(workspaceStateFromBundle(bundle));
  },

  updateSpacePriority: async (spaceId, priority) => {
    const bundle = await ws.updateSpacePriorityAction(spaceId, priority);
    set(workspaceStateFromBundle(bundle));
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
    const bundle = await ws.togglePinStatusAction(pinId);
    set(workspaceStateFromBundle(bundle));
  },

  togglePinPinned: async (pinId) => {
    const bundle = await ws.togglePinPinnedAction(pinId);
    set(workspaceStateFromBundle(bundle));
  },

  updatePinPriority: async (pinId, priority) => {
    const bundle = await ws.updatePinPriorityAction(pinId, priority);
    set(workspaceStateFromBundle(bundle));
  },

  updateLinearLink: async (pinId, linearUrl) => {
    const bundle = await ws.updateLinearLinkAction(pinId, linearUrl);
    set(workspaceStateFromBundle(bundle));
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

  updateProfile: async (updates) => {
    const bundle = await ws.updateProfileAction(updates);
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
    const bundle = await ws.assignMarkAction(pinId, assigneeId);
    set(workspaceStateFromBundle(bundle));
  },

  setMarkTags: async (pinId, tagIds) => {
    const bundle = await ws.setMarkTagsAction(pinId, tagIds);
    set(workspaceStateFromBundle(bundle));
  },
}));
