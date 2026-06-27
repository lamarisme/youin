import { relations, sql } from "drizzle-orm";
import { MARK_PRIORITIES, MARK_STATUSES } from "@youin/domain";
import type {
  WorkspaceViewConfig,
  WorkspaceViewFilters,
  WorkspaceViewIcon,
} from "@/lib/collab-types";
import {
  type AnyPgColumn,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("workspace_role", ["owner", "member"]);
export const markStatusEnum = pgEnum("mark_status", MARK_STATUSES);
export const markPriorityEnum = pgEnum("mark_priority", MARK_PRIORITIES);
export const markEventTypeEnum = pgEnum("mark_event_type", [
  "created",
  "status_changed",
  "priority_changed",
  "pinned_changed",
  "prompt_copied",
  "comment_added",
  "assignee_changed",
  "label_changed",
]);
export const markCommentTypeEnum = pgEnum("mark_comment_type", [
  "text",
  "image",
]);
export const workspaceViewLayoutEnum = pgEnum("workspace_view_layout", [
  "list",
  "board",
]);
export const workspaceInviteStatusEnum = pgEnum("workspace_invite_status", [
  "pending",
  "accepted",
  "revoked",
  "expired",
]);
export const workspaceInviteSourceEnum = pgEnum("workspace_invite_source", [
  "signup",
  "manual",
]);

/** Application profile; `id` matches the original `auth.users.id`, even after account deletion anonymizes the row. */
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey(),
    /** Mirror of auth email for member lists (updated from trigger/app). */
    email: text("email"),
    fullName: text("full_name"),
    currentWorkspaceId: uuid("current_workspace_id").references(
      (): AnyPgColumn => workspaces.id,
      { onDelete: "set null" },
    ),
    title: text("title").notNull().default(""),
    about: text("about").notNull().default(""),
    avatarUrl: text("avatar_url").notNull().default(""),
    timezone: text("timezone").notNull().default("UTC"),
    /** Viewer chooses either profile full names or workspace @usernames in UI — not both. @mentions always use usernames. */
    displayNamePreference: text("display_name_preference")
      .notNull()
      .default("full_name"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("profiles_current_workspace_id_idx").on(table.currentWorkspaceId),
    index("profiles_updated_at_idx").on(table.updatedAt),
  ],
);

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    nextMarkSeq: integer("next_mark_seq").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("workspaces_name_idx").on(table.name)],
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("projects_workspace_id_unique").on(
      table.workspaceId,
      table.id,
    ),
    uniqueIndex("projects_workspace_name_unique").on(
      table.workspaceId,
      table.name,
    ),
    index("projects_workspace_created_at_idx").on(
      table.workspaceId,
      table.createdAt,
    ),
  ],
);

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    /**
     * Handle unique within this workspace (case-insensitive in DB via unique expression index).
     * Lowercase `[a-z0-9_]`, 2–48 chars enforced in application layer.
     */
    username: text("username").notNull(),
    role: roleEnum("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.userId] }),
    index("workspace_members_user_workspace_idx").on(
      table.userId,
      table.workspaceId,
    ),
    uniqueIndex("workspace_members_workspace_username_lower").on(
      table.workspaceId,
      sql`lower(${table.username})`,
    ),
  ],
);

