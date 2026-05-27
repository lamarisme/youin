"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { actionErrorMessage } from "@/lib/action-error";
import type {
  MarkComment,
  MarkItem,
  MarkPriority,
  SpacePriority,
  Workspace,
  WorkspaceLabel,
  WorkspaceProject,
  WorkspaceSpace,
  WorkspaceView,
  WorkspaceViewConfig,
  WorkspaceViewFilters,
  WorkspaceViewLayout,
} from "@/lib/collab-types";
import { workspaceKeys } from "@/lib/queries/keys";
import {
  getWorkspaceQueryData,
  setWorkspaceQueryData,
} from "@/lib/queries/use-workspace";
import { labelColorClass } from "@/lib/workspace/label-styles";
import { formatMarkDisplayKey } from "@/lib/workspace/mark-display-id";
import { normalizeMarkPageUrl } from "@/lib/workspace/mark-page-url";
import * as ws from "@/lib/workspace/actions";
import type { ProfileUpdates } from "@/lib/workspace/actions";
import type { WorkspaceBootstrap } from "@/lib/workspace/workspace-types";

type MutationContext = {
  previous?: WorkspaceBootstrap;
};

function invalidateWorkspace(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: workspaceKeys.bootstrap() });
}

function restoreWorkspace(
  queryClient: ReturnType<typeof useQueryClient>,
  context: MutationContext | undefined,
) {
  if (context?.previous) {
    queryClient.setQueryData(workspaceKeys.bootstrap(), context.previous);
  }
}

function updateWorkspace(
  queryClient: ReturnType<typeof useQueryClient>,
  updater: (workspace: Workspace, bundle: WorkspaceBootstrap) => Workspace,
) {
  setWorkspaceQueryData(queryClient, (bundle) => ({
    ...bundle,
    workspace: updater(bundle.workspace, bundle),
  }));
}

function updateBundle(
  queryClient: ReturnType<typeof useQueryClient>,
  updater: (bundle: WorkspaceBootstrap) => WorkspaceBootstrap,
) {
  setWorkspaceQueryData(queryClient, updater);
}

function snapshot(queryClient: ReturnType<typeof useQueryClient>): MutationContext {
  return { previous: getWorkspaceQueryData(queryClient) };
}

function labelFromCreated(created: ws.CreatedLabel): WorkspaceLabel {
  return {
    id: created.id,
    name: created.name,
    colorClass: labelColorClass(created.id),
  };
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

export function useCreateWorkspaceViewMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ws.createWorkspaceViewAction,
    onSuccess: (view: WorkspaceView) => {
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        views: workspace.views.some((item) => item.id === view.id)
          ? workspace.views
          : [...workspace.views, view],
      }));
      toast.success(`Created “${view.name}”.`);
    },
    onError: (e) =>
      toast.error(actionErrorMessage(e, "Couldn't create this view.")),
    onSettled: () => invalidateWorkspace(queryClient),
  });
}

export function useUpdateWorkspaceViewMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      viewId,
      ...input
    }: {
      viewId: string;
      name?: string;
      layout?: WorkspaceViewLayout;
      filters?: Partial<WorkspaceViewFilters> | null;
      config?: Partial<WorkspaceViewConfig> | null;
    }) => ws.updateWorkspaceViewAction(viewId, input),
    onMutate: async ({ viewId, name, layout, filters, config }) => {
      await queryClient.cancelQueries({ queryKey: workspaceKeys.bootstrap() });
      const context = snapshot(queryClient);
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        views: workspace.views.map((view) =>
          view.id === viewId
            ? {
                ...view,
                ...(typeof name === "string" ? { name: name.trim() } : {}),
                ...(layout ? { layout } : {}),
                ...(filters ? { filters: { ...view.filters, ...filters } } : {}),
                ...(config ? { config: { ...view.config, ...config } } : {}),
              }
            : view,
        ),
      }));
      return context;
    },
    onSuccess: (view) => {
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        views: workspace.views.map((item) => (item.id === view.id ? view : item)),
      }));
      toast.success("View saved.");
    },
    onError: (e, _vars, context) => {
      restoreWorkspace(queryClient, context);
      toast.error(actionErrorMessage(e, "Couldn't save this view."));
    },
    onSettled: () => invalidateWorkspace(queryClient),
  });
}

export function useDeleteWorkspaceViewMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ viewId }: { viewId: string; name?: string }) =>
      ws.deleteWorkspaceViewAction(viewId),
    onMutate: async ({ viewId }) => {
      await queryClient.cancelQueries({ queryKey: workspaceKeys.bootstrap() });
      const context = snapshot(queryClient);
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        views: workspace.views.filter((view) => view.id !== viewId),
      }));
      return context;
    },
    onSuccess: (_, vars) =>
      toast.success(vars.name ? `Deleted “${vars.name}”.` : "View deleted."),
    onError: (e, _vars, context) => {
      restoreWorkspace(queryClient, context);
      toast.error(actionErrorMessage(e, "Couldn't delete this view."));
    },
    onSettled: () => invalidateWorkspace(queryClient),
  });
}

// ---------------------------------------------------------------------------
// Spaces
// ---------------------------------------------------------------------------

export function useCreateProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, description }: { name: string; description?: string }) =>
      ws.createProjectAction(name, description),
    onSuccess: (project: WorkspaceProject) => {
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        projects: [...workspace.projects, project],
      }));
      toast.success(`Created “${project.name}”.`);
    },
    onError: (e) =>
      toast.error(actionErrorMessage(e, "Couldn't create this project.")),
    onSettled: () => invalidateWorkspace(queryClient),
  });
}

export function useCreateSpaceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      name,
      notes,
    }: {
      projectId: string;
      name: string;
      notes: string;
    }) => ws.createSpaceAction(projectId, name, notes),
    onSuccess: (space: WorkspaceSpace) => {
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        spaces: [...workspace.spaces, space],
      }));
      toast.success(`Created “${space.name}”.`);
    },
    onError: (e) =>
      toast.error(actionErrorMessage(e, "Couldn't create this space.")),
    onSettled: () => invalidateWorkspace(queryClient),
  });
}

export function useUpdateSpaceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      spaceId,
      name,
      notes,
    }: {
      spaceId: string;
      name: string;
      notes: string;
    }) => ws.updateSpaceAction(spaceId, { name, notes }),
    onMutate: async ({ spaceId, name, notes }) => {
      await queryClient.cancelQueries({ queryKey: workspaceKeys.bootstrap() });
      const context = snapshot(queryClient);
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        spaces: workspace.spaces.map((space) =>
          space.id === spaceId ? { ...space, name, notes } : space,
        ),
      }));
      return context;
    },
    onError: (e, _vars, context) => {
      restoreWorkspace(queryClient, context);
      toast.error(actionErrorMessage(e, "Couldn't save these details."));
    },
    onSuccess: () => toast.success("Space updated."),
    onSettled: () => invalidateWorkspace(queryClient),
  });
}

export function useToggleSpacePinnedMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ws.toggleSpacePinnedAction,
    onMutate: async (spaceId) => {
      await queryClient.cancelQueries({ queryKey: workspaceKeys.bootstrap() });
      const context = snapshot(queryClient);
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        spaces: workspace.spaces.map((space) =>
          space.id === spaceId ? { ...space, pinned: !space.pinned } : space,
        ),
      }));
      return context;
    },
    onError: (e, _vars, context) => {
      restoreWorkspace(queryClient, context);
      toast.error(actionErrorMessage(e, "Couldn't update pinned state."));
    },
    onSettled: () => invalidateWorkspace(queryClient),
  });
}

export function useUpdateSpacePriorityMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      spaceId,
      priority,
    }: {
      spaceId: string;
      priority: SpacePriority;
    }) => ws.updateSpacePriorityAction(spaceId, priority),
    onMutate: async ({ spaceId, priority }) => {
      await queryClient.cancelQueries({ queryKey: workspaceKeys.bootstrap() });
      const context = snapshot(queryClient);
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        spaces: workspace.spaces.map((space) =>
          space.id === spaceId ? { ...space, priority } : space,
        ),
      }));
      return context;
    },
    onError: (e, _vars, context) => {
      restoreWorkspace(queryClient, context);
      toast.error(actionErrorMessage(e, "Couldn't update priority."));
    },
    onSettled: () => invalidateWorkspace(queryClient),
  });
}

