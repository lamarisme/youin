"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { actionErrorMessage } from "@/lib/action-error";
import { useCollabStore } from "@/lib/collab-store";
import type {
  PinComment,
  PinItem,
  PinPriority,
  SpacePriority,
  WorkspaceProject,
  WorkspaceSpace,
} from "@/lib/collab-types";
import type { ProfileUpdates } from "@/lib/workspace/actions";

/**
 * Per-action mutation hooks. Each hook wraps the matching collab-store action
 * so call sites get:
 *   - automatic toast.success on resolution (with a sensible default copy)
 *   - automatic toast.error on rejection (via actionErrorMessage + fallback)
 *   - optimistic updates (the store already runs them; nothing to wire here)
 *
 * Pattern at call sites:
 *   const { mutateAsync: createSpace, isPending } = useCreateSpaceMutation();
 *   const space = await createSpace({ name, notes });
 *
 * Use mutateAsync when you need the resolved value (e.g. to navigate to the
 * created entity). Use mutate when fire-and-forget is fine.
 */

// ---------------------------------------------------------------------------
// Spaces
// ---------------------------------------------------------------------------

export function useCreateProjectMutation() {
  const createProject = useCollabStore((s) => s.createProject);
  return useMutation({
    mutationFn: ({ name, description }: { name: string; description?: string }) =>
      createProject(name, description),
    onSuccess: (project: WorkspaceProject) =>
      toast.success(`Created “${project.name}”.`),
    onError: (e) =>
      toast.error(actionErrorMessage(e, "Couldn't create this project.")),
  });
}

export function useCreateSpaceMutation() {
  const createSpace = useCollabStore((s) => s.createSpace);
  return useMutation({
    mutationFn: ({
      projectId,
      name,
      notes,
    }: {
      projectId: string;
      name: string;
      notes: string;
    }) => createSpace(projectId, name, notes),
    onSuccess: (space: WorkspaceSpace) =>
      toast.success(`Created “${space.name}”.`),
    onError: (e) =>
      toast.error(actionErrorMessage(e, "Couldn't create this space.")),
  });
}

export function useUpdateSpaceMutation() {
  const updateSpace = useCollabStore((s) => s.updateSpace);
  return useMutation({
    mutationFn: ({
      spaceId,
      name,
      notes,
    }: {
      spaceId: string;
      name: string;
      notes: string;
    }) => updateSpace(spaceId, { name, notes }),
    onSuccess: () => toast.success("Space updated."),
    onError: (e) =>
      toast.error(actionErrorMessage(e, "Couldn't save these details.")),
  });
}

export function useToggleSpacePinnedMutation() {
  const toggleSpacePinned = useCollabStore((s) => s.toggleSpacePinned);
  return useMutation({
    mutationFn: (spaceId: string) => toggleSpacePinned(spaceId),
    onError: (e) =>
      toast.error(actionErrorMessage(e, "Couldn't update pinned state.")),
  });
}

export function useUpdateSpacePriorityMutation() {
  const updateSpacePriority = useCollabStore((s) => s.updateSpacePriority);
  return useMutation({
    mutationFn: ({
      spaceId,
      priority,
    }: {
      spaceId: string;
      priority: SpacePriority;
    }) => updateSpacePriority(spaceId, priority),
    onError: (e) =>
      toast.error(actionErrorMessage(e, "Couldn't update priority.")),
  });
}

export function useDeleteSpaceMutation() {
  const deleteSpace = useCollabStore((s) => s.deleteSpace);
  return useMutation({
    mutationFn: (spaceId: string) => deleteSpace(spaceId),
    onSuccess: () => toast.success("Space deleted."),
    onError: (e) =>
      toast.error(actionErrorMessage(e, "Couldn't delete this space.")),
  });
}

// ---------------------------------------------------------------------------
// Pins (marks)
// ---------------------------------------------------------------------------

export interface CreatePinInput {
  title: string;
  description: string;
  page: string;
  spaceId: string;
  labelIds: string[];
  assigneeId?: string | null;
  priority?: PinPriority;
}