export const markWorkflowStatuses = pgTable(
  "mark_workflow_statuses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull().default("gray"),
    position: integer("position").notNull().default(0),
    lifecycleStatus: markStatusEnum("lifecycle_status")
      .notNull()
      .default("open"),
    isDefaultOpen: boolean("is_default_open").notNull().default(false),
    isDefaultClosed: boolean("is_default_closed").notNull().default(false),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("mark_workflow_statuses_workspace_id_unique").on(
      table.workspaceId,
      table.id,
    ),
    uniqueIndex("mark_workflow_statuses_workspace_active_name_unique")
      .on(table.workspaceId, sql`lower(${table.name})`)
      .where(sql`${table.archivedAt} IS NULL`),
    uniqueIndex("mark_workflow_statuses_default_open_unique")
      .on(table.workspaceId)
      .where(sql`${table.isDefaultOpen} = true AND ${table.archivedAt} IS NULL`),
    uniqueIndex("mark_workflow_statuses_default_closed_unique")
      .on(table.workspaceId)
      .where(sql`${table.isDefaultClosed} = true AND ${table.archivedAt} IS NULL`),
    index("mark_workflow_statuses_workspace_position_idx").on(
      table.workspaceId,
      table.position,
    ),
    check("mark_workflow_statuses_name_not_blank", sql`length(trim(${table.name})) > 0`),
    check(
      "mark_workflow_statuses_default_open_lifecycle",
      sql`${table.isDefaultOpen} = false OR ${table.lifecycleStatus} = 'open'`,
    ),
    check(
      "mark_workflow_statuses_default_closed_lifecycle",
      sql`${table.isDefaultClosed} = false OR ${table.lifecycleStatus} = 'closed'`,
    ),
  ],
);

export const marks = pgTable(
  "marks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
    title: text("title").notNull(),
    page: text("page").notNull(),
    description: text("description").notNull().default(""),
    status: markStatusEnum("status").notNull().default("open"),
    workflowStatusId: uuid("workflow_status_id").notNull(),
    priority: markPriorityEnum("priority").notNull().default("medium"),
    pinned: boolean("pinned").notNull().default(false),
    assigneeUserId: uuid("assignee_user_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    /**
     * Monotonic sequence number within the workspace (e.g. key YIN-{@link seq}).
     * Assigned by the `set_mark_seq` trigger; do not set from application code.
     */
    seq: integer("seq").notNull().default(0),
    legacyDisplayKey: text("legacy_display_key"),
    selector: text("selector"),
    viewport: text("viewport"),
    browser: text("browser"),
    os: text("os"),
    domSnapshot: jsonb("dom_snapshot").$type<Record<string, unknown> | null>(),
    screenshotUrl: text("screenshot_url"),
    capturedAt: timestamp("captured_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "no action" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("marks_workspace_seq_unique").on(table.workspaceId, table.seq),
    index("marks_project_status_priority_idx").on(
      table.projectId,
      table.status,
      table.priority,
    ),
    index("marks_workspace_project_idx").on(table.workspaceId, table.projectId),
    index("marks_workspace_pinned_idx").on(table.workspaceId, table.pinned),
    index("marks_workspace_created_at_idx").on(
      table.workspaceId,
      table.createdAt,
    ),
    index("marks_workspace_status_idx").on(table.workspaceId, table.status),
    index("marks_workspace_workflow_status_idx").on(
      table.workspaceId,
      table.workflowStatusId,
    ),
    index("marks_workspace_assignee_idx").on(
      table.workspaceId,
      table.assigneeUserId,
    ),
    foreignKey({
      columns: [table.workspaceId, table.workflowStatusId],
      foreignColumns: [
        markWorkflowStatuses.workspaceId,
        markWorkflowStatuses.id,
      ],
      name: "marks_workflow_status_workspace_fk",
    }),
    foreignKey({
      columns: [table.workspaceId, table.projectId],
      foreignColumns: [projects.workspaceId, projects.id],
      name: "marks_project_workspace_fk",
    }).onDelete("cascade"),
  ],
);

export const markLabels = pgTable(
  "mark_labels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("mark_labels_workspace_name_unique").on(
      table.workspaceId,
      table.name,
    ),
  ],
);

export const marksToLabels = pgTable(
  "marks_to_labels",
  {
    markId: uuid("mark_id")
      .notNull()
      .references(() => marks.id, { onDelete: "cascade" }),
    labelId: uuid("label_id")
      .notNull()
      .references(() => markLabels.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.markId, table.labelId] }),
    index("marks_to_labels_label_idx").on(table.labelId),
  ],
);