export function useDeleteSpaceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ws.deleteSpaceAction,
    onMutate: async (spaceId) => {
      await queryClient.cancelQueries({ queryKey: workspaceKeys.bootstrap() });
      const context = snapshot(queryClient);
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        spaces: workspace.spaces.filter((space) => space.id !== spaceId),
        marks: workspace.marks.filter((mark) => mark.spaceId !== spaceId),
        comments: workspace.comments.filter(
          (comment) =>
            workspace.marks.find((mark) => mark.id === comment.markId)?.spaceId !==
            spaceId,
        ),
      }));
      return context;
    },
    onSuccess: () => toast.success("Space deleted."),
    onError: (e, _vars, context) => {
      restoreWorkspace(queryClient, context);
      toast.error(actionErrorMessage(e, "Couldn't delete this space."));
    },
    onSettled: () => invalidateWorkspace(queryClient),
  });
}

// ---------------------------------------------------------------------------
// Marks
// ---------------------------------------------------------------------------

export interface CreateMarkInput {
  title: string;
  description: string;
  page: string;
  spaceId: string;
  labelIds: string[];
  assigneeId?: string | null;
  priority?: MarkPriority;
}

export function useCreateMarkMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateMarkInput): Promise<MarkItem> => {
      const created = await ws.createMarkAction(input);
      const bundle = getWorkspaceQueryData(queryClient);
      const space = bundle?.workspace.spaces.find((s) => s.id === input.spaceId);
      const spaceCode = space?.code ?? "?";
      return {
        id: created.id,
        spaceId: input.spaceId,
        spaceCode,
        seq: created.seq,
        displayKey: formatMarkDisplayKey(spaceCode, created.seq),
        title: input.title.trim(),
        page: normalizeMarkPageUrl(input.page),
        description: input.description || "",
        status: "open",
        priority: input.priority ?? "medium",
        pinned: false,
        labelIds: [...input.labelIds],
        assigneeId: input.assigneeId ?? undefined,
        createdAt: created.createdAt,
      };
    },
    onSuccess: (mark) => {
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        marks: [...workspace.marks, mark],
      }));
      toast.success(`Created ${mark.displayKey}.`);
    },
    onError: (e) =>
      toast.error(actionErrorMessage(e, "Couldn't create this mark.")),
    onSettled: () => invalidateWorkspace(queryClient),
  });
}

export function useToggleMarkStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ws.toggleMarkStatusAction,
    onMutate: async (markId) => {
      await queryClient.cancelQueries({ queryKey: workspaceKeys.bootstrap() });
      const context = snapshot(queryClient);
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        marks: workspace.marks.map((mark) =>
          mark.id === markId
            ? { ...mark, status: mark.status === "closed" ? "open" : "closed" }
            : mark,
        ),
      }));
      return context;
    },
    onError: (e, _vars, context) => {
      restoreWorkspace(queryClient, context);
      toast.error(actionErrorMessage(e, "Couldn't update mark status."));
    },
    onSettled: () => invalidateWorkspace(queryClient),
  });
}

export function useToggleMarkPinnedMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ws.toggleMarkPinnedAction,
    onMutate: async (markId) => {
      await queryClient.cancelQueries({ queryKey: workspaceKeys.bootstrap() });
      const context = snapshot(queryClient);
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        marks: workspace.marks.map((mark) =>
          mark.id === markId ? { ...mark, pinned: !mark.pinned } : mark,
        ),
      }));
      return context;
    },
    onError: (e, _vars, context) => {
      restoreWorkspace(queryClient, context);
      toast.error(actionErrorMessage(e, "Couldn't update pinned state."));
    },
    onSettled: () => invalidateWorkspace(queryClient),
  });
}

export function useUpdateMarkPriorityMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      markId,
      priority,
    }: {
      markId: string;
      priority: MarkPriority;
    }) => ws.updateMarkPriorityAction(markId, priority),
    onMutate: async ({ markId, priority }) => {
      await queryClient.cancelQueries({ queryKey: workspaceKeys.bootstrap() });
      const context = snapshot(queryClient);
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        marks: workspace.marks.map((mark) =>
          mark.id === markId ? { ...mark, priority } : mark,
        ),
      }));
      return context;
    },
    onError: (e, _vars, context) => {
      restoreWorkspace(queryClient, context);
      toast.error(actionErrorMessage(e, "Couldn't update priority."));
    },
    onSettled: () => invalidateWorkspace(queryClient),
  });
}

