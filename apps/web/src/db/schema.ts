import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
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
export const markStatusEnum = pgEnum("mark_status", ["open", "closed"]);
export const markPriorityEnum = pgEnum("mark_priority", [
  "low",
  "medium",
  "high",
  "critical",
]);
export const markEventTypeEnum = pgEnum("mark_event_type", [
  "created",
  "status_changed",
  "priority_changed",
  "pinned_changed",
  "linear_link_updated",
  "comment_added",
  "assignee_changed",
  "label_changed",
]);
export const markCommentTypeEnum = pgEnum("mark_comment_type", [
  "text",
  "image",
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

/** Application profile; `id` matches `auth.users.id` (`profiles_user_id_fkey` in Supabase extensions SQL). */
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey(),
    /** Mirror of auth email for member lists (updated from trigger/app). */
    email: text("email"),
    fullName: text("full_name"),
    title: text("title").notNull().default(""),
    about: text("about").notNull().default(""),
    avatarUrl: text("avatar_url").notNull().default(""),
    timezone: text("timezone").notNull().default("UTC"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("profiles_updated_at_idx").on(table.updatedAt)],
);

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("workspaces_name_idx").on(table.name)],
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

export const spaces = pgTable(
  "spaces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** Short uppercase key for mark display ids (e.g. WEB-42), unique per workspace. */
    code: text("code").notNull(),
    /**
     * Running counter for mark numbers in this space. Maintained by the
     * `set_mark_seq` trigger on `marks` (BEFORE INSERT OR UPDATE OF space_id).
     */
    nextMarkSeq: integer("next_mark_seq").notNull().default(0),
    name: text("name").notNull(),
    notes: text("notes").notNull().default(""),
    priority: markPriorityEnum("priority").notNull().default("medium"),
    pinned: boolean("pinned").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("spaces_workspace_code_unique").on(table.workspaceId, table.code),
    uniqueIndex("spaces_workspace_name_unique").on(
      table.workspaceId,
      table.name,
    ),
    index("spaces_workspace_priority_idx").on(
      table.workspaceId,
      table.priority,
    ),
    index("spaces_workspace_pinned_idx").on(table.workspaceId, table.pinned),
    check("spaces_code_format", sql`${table.code} ~ '^[A-Z0-9]{1,12}$'`),
  ],
);

export const marks = pgTable(
  "marks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    page: text("page").notNull(),
    description: text("description").notNull().default(""),
    status: markStatusEnum("status").notNull().default("open"),
    priority: markPriorityEnum("priority").notNull().default("medium"),
    pinned: boolean("pinned").notNull().default(false),
    assigneeUserId: uuid("assignee_user_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    /**
     * Monotonic sequence number within {@link spaceId} (e.g. key WEB-{@link seq}).
     * Assigned by the `set_mark_seq` trigger; do not set from application code.
     */
    seq: integer("seq").notNull().default(0),
    selector: text("selector"),
    viewport: text("viewport"),
    browser: text("browser"),
    os: text("os"),
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
    uniqueIndex("marks_space_seq_unique").on(table.spaceId, table.seq),
    index("marks_space_status_priority_idx").on(
      table.spaceId,
      table.status,
      table.priority,
    ),
    index("marks_workspace_pinned_idx").on(table.workspaceId, table.pinned),
    index("marks_workspace_created_at_idx").on(
      table.workspaceId,
      table.createdAt,
    ),
    index("marks_workspace_status_idx").on(table.workspaceId, table.status),
    index("marks_workspace_assignee_idx").on(
      table.workspaceId,
      table.assigneeUserId,
    ),
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

// ---------------------------------------------------------------------------
// Relations — for ergonomic `db.query.x.findMany({ with: ... })` joins.
// ---------------------------------------------------------------------------

export const profilesRelations = relations(profiles, ({ many }) => ({
  memberships: many(workspaceMembers),
  authoredComments: many(markComments),
  authoredEvents: many(markEvents),
  assignedMarks: many(marks, { relationName: "marks_assignee" }),
  createdMarks: many(marks, { relationName: "marks_creator" }),
  sentInvites: many(workspaceInvites),
}));

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  members: many(workspaceMembers),
  spaces: many(spaces),
  marks: many(marks),
  labels: many(markLabels),
  events: many(markEvents),
  invites: many(workspaceInvites),
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

export const spacesRelations = relations(spaces, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [spaces.workspaceId],
    references: [workspaces.id],
  }),
  marks: many(marks),
}));

export const marksRelations = relations(marks, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [marks.workspaceId],
    references: [workspaces.id],
  }),
  space: one(spaces, {
    fields: [marks.spaceId],
    references: [spaces.id],
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

export type Profile = typeof profiles.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type Space = typeof spaces.$inferSelect;
export type Mark = typeof marks.$inferSelect;
export type NewMark = typeof marks.$inferInsert;
export type MarkLabel = typeof markLabels.$inferSelect;
export type MarkComment = typeof markComments.$inferSelect;
export type MarkEvent = typeof markEvents.$inferSelect;
export type WorkspaceInvite = typeof workspaceInvites.$inferSelect;
