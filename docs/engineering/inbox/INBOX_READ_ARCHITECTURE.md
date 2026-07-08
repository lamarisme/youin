# Inbox Read Architecture

**Status:** Historical architecture record

**Product source of truth:** `docs/engineering/inbox/READ_UNREAD_BEHAVIOR.md`

This document records the canonical Inbox Read architecture decision and the migration reasoning that led to the current implementation.

For current runtime behavior, read this document together with:

- `READ_UNREAD_BEHAVIOR.md`
- `INBOX_GROUPING_V2_ARCHITECTURE.md`

Sections that describe "Current Architecture" reflect the pre-migration system at the time this architecture was written. They are retained for context and should not be treated as the current runtime source of truth.

---

# Current Architecture

## Activity generation

The current Inbox is a derived read model. It does not have a canonical Inbox activity table.

The active server projection is in `apps/web/src/lib/workspace/inbox-query.ts`:

1. `loadInboxSnapshotForWorkspace()` loads the viewer's `inbox_read_states.lastReadAt`.
2. It finds marks relevant to the viewer:
   - marks assigned to the viewer via `marks.assigneeUserId`.
   - marks where the viewer has authored at least one `mark_comments` row.
3. It loads `mark_events` for those relevant marks, excluding events where `mark_events.actorUserId` is the viewer.
4. It loads mention facts for the viewer from `mentions`.
5. It normalizes both sources into `InboxActivity`.
6. It sorts, groups by mark, and calculates unread state.

The normalized model is defined in `apps/web/src/lib/workspace/inbox-model.ts`:

- `InboxActivity`
- `InboxEvent`
- `InboxGroup`
- `InboxSnapshot`

Current collaboration sources are:

- `mark_event`
- `mention`

Current Inbox activity types are:

- all `MarkEventType` values from `apps/web/src/lib/collab-types.ts`
- `mention`

Current `MarkEventType` values are:

- `created`
- `status_changed`
- `priority_changed`
- `pinned_changed`
- `prompt_copied`
- `comment_added`
- `assignee_changed`
- `label_changed`

`mark_events` are created in multiple ways:

- Database triggers in the Drizzle migrations log mark creation, lifecycle status changes, priority changes, pinned changes, assignee changes, and comment additions.
- `setMarkLabelsAction()` in `apps/web/src/lib/workspace/actions/marks.ts` manually inserts `label_changed` events because labels live in `marks_to_labels`.
- `logMarkPromptCopyAction()` in `apps/web/src/lib/workspace/actions/prompt-copy.ts` manually inserts `prompt_copied` events.

Mentions are stored separately from `mark_events`.

`apps/web/src/lib/workspace/mentions.ts` defines:

- `MARK_COMMENT_MENTION_SOURCE = "mark_comment"`
- `MARK_DESCRIPTION_MENTION_SOURCE = "mark_description"`
- `syncMentionsForSource()`
- `deleteMentionsForSource()`

Comment mention rows are synchronized by:

- `addMarkCommentsAction()`
- `updateMarkCommentAction()`
- `deleteMarkCommentAction()`

Description mention rows are synchronized by:

- `createMarkAction()`
- `updateMarkFieldsAction()`

## Unread calculation

Unread state is calculated from one timestamp per workspace/user.

`apps/web/src/lib/workspace/inbox-query.ts` uses:

```ts
lastReadAt === "" ? true : activity.createdAt > lastReadAt;
```

The same rule is applied to mark events and mention activities after they are normalized into `InboxActivity`.

The output snapshot contains:

- `groups`
- `totalEvents`
- `unreadCount`
- `lastReadAt`

Each event in the returned snapshot has an `unread` boolean, but that boolean is derived from the global timestamp.

## Read storage

Read state is stored in `inbox_read_states`.

The table is defined in `apps/web/src/db/schema.ts` with:

- `workspaceId`
- `userId`
- `lastReadAt`
- `updatedAt`