export function useDeleteMarkMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ws.deleteMarkAction,
    onMutate: async (markId) => {
      await queryClient.cancelQueries({ queryKey: workspaceKeys.bootstrap() });
      const context = snapshot(queryClient);
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        marks: workspace.marks.filter((mark) => mark.id !== markId),
        comments: workspace.comments.filter((comment) => comment.markId !== markId),
        markEvents: workspace.markEvents.filter((event) => event.markId !== markId),
      }));
      return context;
    },
    onSuccess: () => toast.success("Mark deleted."),
    onError: (e, _vars, context) => {
      restoreWorkspace(queryClient, context);
      toast.error(actionErrorMessage(e, "Couldn't delete this mark."));
    },
    onSettled: () => invalidateWorkspace(queryClient),
  });
}

export function useUpdateMarkMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      markId,
      updates,
    }: {
      markId: string;
      updates: {
        title?: string;
        description?: string;
        page?: string;
        spaceId?: string;
      };
    }) => ws.updateMarkFieldsAction(markId, updates),
    onMutate: async ({ markId, updates }) => {
      await queryClient.cancelQueries({ queryKey: workspaceKeys.bootstrap() });
      const context = snapshot(queryClient);
      updateWorkspace(queryClient, (workspace) => {
        const nextSpace = updates.spaceId
          ? workspace.spaces.find((space) => space.id === updates.spaceId)
          : undefined;
        return {
          ...workspace,
          marks: workspace.marks.map((mark) =>
            mark.id === markId
              ? {
                  ...mark,
                  ...(typeof updates.title === "string"
                    ? { title: updates.title }
                    : {}),
                  ...(typeof updates.description === "string"
                    ? { description: updates.description }
                    : {}),
                  ...(typeof updates.page === "string"
                    ? { page: normalizeMarkPageUrl(updates.page) }
                    : {}),
                  ...(updates.spaceId
                    ? {
                        spaceId: updates.spaceId,
                        spaceCode: nextSpace?.code ?? mark.spaceCode,
                        displayKey: formatMarkDisplayKey(
                          nextSpace?.code ?? mark.spaceCode,
                          mark.seq,
                        ),
                      }
                    : {}),
                }
              : mark,
          ),
        };
      });
      return context;
    },
    onError: (e, _vars, context) => {
      restoreWorkspace(queryClient, context);
      toast.error(actionErrorMessage(e, "Couldn't save changes."));
    },
    onSettled: () => invalidateWorkspace(queryClient),
  });
}

export function useAssignMarkMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      markId,
      assigneeId,
    }: {
      markId: string;
      assigneeId: string | null;
    }) => ws.assignMarkAction(markId, assigneeId),
    onMutate: async ({ markId, assigneeId }) => {
      await queryClient.cancelQueries({ queryKey: workspaceKeys.bootstrap() });
      const context = snapshot(queryClient);
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        marks: workspace.marks.map((mark) =>
          mark.id === markId ? { ...mark, assigneeId: assigneeId ?? undefined } : mark,
        ),
      }));
      return context;
    },
    onError: (e, _vars, context) => {
      restoreWorkspace(queryClient, context);
      toast.error(actionErrorMessage(e, "Couldn't update assignee."));
    },
    onSettled: () => invalidateWorkspace(queryClient),
  });
}

export function useSetMarkLabelsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ markId, labelIds }: { markId: string; labelIds: string[] }) =>
      ws.setMarkLabelsAction(markId, labelIds),
    onMutate: async ({ markId, labelIds }) => {
      await queryClient.cancelQueries({ queryKey: workspaceKeys.bootstrap() });
      const context = snapshot(queryClient);
      const nextLabelIds = Array.from(new Set(labelIds));
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        marks: workspace.marks.map((mark) =>
          mark.id === markId ? { ...mark, labelIds: nextLabelIds } : mark,
        ),
      }));
      return context;
    },
    onError: (e, _vars, context) => {
      restoreWorkspace(queryClient, context);
      toast.error(actionErrorMessage(e, "Couldn't update labels."));
    },
    onSettled: () => invalidateWorkspace(queryClient),
  });
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export function useAddCommentsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (comments: MarkComment[]) => {
      if (!comments.length) return comments;
      await ws.addMarkCommentsAction(
        comments[0].markId,
        comments.map((comment) => ({
          type: comment.type === "image" ? "image" : "text",
          body: comment.body,
          imageUrl: comment.imageUrl,
        })),
      );
      return comments;
    },
    onMutate: async (comments) => {
      await queryClient.cancelQueries({ queryKey: workspaceKeys.bootstrap() });
      const context = snapshot(queryClient);
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        comments: [...workspace.comments, ...comments],
      }));
      return context;
    },
    onError: (e, _vars, context) => {
      restoreWorkspace(queryClient, context);
      toast.error(actionErrorMessage(e, "Couldn't post your comment."));
    },
    onSettled: () => invalidateWorkspace(queryClient),
  });
}