export const markComments = pgTable(
  "mark_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    markId: uuid("mark_id")
      .notNull()
      .references(() => marks.id, { onDelete: "cascade" }),
    authorUserId: uuid("author_user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "no action" }),
    type: markCommentTypeEnum("type").notNull().default("text"),
    body: text("body"),
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("mark_comments_mark_created_at_idx").on(
      table.markId,
      table.createdAt,
    ),
    index("mark_comments_author_idx").on(table.authorUserId),
    check(
      "mark_comments_body_or_image",
      sql`(${table.type} = 'text' AND ${table.body} IS NOT NULL)
          OR (${table.type} = 'image' AND ${table.imageUrl} IS NOT NULL)`,
    ),
  ],
);

export const markEvents = pgTable(
  "mark_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    markId: uuid("mark_id")
      .notNull()
      .references(() => marks.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "no action" }),
    type: markEventTypeEnum("type").notNull(),
    fromValue: text("from_value"),
    toValue: text("to_value"),
    metadata: jsonb("metadata").$type<Record<string, string | number | boolean | null>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("mark_events_mark_created_at_idx").on(table.markId, table.createdAt),
    index("mark_events_workspace_created_at_idx").on(table.workspaceId, table.createdAt),
    index("mark_events_workspace_type_idx").on(table.workspaceId, table.type),
  ],
);

export const mentions = pgTable(
  "mentions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /**
     * Generic source discriminator such as `mark_comment` or `mark_description`.
     * Kept as text so future collaboration surfaces can opt in without enum churn.
     */
    sourceType: text("source_type").notNull(),
    /** Stable id of the source record within `source_type`. */
    sourceId: uuid("source_id").notNull(),
    /**
     * Optional mark context for mark-scoped sources. This lets mark deletion cascade
     * current mentions while keeping the model open to non-mark collaboration surfaces.
     */
    markId: uuid("mark_id").references(() => marks.id, { onDelete: "cascade" }),
    mentionedUserId: uuid("mentioned_user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "no action" }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "no action" }),
    startIndex: integer("start_index").notNull(),
    endIndex: integer("end_index").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("mentions_source_occurrence_unique").on(
      table.workspaceId,
      table.sourceType,
      table.sourceId,
      table.mentionedUserId,
      table.startIndex,
      table.endIndex,
    ),
    index("mentions_source_idx").on(
      table.workspaceId,
      table.sourceType,
      table.sourceId,
    ),
    index("mentions_mentioned_user_created_at_idx").on(
      table.mentionedUserId,
      table.workspaceId,
      table.createdAt,
    ),
    index("mentions_created_by_user_created_at_idx").on(
      table.createdByUserId,
      table.workspaceId,
      table.createdAt,
    ),
    index("mentions_mark_idx").on(table.markId),
    check(
      "mentions_source_type_not_blank",
      sql`length(trim(${table.sourceType})) > 0`,
    ),
    check(
      "mentions_offsets_valid",
      sql`${table.startIndex} >= 0 AND ${table.endIndex} > ${table.startIndex}`,
    ),
  ],
);

export const inboxReadStates = pgTable(
  "inbox_read_states",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.userId] }),
    index("inbox_read_states_user_workspace_idx").on(
      table.userId,
      table.workspaceId,
    ),
  ],
);

export const workspaceViews = pgTable(
  "workspace_views",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    layout: workspaceViewLayoutEnum("layout").notNull(),
    icon: text("icon").$type<WorkspaceViewIcon | null>(),
    filters: jsonb("filters").$type<WorkspaceViewFilters>().notNull(),
    config: jsonb("config").$type<WorkspaceViewConfig>().notNull().default(sql`'{}'::jsonb`),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "no action" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("workspace_views_workspace_name_unique").on(
      table.workspaceId,
      table.name,
    ),
    index("workspace_views_workspace_created_at_idx").on(
      table.workspaceId,
      table.createdAt,
    ),
    index("workspace_views_workspace_layout_idx").on(
      table.workspaceId,
      table.layout,
    ),
  ],
);