The primary key is `(workspace_id, user_id)`.

The only normal read-state write path is `markInboxReadAction()` in `apps/web/src/lib/workspace/actions/inbox.ts`. It upserts the current time into `inbox_read_states.lastReadAt`.

`apps/web/src/app/(workspace)/inbox/use-inbox.ts` calls `markInboxReadAction()` only from `markAllRead()`. The hook also performs an optimistic React Query update that marks every event in the current `InboxSnapshot` as read.

## React Query and realtime

The Inbox page uses `useInbox()` in `apps/web/src/app/(workspace)/inbox/use-inbox.ts`.

The query key is:

```ts
workspaceKeys.inbox(workspaceId, userId);
```

The query function is `getInboxAction()`, which calls the server-side Inbox snapshot loader.

The workspace shell also embeds an Inbox snapshot. `loadWorkspaceShellBootstrap()` in `apps/web/src/lib/workspace/read-models.ts` calls `loadInboxSnapshotForWorkspace()` and stores:

- `inboxSnapshot`
- `inboxLastReadAt`

The app sidebar and command palette read the unread count from workspace data.

Realtime invalidation is handled by `apps/web/src/components/providers/workspace-realtime-provider.tsx`.

The provider subscribes to workspace-scoped changes for:

- `projects`
- `mark_events`
- `mark_labels`
- `mark_workflow_statuses`
- `marks`
- `workspace_invites`
- `workspace_members`
- `workspace_review_links`
- `workspace_views`
- `inbox_read_states`

For `inbox_read_states`, it invalidates only `workspaceKeys.inbox(workspaceId, userId)`.

For the other subscribed workspace tables, it invalidates `workspaceKeys.all`.

The provider does not subscribe to `mentions`. `mentions` are also not included in `apps/web/drizzle/0024_realtime_workspace_publication.sql`.

## Inbox UI and navigation

`apps/web/src/app/(workspace)/inbox/inbox-view.tsx` renders Inbox groups. Each row links to the top event in the group.

For most events, `inboxEventHref()` links to the related Mark:

```ts
markHref(group.markDisplayKey, new URLSearchParams());
```

For comment mentions, it appends a hash:

```ts
#comment-${event.contextId}
```

Dashboard mark routes are rendered through:

- `apps/web/src/app/(workspace)/dashboard/dashboard-page.tsx`
- `apps/web/src/components/dashboard/workspace-dashboard.tsx`
- `apps/web/src/components/dashboard/mark-detail-view.tsx`

`MarkDetailView` loads comments and events for the selected mark from workspace data. It does not call any Inbox read mutation.

There is currently no dashboard code that handles `location.hash`, `hashchange`, `#comment-*`, or an IntersectionObserver for comments or mentions. The rendered comment item in `apps/web/src/components/dashboard/comment-thread.tsx` does not expose an element id matching `comment-${comment.id}`.

## Current limitations

- Read state is global per workspace/user, not per activity.
- Reading one activity cannot be represented independently of other activities.
- "Mark all read" is the only normal read-state mutation.
- Opening a Mark does not currently acknowledge any Inbox activity as read.
- Opening a comment mention URL appends a hash, but no current code verifies that the mentioned content became visible.
- Mention activities are derived from current `mentions` rows; editing or deleting mention text can remove the source row, so mention Inbox activity is not immutable.
- Mark-event activities are derived from `mark_events`; display data is joined from current mark/member data at read time.
- Current Inbox grouping is mark-based, so every activity must resolve to a mark.
- `mentions` changes do not have a direct realtime invalidation path.
- Pending workspace invites are shown in the Inbox UI as separate cards, not as `InboxActivity` records with read state.
- Review links are not represented as Inbox activities.
- Custom workflow status changes within the same lifecycle are not represented as a distinct Inbox activity; the current mark trigger logs lifecycle `status_changed`.
- `prompt_copied` is a current `mark_event_type`, but the product read behavior document does not define a required context for it.

---

