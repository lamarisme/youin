"use client";

import Link from "next/link";
import {
  ArrowRight,
  Folder,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { Field } from "@/components/field";
import { Notice } from "@/components/notice";
import { ProductList, ProductListItem } from "@/components/product-list";
import { ProductSectionHeader } from "@/components/product-section";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { actionErrorMessage } from "@/lib/action-error";
import type { WorkspaceProject } from "@/lib/collab-types";
import { useWorkspaceData } from "@/lib/queries/use-workspace";
import {
  useCreateProjectMutation,
  useDeleteProjectMutation,
  useUpdateProjectMutation,
} from "@/lib/queries/use-workspace-mutations";
import { dashboardHref } from "@/lib/workspace/routes";
import { projectMarkCountsFromMarks } from "@/lib/workspace/read-model-mappers";

type ProjectEditorState =
  | { mode: "create" }
  | { mode: "edit"; project: WorkspaceProject };

export function ProjectsTab() {
  const { projects, marks } = useWorkspaceData((s) => ({
    projects: s.workspace.projects,
    marks: s.workspace.marks,
  }));
  const createProject = useCreateProjectMutation();
  const updateProject = useUpdateProjectMutation();
  const deleteProject = useDeleteProjectMutation();
  const [editor, setEditor] = useState<ProjectEditorState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkspaceProject | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const usageById = useMemo(
    () => projectMarkCountsFromMarks(projects, marks),
    [marks, projects],
  );
  const totalMarks = projects.reduce(
    (sum, project) => sum + (usageById.get(project.id) ?? 0),
    0,
  );
  const isSaving = createProject.isPending || updateProject.isPending;
  const isDeleting = deleteProject.isPending;
  const canSubmit = Boolean(name.trim()) && !isSaving;

  function openCreateProject() {
    setEditor({ mode: "create" });
    setName("");
    setDescription("");
    setFormError(null);
  }

  function openEditProject(project: WorkspaceProject) {
    setEditor({ mode: "edit", project });
    setName(project.name);
    setDescription(project.description);
    setFormError(null);
  }

  function closeEditor() {
    setEditor(null);
    setName("");
    setDescription("");
    setFormError(null);
  }

  async function handleSaveProject() {
    if (!editor || !canSubmit) return;
    setFormError(null);
    try {
      if (editor.mode === "create") {
        await createProject.mutateAsync({ name, description });
      } else {
        await updateProject.mutateAsync({
          projectId: editor.project.id,
          name,
          description,
        });
      }
      closeEditor();
    } catch (error) {
      setFormError(
        actionErrorMessage(
          error,
          editor.mode === "create"
            ? "Couldn't create this project."
            : "Couldn't save this project.",
        ),
      );
    }
  }

  async function handleDeleteProject() {
    if (!deleteTarget || isDeleting) return;
    const markCount = usageById.get(deleteTarget.id) ?? 0;
    if (markCount > 0) {
      setDeleteError("Move or delete this project's marks before deleting it.");
      return;
    }
    setDeleteError(null);
    try {
      await deleteProject.mutateAsync({
        projectId: deleteTarget.id,
        name: deleteTarget.name,
      });
      setDeleteTarget(null);
    } catch (error) {
      setDeleteError(actionErrorMessage(error, "Couldn't delete this project."));
    }
  }

  return (
    <div className="space-y-6">
      <ProductSectionHeader
        title="Projects"
        description="Projects organize marks by release, client, product area, or review stream."
        action={
          <Button
            type="button"
            size="sm"
            variant="mark"
            onClick={openCreateProject}
            className="h-10 gap-1.5 sm:h-8"
          >
            <Plus className="size-3.5" aria-hidden />
            New project
          </Button>
        }
      />

      <div className="grid gap-2 rounded-md border border-rule/60 bg-paper-2/60 px-3 py-2 sm:grid-cols-3">
        <ProjectMetric label="Projects" value={projects.length} />
        <ProjectMetric label="Marks" value={totalMarks} />
        <ProjectMetric
          label="Empty"
          value={projects.filter((project) => (usageById.get(project.id) ?? 0) === 0).length}
        />
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={Folder}
          title="No projects yet"
          description="Create a project before routing captured marks into a workspace scope."
          action={
            <Button
              type="button"
              size="sm"
              variant="mark"
              onClick={openCreateProject}
              className="h-10 sm:h-8"
            >
              <Plus className="size-3.5" aria-hidden />
              New project
            </Button>
          }
        />
      ) : (
        <ProductList>
          {projects.map((project) => {
            const count = usageById.get(project.id) ?? 0;
            return (
              <ProductListItem
                key={project.id}
                interactive={false}
                className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-rule/60 bg-paper-2 text-ink-3">
                    <Folder className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate text-ui-sm font-medium text-ink">
                      {project.name}
                    </h3>
                    <p className="mt-0.5 line-clamp-2 text-ui-xs leading-snug text-ink-3">
                      {project.description || "No description"}
                    </p>
                    <p className="mt-1 font-mono text-ui-xs tabular-nums text-ink-3">
                      {count} mark{count === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1.5">
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="h-9 gap-1.5 sm:h-8"
                  >
                    <Link
                      href={dashboardHref(new URLSearchParams(), {
                        kind: "project",
                        projectId: project.id,
                      })}
                      aria-label={`Open ${project.name} project marks`}
                    >
                      Open
                      <ArrowRight className="size-3.5" aria-hidden />
                    </Link>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Manage ${project.name}`}
                        className="text-ink-3 hover:text-ink"
                      >
                        <MoreHorizontal className="size-3.5" aria-hidden />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem
                        onSelect={() => {
                          openEditProject(project);
                        }}
                      >
                        <Pencil className="size-4" aria-hidden />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={count > 0}
                        onSelect={() => {
                          setDeleteTarget(project);
                          setDeleteError(null);
                        }}
                      >
                        <Trash2 className="size-4" aria-hidden />
                        Delete empty project
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </ProductListItem>
            );
          })}
        </ProductList>
      )}

      <Dialog
        open={editor !== null}
        onOpenChange={(open) => {
          if (!open && !isSaving) closeEditor();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editor?.mode === "edit" ? "Edit project" : "New project"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Set the project name and description.
            </DialogDescription>
          </DialogHeader>
          <div
            className="grid gap-3"
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                void handleSaveProject();
              }
            }}
          >
            <Field id="account-project-name" label="Name">
              <Input
                id="account-project-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Website QA"
                maxLength={120}
                className="h-10 bg-paper-elevated text-ui-md sm:h-8 sm:text-ui-sm"
                autoFocus
              />
            </Field>
            <Field id="account-project-description" label="Description">
              <Textarea
                id="account-project-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Release, client, product area, or review stream"
                maxLength={240}
                className="min-h-20 resize-none bg-paper-elevated"
              />
            </Field>
            {formError ? <Notice tone="danger">{formError}</Notice> : null}
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                onClick={closeEditor}
                disabled={isSaving}
                className="h-9"
              >
                Cancel
              </Button>
              <SubmitButton
                type="button"
                onClick={handleSaveProject}
                loading={isSaving}
                loadingText="Saving"
                disabled={!canSubmit}
                className="h-9"
              >
                {editor?.mode === "edit" ? "Save" : "Create"}
              </SubmitButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete project?</DialogTitle>
            <DialogDescription>
              {deleteTarget ? (
                <>
                  <span className="font-medium text-ink">{deleteTarget.name}</span>{" "}
                  has {usageById.get(deleteTarget.id) ?? 0} mark
                  {(usageById.get(deleteTarget.id) ?? 0) === 1 ? "" : "s"}.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          {deleteError ? <Notice tone="danger">{deleteError}</Notice> : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDeleteTarget(null);
                setDeleteError(null);
              }}
              disabled={isDeleting}
              className="h-9"
            >
              Cancel
            </Button>
            <SubmitButton
              type="button"
              onClick={handleDeleteProject}
              loading={isDeleting}
              loadingText="Deleting"
              variant="destructive"
              className="h-9"
            >
              Delete
            </SubmitButton>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProjectMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-ui-xs text-ink-3">{label}</p>
      <p className="font-mono text-ui-lg font-semibold tabular-nums text-ink">
        {value}
      </p>
    </div>
  );
}
