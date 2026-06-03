"use client";

import { useMemo } from "react";

import type {
  TeamMember,
  Workspace,
  WorkspaceLabel,
  WorkspaceProject,
  WorkspaceWorkflowStatus,
} from "@/lib/collab-types";
import { buildCommentCountByMarkId } from "@/lib/workspace/mark-comment-counts";

type MarkTableModelWorkspace = Pick<
  Workspace,
  "members" | "labels" | "workflowStatuses" | "projects" | "comments" | "marks"
>;

export interface MarkTableModel {
  membersById: Map<string, TeamMember>;
  labelsById: Map<string, WorkspaceLabel>;
  workflowStatusesById: Map<string, WorkspaceWorkflowStatus>;
  projectsById: Map<string, WorkspaceProject>;
  commentCountByMarkId: Map<string, number>;
}

export function useMarkTableModel(workspace: MarkTableModelWorkspace): MarkTableModel {
  const membersById = useMemo(
    () => new Map(workspace.members.map((member) => [member.id, member])),
    [workspace.members],
  );
  const labelsById = useMemo(
    () => new Map(workspace.labels.map((label) => [label.id, label])),
    [workspace.labels],
  );
  const workflowStatusesById = useMemo(
    () => new Map(workspace.workflowStatuses.map((status) => [status.id, status])),
    [workspace.workflowStatuses],
  );
  const projectsById = useMemo(
    () => new Map(workspace.projects.map((project) => [project.id, project])),
    [workspace.projects],
  );
  const commentCountByMarkId = useMemo(
    () => buildCommentCountByMarkId(workspace.marks, workspace.comments),
    [workspace.comments, workspace.marks],
  );

  return useMemo(
    () => ({
      membersById,
      labelsById,
      workflowStatusesById,
      projectsById,
      commentCountByMarkId,
    }),
    [
      membersById,
      labelsById,
      workflowStatusesById,
      projectsById,
      commentCountByMarkId,
    ],
  );
}