# Product Requirements

The product source document defines the following behavior.

Unread means an activity still requires the user's attention.

Read means the user has successfully viewed the context related to the activity.

Each Inbox activity represents a single immutable event. A new event creates a new Inbox activity. Updating a Mark must not replace or modify previously created Inbox activities.

Read state is activity-based. Reading one activity must never automatically mark other activities as read.

Context determines read state. An activity becomes read only after the user has successfully viewed the required context for that activity.

Required contexts from the product document:

| Activity        | Required Context       |
| --------------- | ---------------------- |
| Assignment      | The related Mark       |
| Mention         | The mentioned content  |
| Comment         | The related comment    |
| Workflow Change | The related Mark       |
| Status Change   | The related Mark       |
| Priority Change | The related Mark       |
| Label Change    | The related Mark       |
| Review Link     | The related Review     |
| Invite          | The invitation details |

Read state should be automatic after the required context has been viewed.

"Mark all read" remains a convenience action and marks every currently unread activity as read.

An activity must remain unread when the required context has not actually been viewed, including cases where:

- the user opens a Mark without reaching the mentioned content.
- the user opens a page before required content has finished loading.
- the user leaves before the required context becomes visible.

The only product-approved read triggers are:

- Context Viewed
- Mark All Read

---

# Gap Analysis

## Global timestamp vs activity-based read state

Current implementation:

- `inbox_read_states.lastReadAt` stores one timestamp per workspace/user.
- Every activity with `createdAt <= lastReadAt` is read.

Product requirement:

- Every activity has independent read state.
- Reading one activity must not mark other activities read.

Gap:

- The current data model cannot represent independent read state for multiple activities on the same mark or across different marks.

## Manual read action vs automatic context viewed

Current implementation:

- `markInboxReadAction()` is only called by "Mark all read".
- Dashboard navigation and Mark detail rendering do not acknowledge activity context.

Product requirement:

- Activities become read automatically after required context is viewed.

Gap:

- There is no automatic read acknowledgement path.

## Mark viewed context

Current implementation:

- Opening a dashboard Mark page loads Mark detail data.
- No read-state mutation runs after the Mark is loaded or displayed.

Product requirement:

- Assignment, workflow change, status change, priority change, and label change require the related Mark.

Gap:

- The current Mark detail route has no "Mark context viewed" read trigger.

## Mention and comment viewed context

Current implementation:

- Comment mention Inbox links append `#comment-<commentId>`.
- No dashboard code consumes the hash.
- Comment rows do not currently expose matching `comment-<commentId>` element ids.
- No viewport visibility check exists for comments or mentions.

Product requirement:

- Mention requires the mentioned content.
- Comment requires the related comment.
- Opening a Mark without reaching the mentioned content must not mark a Mention as read.

Gap:

- The current runtime cannot distinguish "Mark opened" from "specific comment or mention was actually viewed".

## Immutable activities

Current implementation:

- `mark_events` are append-only event facts.
- `mentions` are synchronized current-state rows. `syncMentionsForSource()` deletes removed mention occurrences and inserts new ones.
- Inbox activities are re-derived on each query.

Product requirement:

- Each activity is immutable once created.

Gap:

- Mention Inbox activity identity is based on a mutable current-state mention row.
- There is no durable Inbox activity row preserving a mention activity after the source mention is edited away.

## Activity coverage

Current implementation:

- Mark event activity types are driven by `mark_event_type`.
- Mentions are projected separately.
- Invites are rendered as separate Inbox cards.
- Review links are not Inbox activities.
- Workflow status changes within the same lifecycle are not represented as their own Inbox activity.
- `prompt_copied` exists in the current event enum but has no product-defined required context.

Product requirement:

- Assignment, Mention, Comment, Workflow Change, Status Change, Priority Change, Label Change, Review Link, and Invite have required contexts.

Gap:

- Current activity coverage does not match the product activity list.
- Some current events need product mapping or exclusion before read behavior can be complete.

