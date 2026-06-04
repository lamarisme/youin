import type {
  AiPromptTarget,
  MarkComment,
  MarkItem,
  TeamMember,
  WorkspaceLabel,
  WorkspaceProject,
  WorkspaceWorkflowStatus,
} from "@/lib/collab-types";
import { markDescriptionPlainText } from "@/lib/mark-description";
import { memberPickerLabel } from "@/lib/workspace/member-label";

type PromptComment = {
  author: string;
  body: string;
  createdAt?: string;
};

type BuildMarkPromptInput = {
  mark: MarkItem;
  comments?: PromptComment[];
  labels?: WorkspaceLabel[];
  project?: WorkspaceProject | null;
  assignee?: string;
  workflowStatus?: WorkspaceWorkflowStatus | null;
  target?: AiPromptTarget;
};

type BuildBulkPromptInput = {
  marks: MarkItem[];
  labelsById: Map<string, WorkspaceLabel>;
  projectsById: Map<string, WorkspaceProject>;
  workflowStatusesById: Map<string, WorkspaceWorkflowStatus>;
};

function promptAgentLine(target: AiPromptTarget): string {
  if (target === "codex") {
    return "You are Codex, an AI coding agent working in this repository.";
  }
  if (target === "claude") {
    return "You are Claude Code, an AI coding agent working in this repository.";
  }
  return "You are an AI coding agent working in this repository.";
}

function valueOrNone(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "Not captured";
}

function markdownList(items: Array<string | false | null | undefined>): string {
  return items.filter(Boolean).map((item) => `- ${item}`).join("\n");
}

function domSnapshotContext(snapshot: Record<string, unknown> | undefined): {
  outerHTML?: string;
  nearbyText?: string;
  textContent?: string;
} {
  if (!snapshot) return {};
  const selected = snapshot.selectedElement;
  const context = snapshot.context;
  const selectedRecord =
    selected && typeof selected === "object" && !Array.isArray(selected)
      ? (selected as Record<string, unknown>)
      : null;
  const contextRecord =
    context && typeof context === "object" && !Array.isArray(context)
      ? (context as Record<string, unknown>)
      : null;
  return {
    outerHTML:
      typeof selectedRecord?.outerHTML === "string"
        ? selectedRecord.outerHTML.slice(0, 2200)
        : undefined,
    textContent:
      typeof selectedRecord?.textContent === "string"
        ? selectedRecord.textContent.slice(0, 700)
        : undefined,
    nearbyText:
      typeof contextRecord?.nearbyText === "string"
        ? contextRecord.nearbyText.slice(0, 900)
        : undefined,
  };
}

function labelNames(labels: readonly WorkspaceLabel[]): string {
  return labels.map((label) => label.name).join(", ") || "None";
}

function commentLines(comments: readonly PromptComment[]): string {
  if (!comments.length) return "No comments yet.";
  return comments
    .slice(0, 12)
    .map((comment, index) => {
      const body = markDescriptionPlainText(comment.body).slice(0, 900);
      const date = comment.createdAt ? ` at ${comment.createdAt}` : "";
      return `${index + 1}. ${comment.author}${date}: ${body || "(image or empty comment)"}`;
    })
    .join("\n");
}

export function buildPromptComments(
  comments: readonly MarkComment[],
  membersById: Map<string, TeamMember>,
): PromptComment[] {
  return comments.map((comment) => {
    const author = membersById.get(comment.authorId);
    return {
      author: author ? memberPickerLabel(author, "full_name") : "Unknown member",
      body: comment.body ?? (comment.imageUrl ? `Image: ${comment.imageUrl}` : ""),
      createdAt: comment.createdAt,
    };
  });
}