export function useCreatePinMutation() {
  const createPin = useCollabStore((s) => s.createPin);
  return useMutation({
    mutationFn: (input: CreatePinInput) => createPin(input),
    onSuccess: (pin: PinItem) => toast.success(`Created ${pin.displayKey}.`),
    onError: (e) =>
      toast.error(actionErrorMessage(e, "Couldn't create this mark.")),
  });
}

export function useTogglePinStatusMutation() {
  const togglePinStatus = useCollabStore((s) => s.togglePinStatus);
  return useMutation({
    mutationFn: (pinId: string) => togglePinStatus(pinId),
    onError: (e) =>
      toast.error(actionErrorMessage(e, "Couldn't update pin status.")),
  });
}

export function useTogglePinPinnedMutation() {
  const togglePinPinned = useCollabStore((s) => s.togglePinPinned);
  return useMutation({
    mutationFn: (pinId: string) => togglePinPinned(pinId),
    onError: (e) =>
      toast.error(actionErrorMessage(e, "Couldn't update pinned state.")),
  });
}

export function useUpdatePinPriorityMutation() {
  const updatePinPriority = useCollabStore((s) => s.updatePinPriority);
  return useMutation({
    mutationFn: ({
      pinId,
      priority,
    }: {
      pinId: string;
      priority: PinPriority;
    }) => updatePinPriority(pinId, priority),
    onError: (e) =>
      toast.error(actionErrorMessage(e, "Couldn't update priority.")),
  });
}

export function useDeletePinMutation() {
  const deletePin = useCollabStore((s) => s.deletePin);
  return useMutation({
    mutationFn: (pinId: string) => deletePin(pinId),
    onSuccess: () => toast.success("Mark deleted."),
    onError: (e) =>
      toast.error(actionErrorMessage(e, "Couldn't delete this mark.")),
  });
}

export function useUpdatePinMutation() {
  const updatePin = useCollabStore((s) => s.updatePin);
  return useMutation({
    mutationFn: ({
      pinId,
      updates,
    }: {
      pinId: string;
      updates: {
        title?: string;
        description?: string;
        page?: string;
        spaceId?: string;
      };
    }) => updatePin(pinId, updates),
    onError: (e) =>
      toast.error(actionErrorMessage(e, "Couldn't save changes.")),
  });
}

export function useAssignMarkMutation() {
  const assignMark = useCollabStore((s) => s.assignMark);
  return useMutation({
    mutationFn: ({
      pinId,
      assigneeId,
    }: {
      pinId: string;
      assigneeId: string | null;
    }) => assignMark(pinId, assigneeId),
    onError: (e) =>
      toast.error(actionErrorMessage(e, "Couldn't update assignee.")),
  });
}