## Realtime and cache coherence

Current implementation:

- `mark_events` and `inbox_read_states` can invalidate client state through realtime.
- `mentions` do not have a direct realtime subscription path.
- The sidebar badge can be sourced from workspace shell data, while the Inbox page has its own `workspaceKeys.inbox()` query.

Product requirement:

- The Inbox should reflect actual attention state consistently.

Gap:

- The current cache and realtime shape can leave mention changes dependent on broader refetches rather than direct Inbox invalidation.
- A future per-activity read model needs explicit invalidation for both activity creation and read acknowledgement.

---

# Architecture Goals

The target architecture should:

- Preserve the product definition that read state belongs to individual activities, not to a workspace-level timestamp.
- Keep activity identity durable and immutable after creation.
- Separate immutable activity facts from mutable read acknowledgements.
- Support automatic read transitions only after the required context is actually visible.
- Keep "Mark all read" as a bulk convenience action over the same per-activity read model.
- Support current activity sources while leaving room for Invite and Review Link activities.
- Provide a clear cache and realtime invalidation path for both new activities and read-state changes.
- Allow incremental migration from the current derived Inbox without a large rewrite.

---

# Proposed Architecture

## Principles

The proposed architecture separates four responsibilities:

1. Activity creation
2. Required context definition
3. Context-viewed acknowledgement
4. Inbox projection and unread counting

The core design should treat Inbox activity identity as durable, while allowing display data to be enriched from current workspace state when appropriate.

## Canonical activity layer

Introduce a canonical Inbox activity layer.

Recommended shape:

- `inbox_activities`
- `inbox_activity_read_states`

`inbox_activities` should be append-only for activity facts. A row represents one event for one recipient.

Suggested responsibilities:

- Store stable activity identity.
- Store workspace and recipient.
- Store activity type.
- Store source identity.
- Store actor identity.
- Store required context type and id.
- Store enough immutable payload to explain what happened even if source display data changes later.
- Store creation time for ordering.

Example conceptual fields:

- `id`
- `workspace_id`
- `recipient_user_id`
- `activity_type`
- `source_type`
- `source_id`
- `source_event_id`
- `actor_user_id`
- `subject_type`
- `subject_id`
- `mark_id`
- `required_context_type`
- `required_context_id`
- `created_at`
- `payload`

`inbox_activity_read_states` should store mutable read state separately from immutable activity facts.

Example conceptual fields:

- `activity_id`
- `workspace_id`
- `user_id`
- `read_at`
- `read_trigger`
- `context_viewed_at`
- `created_at`
- `updated_at`

The read-state table should be idempotent. A repeated context-viewed acknowledgement for the same activity should not create duplicate rows or move state backwards.

## Activity producers

Activity producers are responsible for creating durable `inbox_activities`.

Initial producers can be built from current facts:

- Mark-event projector: converts `mark_events` into recipient-specific Inbox activities.
- Mention producer: converts newly created mention occurrences into recipient-specific Inbox activities.
- Invite producer: converts pending invitation facts into Invite activities.
- Review-link producer: creates Review Link activities when product defines the recipient and trigger.

The mark-event projector should preserve current recipient behavior until product changes it:

- assigned marks.
- marks the user has commented on.
- excluding events authored by the recipient.

This preserves current audience semantics while moving read state to a product-compatible model.

## Required context contract

Each activity must carry a required context contract.

Examples from the product document:

| Activity               | Required context type                     | Required context id                     |
| ---------------------- | ----------------------------------------- | --------------------------------------- |
| Assignment             | `mark`                                    | `mark_id`                               |
| Mention in comment     | `mention_occurrence` or `comment_mention` | activity-specific mention occurrence id |
| Mention in description | `description_mention`                     | activity-specific mention occurrence id |
| Comment                | `comment`                                 | `comment_id`                            |
| Workflow Change        | `mark`                                    | `mark_id`                               |
| Status Change          | `mark`                                    | `mark_id`                               |
| Priority Change        | `mark`                                    | `mark_id`                               |
| Label Change           | `mark`                                    | `mark_id`                               |
| Review Link            | `review`                                  | review id                               |
| Invite                 | `invite`                                  | invite id                               |