export function buildMarkAiPrompt({
  mark,
  comments = [],
  labels = [],
  project,
  assignee,
  workflowStatus,
  target = "generic",
}: BuildMarkPromptInput): string {
  const capture = mark.capture;
  const dom = domSnapshotContext(capture?.domSnapshot);
  const description = markDescriptionPlainText(mark.description);
  const workflowName = workflowStatus?.name ?? mark.status;
  const sections = [
    promptAgentLine(target),
    "",
    "Use the YouIn mark context below to implement the requested UI change. Start by locating the relevant page/component, then make the smallest high-quality code change that resolves the mark. Preserve existing project patterns.",
    "",
    "## Mark",
    markdownList([
      `ID: ${mark.displayKey}`,
      `Title: ${mark.title}`,
      `Project: ${project?.name ?? "Unknown project"}`,
      `Status: ${workflowName}`,
      `Priority: ${mark.priority}`,
      `Labels: ${labelNames(labels)}`,
      `Assignee: ${assignee || "Unassigned"}`,
    ]),
    "",
    "## Requested Change",
    description || "Use the title and discussion to infer the requested change.",
    "",
    "## Page Context",
    markdownList([
      `Page URL: ${valueOrNone(mark.page)}`,
      `DOM selector: ${valueOrNone(capture?.selector)}`,
      `Viewport: ${valueOrNone(capture?.viewport)}`,
      `Browser: ${valueOrNone(capture?.browser)}`,
      `OS: ${valueOrNone(capture?.os)}`,
      `Captured at: ${valueOrNone(capture?.capturedAt)}`,
      capture?.screenshotUrl ? `Screenshot: ${capture.screenshotUrl}` : "Screenshot: Not captured",
    ]),
    "",
    "## Discussion",
    commentLines(comments),
  ];

  if (dom.textContent || dom.nearbyText) {
    sections.push(
      "",
      "## Visible Text",
      [dom.textContent, dom.nearbyText].filter(Boolean).join("\n\n"),
    );
  }

  if (dom.outerHTML) {
    sections.push(
      "",
      "## Selected Element DOM",
      "```html",
      dom.outerHTML,
      "```",
    );
  }

  sections.push(
    "",
    "## Output Expectations",
    markdownList([
      "Explain the relevant files you changed.",
      "Keep the implementation scoped to this mark.",
      "Run or suggest the narrowest useful verification command.",
      "Call out any missing context if the selector or screenshot is stale.",
    ]),
  );

  return sections.join("\n");
}

export function buildBulkMarksAiPrompt({
  marks,
  labelsById,
  projectsById,
  workflowStatusesById,
}: BuildBulkPromptInput): string {
  const rows = marks.slice(0, 25).map((mark, index) => {
    const labels = mark.labelIds
      .map((id) => labelsById.get(id)?.name)
      .filter(Boolean)
      .join(", ");
    const project = projectsById.get(mark.projectId)?.name ?? "Unknown project";
    const workflow = workflowStatusesById.get(mark.workflowStatusId)?.name ?? mark.status;
    const description = markDescriptionPlainText(mark.description);
    return [
      `### ${index + 1}. ${mark.displayKey}: ${mark.title}`,
      markdownList([
        `Project: ${project}`,
        `Page URL: ${valueOrNone(mark.page)}`,
        `Status: ${workflow}`,
        `Priority: ${mark.priority}`,
        `Labels: ${labels || "None"}`,
        `Selector: ${valueOrNone(mark.capture?.selector)}`,
      ]),
      description ? `Requested change: ${description}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  });

  const truncated =
    marks.length > 25
      ? `\n\n${marks.length - 25} additional marks were selected but omitted.`
      : "";

  return [
    promptAgentLine("codex"),
    "",
    "Use these selected YouIn marks as a focused UI work plan. Group related work where sensible, keep changes scoped, and preserve existing project patterns.",
    "",
    "## Selected Marks",
    rows.join("\n\n"),
    truncated,
    "",
    "## Output Expectations",
    markdownList([
      "Propose an implementation order before editing.",
      "Handle high-priority or blocking marks first.",
      "Mention any mark that needs more context before implementation.",
      "Run or suggest the narrowest useful verification command.",
    ]),
  ].join("\n");
}