export function useSetMarkLabelsMutation() {
  const setMarkLabels = useCollabStore((s) => s.setMarkLabels);
  return useMutation({
    mutationFn: ({ pinId, labelIds }: { pinId: string; labelIds: string[] }) =>
      setMarkLabels(pinId, labelIds),
    onError: (e) =>
      toast.error(actionErrorMessage(e, "Couldn't update labels.")),
  });
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export function useAddCommentsMutation() {
  const addComments = useCollabStore((s) => s.addComments);
  return useMutation({
    mutationFn: (comments: PinComment[]) => addComments(comments),
    onError: (e) =>
      toast.error(actionErrorMessage(e, "Couldn't post your comment.")),
  });
}

export function useUpdateCommentMutation() {
  const updateComment = useCollabStore((s) => s.updateComment);
  return useMutation({
    mutationFn: ({ commentId, body }: { commentId: string; body: string }) =>
      updateComment(commentId, body),
    onError: (e) =>
      toast.error(actionErrorMessage(e, "Couldn't update your comment.")),
  });
}

export function useDeleteCommentMutation() {
  const deleteComment = useCollabStore((s) => s.deleteComment);
  return useMutation({
    mutationFn: (commentId: string) => deleteComment(commentId),
    onSuccess: () => toast.success("Comment deleted."),
    onError: (e) =>
      toast.error(actionErrorMessage(e, "Couldn't delete this comment.")),
  });
}

// ---------------------------------------------------------------------------
// Profile / workspace settings
// ---------------------------------------------------------------------------

export function useUpdateProfileMutation() {
  const updateProfile = useCollabStore((s) => s.updateProfile);
  return useMutation({
    mutationFn: (updates: ProfileUpdates) => updateProfile(updates),
    onSuccess: () => toast.success("Profile saved."),
    onError: (e) =>
      toast.error(actionErrorMessage(e, "Couldn't save profile.")),
  });
}

export function useUpdateMyWorkspaceUsernameMutation() {
  const updateMyWorkspaceUsername = useCollabStore(
    (s) => s.updateMyWorkspaceUsername,
  );
  return useMutation({
    mutationFn: (username: string) => updateMyWorkspaceUsername(username),
    onSuccess: () => toast.success("Workspace username updated."),
    onError: (e) =>
      toast.error(actionErrorMessage(e, "Couldn't update username.")),
  });
}

export function useUpdateWorkspaceMutation() {
  const updateWorkspace = useCollabStore((s) => s.updateWorkspace);
  return useMutation({
    mutationFn: (updates: { name: string }) => updateWorkspace(updates),
    onSuccess: () => toast.success("Workspace renamed."),
    onError: (e) =>
      toast.error(actionErrorMessage(e, "Couldn't rename workspace.")),
  });
}

// ---------------------------------------------------------------------------
// Members & invites
// ---------------------------------------------------------------------------

export function useInviteMemberMutation() {
  const inviteMember = useCollabStore((s) => s.inviteMember);
  return useMutation({
    mutationFn: (email: string) => inviteMember(email),
    onSuccess: (_, email) => toast.success(`Invite sent to ${email.trim()}.`),
    onError: (e) =>
      toast.error(actionErrorMessage(e, "Couldn't send invite.")),
  });
}

export function useCancelInviteMutation() {
  const cancelInvite = useCollabStore((s) => s.cancelInvite);
  return useMutation({
    mutationFn: ({ inviteId }: { inviteId: string; email?: string }) =>
      cancelInvite(inviteId),
    onSuccess: (_, vars) =>
      toast.success(
        vars.email
          ? `Cancelled invite for ${vars.email}.`
          : "Invite cancelled.",
      ),
    onError: (e) =>
      toast.error(actionErrorMessage(e, "Couldn't cancel invite.")),
  });
}

export function useRemoveMemberMutation() {
  const removeMember = useCollabStore((s) => s.removeMember);
  return useMutation({
    mutationFn: ({
      memberUserId,
    }: {
      memberUserId: string;
      name?: string;
    }) => removeMember(memberUserId),
    onSuccess: (_, vars) =>
      toast.success(
        vars.name
          ? `Removed ${vars.name} from the workspace.`
          : "Member removed.",
      ),
    onError: (e) =>
      toast.error(actionErrorMessage(e, "Couldn't remove member.")),
  });
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export function useCreateLabelMutation() {
  const createLabel = useCollabStore((s) => s.createLabel);
  return useMutation({
    mutationFn: (name: string) => createLabel(name),
    onSuccess: (_, name) => toast.success(`Created label “${name.trim()}”.`),
    onError: (e) =>
      toast.error(actionErrorMessage(e, "Couldn't create this label.")),
  });
}

export function useDeleteLabelMutation() {
  const deleteLabel = useCollabStore((s) => s.deleteLabel);
  return useMutation({
    mutationFn: ({ labelId }: { labelId: string; name?: string }) =>
      deleteLabel(labelId),
    onSuccess: (_, vars) =>
      toast.success(
        vars.name ? `Deleted label “${vars.name}”.` : "Label deleted.",
      ),
    onError: (e) =>
      toast.error(actionErrorMessage(e, "Couldn't delete label.")),
  });
}