The exact enum names are engineering details, but the contract must be explicit enough for the client to know what visible context can acknowledge the activity.

## Context viewed acknowledgements

Introduce a server action or route handler such as `markInboxActivitiesViewedAction()`.

Responsibilities:

- Accept one or more candidate activity ids.
- Validate that the current user is the activity recipient.
- Validate that the activity belongs to the current workspace.
- Validate that the supplied viewed context matches the activity's required context.
- Upsert read-state rows.
- Return updated read state or an updated unread count.

The client should call this only after the required context is known to be visible.

Context detection responsibilities:

- Mark context: the Mark detail route has loaded the selected Mark and the main Mark detail area is mounted.
- Comment context: the target comment row exists and has become visible in the viewport.
- Mention context: the exact mentioned content has become visible. If the implementation cannot detect a precise mention range, it should not mark the Mention read until the chosen engineering definition of "mentioned content visible" is satisfied.
- Invite context: the invitation details are visible.
- Review context: the related review details are visible.

The product document explicitly says opening a page before content has finished loading must not mark read. For that reason, acknowledgement should be tied to rendered context, not route start.

## Inbox projection

`loadInboxSnapshotForWorkspace()` should eventually read from canonical Inbox activities rather than re-deriving identity from `mark_events` and `mentions`.

The projection should:

1. Load activities for `(workspace_id, recipient_user_id)`.
2. Join read state for the same user.
3. Enrich display data from current mark/member/project/comment data where needed.
4. Preserve immutable event payload when current source data is missing or changed.
5. Group activities for UI presentation.
6. Calculate unread from missing read state, not from a global timestamp.

Unread rule in the proposed model:

```txt
activity is unread when no read-state row exists for that activity/user
```

or, if a nullable row model is used:

```txt
activity is unread when read_at is null
```

## React Query and realtime responsibilities

React Query should keep a dedicated Inbox query as the source of truth for Inbox rows and unread count.

Recommended keys:

- `workspaceKeys.inbox(workspaceId, userId)` for the full snapshot.
- Optional future key for lightweight unread count if needed.

Realtime should invalidate Inbox data when any of these change:

- `inbox_activities` for the current workspace and recipient.
- `inbox_activity_read_states` for the current workspace and user.

The sidebar badge should read from the same current Inbox snapshot or a dedicated unread-count query, rather than relying only on workspace shell bootstrap data.

## Navigation responsibilities

Inbox row links should carry enough context for the destination route to locate the activity.

Possible route data:

- destination path for the required context.
- activity id.
- required context type.
- required context id.

For comment and mention contexts, the route should target a stable element or logical context id. The dashboard should then acknowledge read state only after that target is rendered and visible.

---

# Data Model Options

## Option 1: Global timestamp

This is the current model.

Storage:

- `inbox_read_states.lastReadAt`

Pros:

- Small schema.
- Cheap read and write path.
- Easy "Mark all read".
- Already implemented.

Cons:

- Cannot support per-activity read state.
- Reading one activity marks unrelated older activities as read.
- Cannot satisfy product rule that multiple activities on the same Mark remain independent.
- Cannot support activity-specific context viewed triggers.

Assessment:

- Not sufficient for the product behavior.

## Option 2: Per-activity read state over derived activities

Storage:

- Keep deriving activities from `mark_events` and `mentions`.
- Add read-state rows keyed by source identity, such as `(workspace_id, user_id, source_type, source_id)`.

Pros:

- Smaller migration than a full activity table.
- Keeps current source loaders.
- Supports independent read state for existing mark events and current mentions.
- Can implement "Mark all read" by inserting read-state rows for the currently derived unread set.

Cons:

- Derived mention activities remain mutable because `mentions` rows can be deleted or replaced.
- Missing source rows can make historical activities disappear.
- Required context and recipient resolution remain spread across source-specific code.
- Harder to support Invite and Review Link consistently.
- Harder to preserve immutable activity payload.

Assessment:

- Useful as an incremental bridge, but not the best target architecture.

## Option 3: Inbox activity table with read state on the activity row

Storage:

- `inbox_activities` with one row per recipient activity.
- `read_at` fields on the same row.

Pros:

- Simple query shape.
- Activity identity is durable.
- Read state is independent per recipient activity.
- Efficient unread count.

Cons:

- Mutates the activity row to mark read.
- Mixes immutable activity facts with mutable read state.
- If future activity rows ever need multiple recipients in one row, the model becomes awkward.

Assessment:

- Viable if activities are permanently recipient-specific, but weaker separation of concerns.

## Option 4: Inbox activity table plus read-state table

Storage:

- `inbox_activities` stores immutable activity facts.
- `inbox_activity_read_states` stores mutable read acknowledgements.

Pros:

- Matches product activity identity.
- Supports independent read state.
- Keeps activity facts immutable.
- Supports automatic context-viewed acknowledgements.
- Supports "Mark all read" as a bulk read-state operation.
- Supports future activity sources such as invites and review links.
- Allows activity display fallback when source data changes.

Cons:

- More schema and query complexity.
- Requires activity producers or projectors.
- Requires backfill and deduplication strategy.
- Requires careful RLS and realtime configuration.

Assessment:

- Recommended target architecture.

## Recommendation

Use Option 4: canonical `inbox_activities` plus `inbox_activity_read_states`.

This is the only option that cleanly satisfies:

- immutable activity identity.
- per-activity read state.
- automatic context-based read triggers.
- independent activities on the same Mark.
- future Invite and Review Link activity support.

Option 2 can be used as an incremental migration step if the team wants to ship per-activity read state before completing the full activity table.

---

# Migration Strategy

## Phase 1: Add canonical tables behind existing behavior

Add new tables without changing UI behavior:

- `inbox_activities`
- `inbox_activity_read_states`

Add RLS policies scoped to workspace membership and recipient ownership.

Add indexes for:

- `(workspace_id, recipient_user_id, created_at)`
- unread lookup by `(workspace_id, recipient_user_id)`
- source deduplication by `(workspace_id, recipient_user_id, source_type, source_id)`
- required context lookup by `(workspace_id, recipient_user_id, required_context_type, required_context_id)`

Keep `inbox_read_states` in place during migration.

## Phase 2: Backfill current activity sources

Backfill durable activities from existing `mark_events` using current recipient rules.

Backfill current mention activities from existing `mentions` rows.

Known limitation:

- Existing deleted or edited-away mentions cannot be reconstructed from `mentions`, because the current table stores current mention facts, not historical mention activity.

Use deterministic source keys to avoid duplicate activity rows during repeated backfills.

## Phase 3: Dual-write new activities

When new source events are created, also create `inbox_activities`.

Initial dual-write points:

- mark-event creation/projector path.
- mention synchronization when a mention occurrence is newly created.
- invitation discovery or invite creation path, once Invite activity ownership is defined.
- review link path, once Review Link recipients are defined.

During this phase, the existing Inbox query can continue to serve UI while the new activity table is validated.

## Phase 4: Switch Inbox reads to canonical activities

Change `loadInboxSnapshotForWorkspace()` to read from `inbox_activities` and join `inbox_activity_read_states`.

Keep display enrichment from current mark/member/project/comment tables, but fall back to immutable activity payload when current source rows are unavailable.

Keep the old derived loader available temporarily as a comparison path or fallback during rollout.

## Phase 5: Move "Mark all read" to per-activity state

Change `markInboxReadAction()` or replace it with a new action that inserts read-state rows for every currently unread activity visible to the user.