export const workspaceInvites = pgTable(
  "workspace_invites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    invitedByUserId: uuid("invited_by_user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "no action" }),
    invitedAt: timestamp("invited_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** When the invite token stops being honored. Default 14 days from creation. */
    expiresAt: timestamp("expires_at", { withTimezone: true })
      .notNull()
      .default(sql`now() + interval '14 days'`),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    status: workspaceInviteStatusEnum("status").notNull().default("pending"),
    source: workspaceInviteSourceEnum("source").notNull().default("signup"),
    token: text("token").unique(),
    orderIndex: integer("order_index").notNull().default(0),
  },
  (table) => [
    index("workspace_invites_workspace_email_idx").on(
      table.workspaceId,
      table.email,
    ),
    index("workspace_invites_workspace_status_idx").on(
      table.workspaceId,
      table.status,
    ),
    index("workspace_invites_expires_at_idx").on(table.expiresAt),
    /** Only one pending invite per (workspace, email) — case-insensitive. */
    uniqueIndex("workspace_invites_pending_email_unique")
      .on(table.workspaceId, sql`lower(${table.email})`)
      .where(sql`${table.status} = 'pending'`),
  ],
);

export const workspaceReviewLinks = pgTable(
  "workspace_review_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
    name: text("name").notNull(),
    /** Allowed site origin for guest submissions, e.g. https://staging.example.com. */
    targetOrigin: text("target_origin").notNull(),
    /** Public high-entropy token used in the embedded script URL. */
    token: text("token").notNull().unique(),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "no action" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).default(
      sql`now() + interval '30 days'`,
    ),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (table) => [
    index("workspace_review_links_workspace_created_at_idx").on(
      table.workspaceId,
      table.createdAt,
    ),
    index("workspace_review_links_workspace_active_idx").on(
      table.workspaceId,
      table.revokedAt,
      table.expiresAt,
    ),
    foreignKey({
      columns: [table.workspaceId, table.projectId],
      foreignColumns: [projects.workspaceId, projects.id],
      name: "workspace_review_links_project_workspace_fk",
    }).onDelete("cascade"),
  ],
);

// ---------------------------------------------------------------------------
// Relations — for ergonomic `db.query.x.findMany({ with: ... })` joins.
// ---------------------------------------------------------------------------

export const profilesRelations = relations(profiles, ({ many }) => ({
  memberships: many(workspaceMembers),
  authoredComments: many(markComments),
  authoredEvents: many(markEvents),
  createdMentions: many(mentions, { relationName: "mentions_creator" }),
  mentionedIn: many(mentions, { relationName: "mentions_mentioned_user" }),
  inboxReadStates: many(inboxReadStates),
  createdViews: many(workspaceViews),
  assignedMarks: many(marks, { relationName: "marks_assignee" }),
  createdMarks: many(marks, { relationName: "marks_creator" }),
  sentInvites: many(workspaceInvites),
  createdReviewLinks: many(workspaceReviewLinks),
}));

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  members: many(workspaceMembers),
  projects: many(projects),
  views: many(workspaceViews),
  marks: many(marks),
  workflowStatuses: many(markWorkflowStatuses),
  labels: many(markLabels),
  events: many(markEvents),
  mentions: many(mentions),
  inboxReadStates: many(inboxReadStates),
  invites: many(workspaceInvites),
  reviewLinks: many(workspaceReviewLinks),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [projects.workspaceId],
    references: [workspaces.id],
  }),
  marks: many(marks),
}));

export const workspaceMembersRelations = relations(
  workspaceMembers,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [workspaceMembers.workspaceId],
      references: [workspaces.id],
    }),
    profile: one(profiles, {
      fields: [workspaceMembers.userId],
      references: [profiles.id],
    }),
  }),
);

export const markWorkflowStatusesRelations = relations(
  markWorkflowStatuses,
  ({ one, many }) => ({
    workspace: one(workspaces, {
      fields: [markWorkflowStatuses.workspaceId],
      references: [workspaces.id],
    }),
    marks: many(marks),
  }),
);