export function useUpdateCommentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, body }: { commentId: string; body: string }) =>
      ws.updateMarkCommentAction(commentId, body),
    onMutate: async ({ commentId, body }) => {
      await queryClient.cancelQueries({ queryKey: workspaceKeys.bootstrap() });
      const context = snapshot(queryClient);
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        comments: workspace.comments.map((comment) =>
          comment.id === commentId ? { ...comment, body } : comment,
        ),
      }));
      return context;
    },
    onError: (e, _vars, context) => {
      restoreWorkspace(queryClient, context);
      toast.error(actionErrorMessage(e, "Couldn't update your comment."));
    },
    onSettled: () => invalidateWorkspace(queryClient),
  });
}

export function useDeleteCommentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ws.deleteMarkCommentAction,
    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey: workspaceKeys.bootstrap() });
      const context = snapshot(queryClient);
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        comments: workspace.comments.filter((comment) => comment.id !== commentId),
      }));
      return context;
    },
    onSuccess: () => toast.success("Comment deleted."),
    onError: (e, _vars, context) => {
      restoreWorkspace(queryClient, context);
      toast.error(actionErrorMessage(e, "Couldn't delete this comment."));
    },
    onSettled: () => invalidateWorkspace(queryClient),
  });
}

// ---------------------------------------------------------------------------
// Profile / workspace settings
// ---------------------------------------------------------------------------

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ws.updateProfileAction,
    onMutate: async (updates: ProfileUpdates) => {
      await queryClient.cancelQueries({ queryKey: workspaceKeys.bootstrap() });
      const context = snapshot(queryClient);
      updateBundle(queryClient, (bundle) => ({
        ...bundle,
        profile: {
          ...bundle.profile,
          ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
          ...(updates.title !== undefined ? { title: updates.title.trim() } : {}),
          ...(updates.about !== undefined ? { about: updates.about.trim() } : {}),
          ...(updates.avatarUrl !== undefined
            ? { avatarUrl: updates.avatarUrl.trim() }
            : {}),
          ...(updates.timezone !== undefined
            ? { timezone: updates.timezone.trim() || "UTC" }
            : {}),
          ...(updates.displayNamePreference !== undefined
            ? {
                displayNamePreference:
                  updates.displayNamePreference === "username"
                    ? "username"
                    : "full_name",
              }
            : {}),
        },
      }));
      return context;
    },
    onSuccess: () => toast.success("Profile saved."),
    onError: (e, _vars, context) => {
      restoreWorkspace(queryClient, context);
      toast.error(actionErrorMessage(e, "Couldn't save profile."));
    },
    onSettled: () => invalidateWorkspace(queryClient),
  });
}

export function useUpdateMyWorkspaceUsernameMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ws.updateMyWorkspaceUsernameAction,
    onMutate: async (username) => {
      await queryClient.cancelQueries({ queryKey: workspaceKeys.bootstrap() });
      const context = snapshot(queryClient);
      const normalized = username.trim().toLowerCase();
      updateWorkspace(queryClient, (workspace, bundle) => ({
        ...workspace,
        members: workspace.members.map((member) =>
          member.id === bundle.userId ? { ...member, username: normalized } : member,
        ),
      }));
      return context;
    },
    onSuccess: () => toast.success("Workspace username updated."),
    onError: (e, _vars, context) => {
      restoreWorkspace(queryClient, context);
      toast.error(actionErrorMessage(e, "Couldn't update username."));
    },
    onSettled: () => invalidateWorkspace(queryClient),
  });
}

export function useUpdateWorkspaceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ws.updateWorkspaceAction,
    onMutate: async (updates: { name: string }) => {
      await queryClient.cancelQueries({ queryKey: workspaceKeys.bootstrap() });
      const context = snapshot(queryClient);
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        name: updates.name.trim(),
      }));
      return context;
    },
    onSuccess: () => toast.success("Workspace renamed."),
    onError: (e, _vars, context) => {
      restoreWorkspace(queryClient, context);
      toast.error(actionErrorMessage(e, "Couldn't rename workspace."));
    },
    onSettled: () => invalidateWorkspace(queryClient),
  });
}

