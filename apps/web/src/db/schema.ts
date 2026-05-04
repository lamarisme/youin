import {
  boolean,
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
  "tag_changed",
]);

/** Application profile; `id` matches `auth.users.id` (enforced in Postgres / Supabase migration). */
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey(),
    /** Mirror of auth email for member lists (updated from trigger/app). */
    email: text("email"),
    fullName: text("full_name"),
    title: text("title").notNull().default(""),
    bio: text("bio").notNull().default(""),
    avatarUrl: text("avatar_url").notNull().default(""),
    timezone: text("timezone").notNull().default("UTC"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
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
    userId: uuid("user_id").notNull(),
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
  ],
);

export const spaces = pgTable(
  "spaces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
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
    uniqueIndex("spaces_workspace_name_unique").on(
      table.workspaceId,
      table.name,
    ),
    index("spaces_workspace_priority_idx").on(
      table.workspaceId,
      table.priority,
    ),
    index("spaces_workspace_pinned_idx").on(table.workspaceId, table.pinned),
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
    linearUrl: text("linear_url"),
    assigneeUserId: uuid("assignee_user_id"),
    selector: text("selector"),
    viewport: text("viewport"),
    browser: text("browser"),
    os: text("os"),
    screenshotUrl: text("screenshot_url"),
    capturedAt: timestamp("captured_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
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
  ],
);

export const markTags = pgTable(
  "mark_tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("mark_tags_workspace_label_unique").on(
      table.workspaceId,
      table.label,
    ),
  ],
);

export const marksToTags = pgTable(
  "marks_to_tags",
  {
    markId: uuid("mark_id")
      .notNull()
      .references(() => marks.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => markTags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.markId, table.tagId] })],
);

export const markComments = pgTable(
  "mark_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    markId: uuid("mark_id")
      .notNull()
      .references(() => marks.id, { onDelete: "cascade" }),
    authorUserId: uuid("author_user_id").notNull(),
    type: text("type").notNull().default("text"),
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
    actorUserId: uuid("actor_user_id").notNull(),
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
    invitedByUserId: uuid("invited_by_user_id").notNull(),
    invitedAt: timestamp("invited_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    status: text("status").notNull().default("pending"),
    source: text("source").notNull().default("signup"),
    orderIndex: integer("order_index").notNull().default(0),
  },
  (table) => [
    index("workspace_invites_workspace_email_idx").on(
      table.workspaceId,
      table.email,
    ),
  ],
);

export type Profile = typeof profiles.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
export type Space = typeof spaces.$inferSelect;
export type Mark = typeof marks.$inferSelect;
export type MarkComment = typeof markComments.$inferSelect;
export type MarkEvent = typeof markEvents.$inferSelect;