During migration, optionally continue updating `inbox_read_states.lastReadAt` for compatibility with any remaining legacy readers.

## Phase 6: Add automatic context-viewed acknowledgements

Add context-viewed read acknowledgement in stages:

1. Mark context for Assignment, Workflow Change, Status Change, Priority Change, and Label Change.
2. Comment context for Comment activities.
3. Mention context for Mention activities.
4. Invite context for Invite activities.
5. Review context for Review Link activities.

Each stage should use rendered-context signals, not route-start signals.

## Phase 7: Update realtime and cache ownership

Add the new Inbox tables to Supabase realtime publication if realtime delivery is required.

Update `WorkspaceRealtimeProvider` to invalidate `workspaceKeys.inbox(workspaceId, userId)` when:

- a new activity is created for the current user.
- a read state changes for the current user.

Ensure sidebar and command palette unread counts use the same Inbox source.

## Phase 8: Deprecate global timestamp

After all Inbox readers use per-activity state:

- stop writing `inbox_read_states.lastReadAt`.
- remove legacy timestamp-based unread logic.
- keep or drop the old table according to migration and rollback requirements.

---

# Risks

- Backfilling recipients from historical `mark_events` may not perfectly reconstruct the audience that existed when the event occurred.
- Existing `mentions` cannot backfill deleted historical mention activities.
- Dual-writing from multiple producers can create duplicate Inbox activities without strong source uniqueness constraints.
- Context-viewed detection can produce false positives if it acknowledges before content is truly visible.
- Context-viewed detection can produce false negatives if virtualized or collapsed UI prevents visibility signals.
- Separating immutable payload from live display enrichment requires clear rules for deleted marks, deleted comments, renamed projects, and changed user names.
- Realtime invalidation for recipient-specific activities needs careful filtering to avoid leaking activity existence across users.
- Bulk "Mark all read" can become expensive for users with large unread sets unless batched or query-driven.
- RLS policies for activity and read-state tables must protect recipient-specific rows.
- Current optimistic workspace mutation invalidation uses broad `workspaceKeys.all`; new Inbox-specific mutations must not accidentally over-invalidate or leave badges stale.
- Product has not defined behavior for `prompt_copied`, but the current code can surface it as a mark event.

---

# Open Engineering Questions

1. Should `inbox_activities` be recipient-specific rows, or should one activity row support multiple recipients with separate recipient rows?

2. What exact activity type names should map current `mark_event_type` values to product activity names?

3. Should `prompt_copied` remain an Inbox activity, be excluded, or receive a product-defined required context?

4. How should "Workflow Change" map to the current data model, especially changes to `workflowStatusId` within the same lifecycle status?

5. What is the exact visibility threshold for "context viewed"?

6. For mentions, is viewing the containing comment enough, or must the exact mention range be visible?

7. Should opening a Mark from outside the Inbox acknowledge unread activities for that Mark?

8. How should deleted comments or deleted marks affect unread activities whose required context no longer exists?

9. Should read activities remain visible forever, be retained for a time window, or be archive-pruned?

10. Should users be able to manually mark individual activities unread in the future?

11. Should Inbox read state synchronize immediately across devices through realtime, or is refetch-based consistency acceptable?

12. Should sidebar unread count use the full Inbox snapshot query or a lightweight unread-count query?

13. Should Invite activities be stored in the same activity table as workspace collaboration activities even when the user is not yet a workspace member?

14. What immutable display payload should be stored on activity creation versus looked up from current source data?

---

# Recommendation

Adopt `inbox_activities` plus `inbox_activity_read_states` as the target architecture.

Keep the current derived Inbox implementation during migration, then incrementally dual-write canonical activities, switch reads to the new projection, and replace the global `inbox_read_states.lastReadAt` behavior with per-activity read acknowledgements.

This is the cleanest path to satisfy the product source of truth: immutable activities, independent read state, automatic context-based read transitions, and reliable "Mark all read" behavior over the same model.