// ---------------------------------------------------------------------------
// Members & invites
// ---------------------------------------------------------------------------

export function useInviteMemberMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ws.inviteMemberAction,
    onMutate: async (email) => {
      await queryClient.cancelQueries({ queryKey: workspaceKeys.bootstrap() });
      const context = snapshot(queryClient);
      const trimmed = email.trim().toLowerCase();
      updateWorkspace(queryClient, (workspace, bundle) => ({
        ...workspace,
        invites: [
          ...workspace.invites,
          {
            id: crypto.randomUUID(),
            email: trimmed,
            invitedAt: new Date().toISOString(),
            invitedBy:
              bundle.profile.name ||
              bundle.profile.email?.split("@")[0] ||
              "You",
          },
        ],
      }));
      return context;
    },
    onSuccess: (_, email) => toast.success(`Invite sent to ${email.trim()}.`),
    onError: (e, _vars, context) => {
      restoreWorkspace(queryClient, context);
      toast.error(actionErrorMessage(e, "Couldn't send invite."));
    },
    onSettled: () => invalidateWorkspace(queryClient),
  });
}

export function useCancelInviteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ inviteId }: { inviteId: string; email?: string }) =>
      ws.cancelInviteAction(inviteId),
    onMutate: async ({ inviteId }) => {
      await queryClient.cancelQueries({ queryKey: workspaceKeys.bootstrap() });
      const context = snapshot(queryClient);
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        invites: workspace.invites.filter((invite) => invite.id !== inviteId),
      }));
      return context;
    },
    onSuccess: (_, vars) =>
      toast.success(
        vars.email
          ? `Cancelled invite for ${vars.email}.`
          : "Invite cancelled.",
      ),
    onError: (e, _vars, context) => {
      restoreWorkspace(queryClient, context);
      toast.error(actionErrorMessage(e, "Couldn't cancel invite."));
    },
    onSettled: () => invalidateWorkspace(queryClient),
  });
}

export function useRemoveMemberMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      memberUserId,
    }: {
      memberUserId: string;
      name?: string;
    }) => ws.removeMemberAction(memberUserId),
    onMutate: async ({ memberUserId }) => {
      await queryClient.cancelQueries({ queryKey: workspaceKeys.bootstrap() });
      const context = snapshot(queryClient);
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        members: workspace.members.filter((member) => member.id !== memberUserId),
        marks: workspace.marks.map((mark) =>
          mark.assigneeId === memberUserId ? { ...mark, assigneeId: undefined } : mark,
        ),
      }));
      return context;
    },
    onSuccess: (_, vars) =>
      toast.success(
        vars.name
          ? `Removed ${vars.name} from the workspace.`
          : "Member removed.",
      ),
    onError: (e, _vars, context) => {
      restoreWorkspace(queryClient, context);
      toast.error(actionErrorMessage(e, "Couldn't remove member."));
    },
    onSettled: () => invalidateWorkspace(queryClient),
  });
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export function useCreateLabelMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ws.createLabelAction,
    onSuccess: (created, name) => {
      const label = labelFromCreated(created);
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        labels: workspace.labels.some((item) => item.id === label.id)
          ? workspace.labels
          : [...workspace.labels, label],
      }));
      toast.success(`Created label “${name.trim()}”.`);
    },
    onError: (e) =>
      toast.error(actionErrorMessage(e, "Couldn't create this label.")),
    onSettled: () => invalidateWorkspace(queryClient),
  });
}

export function useDeleteLabelMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ labelId }: { labelId: string; name?: string }) =>
      ws.deleteLabelAction(labelId),
    onMutate: async ({ labelId }) => {
      await queryClient.cancelQueries({ queryKey: workspaceKeys.bootstrap() });
      const context = snapshot(queryClient);
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        labels: workspace.labels.filter((label) => label.id !== labelId),
        marks: workspace.marks.map((mark) =>
          mark.labelIds.includes(labelId)
            ? { ...mark, labelIds: mark.labelIds.filter((id) => id !== labelId) }
            : mark,
        ),
      }));
      return context;
    },
    onSuccess: (_, vars) =>
      toast.success(
        vars.name ? `Deleted label “${vars.name}”.` : "Label deleted.",
      ),
    onError: (e, _vars, context) => {
      restoreWorkspace(queryClient, context);
      toast.error(actionErrorMessage(e, "Couldn't delete label."));
    },
    onSettled: () => invalidateWorkspace(queryClient),
  });
}