export const marksRelations = relations(marks, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [marks.workspaceId],
    references: [workspaces.id],
  }),
  project: one(projects, {
    fields: [marks.projectId],
    references: [projects.id],
  }),
  workflowStatus: one(markWorkflowStatuses, {
    fields: [marks.workflowStatusId],
    references: [markWorkflowStatuses.id],
  }),
  assignee: one(profiles, {
    fields: [marks.assigneeUserId],
    references: [profiles.id],
    relationName: "marks_assignee",
  }),
  creator: one(profiles, {
    fields: [marks.createdByUserId],
    references: [profiles.id],
    relationName: "marks_creator",
  }),
  comments: many(markComments),
  events: many(markEvents),
  mentions: many(mentions),
  labels: many(marksToLabels),
}));

export const markLabelsRelations = relations(markLabels, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [markLabels.workspaceId],
    references: [workspaces.id],
  }),
  marks: many(marksToLabels),
}));

export const marksToLabelsRelations = relations(marksToLabels, ({ one }) => ({
  mark: one(marks, {
    fields: [marksToLabels.markId],
    references: [marks.id],
  }),
  label: one(markLabels, {
    fields: [marksToLabels.labelId],
    references: [markLabels.id],
  }),
}));

export const markCommentsRelations = relations(markComments, ({ one }) => ({
  mark: one(marks, {
    fields: [markComments.markId],
    references: [marks.id],
  }),
  author: one(profiles, {
    fields: [markComments.authorUserId],
    references: [profiles.id],
  }),
}));

export const markEventsRelations = relations(markEvents, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [markEvents.workspaceId],
    references: [workspaces.id],
  }),
  mark: one(marks, {
    fields: [markEvents.markId],
    references: [marks.id],
  }),
  actor: one(profiles, {
    fields: [markEvents.actorUserId],
    references: [profiles.id],
  }),
}));

export const mentionsRelations = relations(mentions, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [mentions.workspaceId],
    references: [workspaces.id],
  }),
  mark: one(marks, {
    fields: [mentions.markId],
    references: [marks.id],
  }),
  mentionedUser: one(profiles, {
    fields: [mentions.mentionedUserId],
    references: [profiles.id],
    relationName: "mentions_mentioned_user",
  }),
  creator: one(profiles, {
    fields: [mentions.createdByUserId],
    references: [profiles.id],
    relationName: "mentions_creator",
  }),
}));

export const inboxReadStatesRelations = relations(inboxReadStates, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [inboxReadStates.workspaceId],
    references: [workspaces.id],
  }),
  user: one(profiles, {
    fields: [inboxReadStates.userId],
    references: [profiles.id],
  }),
}));

export const workspaceViewsRelations = relations(workspaceViews, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceViews.workspaceId],
    references: [workspaces.id],
  }),
  creator: one(profiles, {
    fields: [workspaceViews.createdByUserId],
    references: [profiles.id],
  }),
}));

export const workspaceInvitesRelations = relations(
  workspaceInvites,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [workspaceInvites.workspaceId],
      references: [workspaces.id],
    }),
    invitedBy: one(profiles, {
      fields: [workspaceInvites.invitedByUserId],
      references: [profiles.id],
    }),
  }),
);

export const workspaceReviewLinksRelations = relations(
  workspaceReviewLinks,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [workspaceReviewLinks.workspaceId],
      references: [workspaces.id],
    }),
    project: one(projects, {
      fields: [workspaceReviewLinks.projectId],
      references: [projects.id],
    }),
    createdBy: one(profiles, {
      fields: [workspaceReviewLinks.createdByUserId],
      references: [profiles.id],
    }),
  }),
);

export type Profile = typeof profiles.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type Mark = typeof marks.$inferSelect;
export type NewMark = typeof marks.$inferInsert;
export type MarkWorkflowStatus = typeof markWorkflowStatuses.$inferSelect;
export type MarkLabel = typeof markLabels.$inferSelect;
export type MarkComment = typeof markComments.$inferSelect;
export type MarkEvent = typeof markEvents.$inferSelect;
export type Mention = typeof mentions.$inferSelect;
export type InboxReadState = typeof inboxReadStates.$inferSelect;
export type WorkspaceView = typeof workspaceViews.$inferSelect;
export type WorkspaceInvite = typeof workspaceInvites.$inferSelect;
export type WorkspaceReviewLink = typeof workspaceReviewLinks.$inferSelect;
