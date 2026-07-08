# Inbox Grouping V2 Architecture

**Status:** Implemented

## Goal

Inbox Grouping V2 makes Inbox cards represent the highest-value user action for a viewed context.

The Inbox should answer:

> What is the most important thing the user should act on?

It should not expose every canonical activity as a separate card when those activities point to the same user destination.

## Scope

Grouping V2 is a presentation-layer architecture.

It preserves:

- canonical `inbox_activities`
- `inbox_activity_read_states`
- activity-based unread counts
- context-viewed acknowledgement semantics
- existing database schema
- realtime ownership

It changes:

- how canonical activities are projected into Inbox cards
- which activity becomes visible for a grouped card
- how navigation metadata is owned by the group

## Core Model

The runtime has four layers:

| Layer | Responsibility |
| --- | --- |
| Canonical Activity | Immutable activity facts and required context. |
| Presentation Classifier | Converts one canonical activity into presentation metadata. |
| Presentation Projection | Builds Presentation Groups from classified activities. |
| Navigation/Acknowledgement | Uses group-owned metadata to route and acknowledge safely. |

Canonical activities remain the source of truth for activity identity and read state.

Presentation Groups are derived at query time. They are not stored in the database.

## Presentation Classifier

The Presentation Classifier is the single authority for transforming canonical activities into presentation context.

Runtime owner:

`apps/web/src/lib/workspace/inbox-presentation-classifier.ts`

Responsibilities:

- classify the activity into a presentation context family
- build deterministic Presentation Group identity
- choose the user destination
- choose target metadata for navigation
- expose acknowledgement context metadata
- assign the activity to exactly one Presentation Group

No other runtime should rebuild grouping keys independently.

## Presentation Group Identity

Presentation Group identity is based on the viewed destination context.

The helper that builds group identity must live with the classifier.

Current identity shape:

| Presentation context | Group identity |
| --- | --- |
| Mark Context | `mark:<mark_id>` |
| Comment Context | `comment:<comment_id>` |
| Review Context | `review:<review_context_id>` |
| Invite Context | `invite:<invite_id>` |
| Standalone fallback | `standalone:<activity_id>` |

The exact string format is an implementation detail. The architectural requirement is one owner for Presentation Group identity.

## Activity Families

Presentation Groups are based on destination/context, not notification type.

### Mark Context

Destination: related Mark.

Activities:

- Assignment
- Workflow change
- Status change
- Priority change
- Label change

Acknowledgement happens after the Mark detail context renders.

### Comment Context

Destination: containing comment thread.

Activities:

- Comment
- Reply
- Mention in comment

Mentions remain canonical `mention` activities. They are grouped into Comment Context because the user destination is the containing comment, not a standalone mention page.

Acknowledgement happens only after the target comment is visible. When a Comment Context group contains mixed canonical required contexts, the dashboard submits safe acknowledgement attempts and the server validates each activity against its own required context.

### Review Context

Destination: related review context.

Activities:

- Review
- Review reply
- Review mention
- Review link

The same classifier/projection architecture applies. Product-specific review presentation rules should be added through classifier and priority configuration, not component logic.

### Invite Context

Destination: invitation details or team page.

Activities:

- Invite
- Invite accepted

### Standalone Fallback

Standalone groups are allowed only when no stable shared destination exists.

Standalone fallback should be conservative. It should not become a primary product concept when a destination context exists.

## Presentation Projection

Runtime owner:

`apps/web/src/lib/workspace/inbox-presentation-projection.ts`

Responsibilities:

- consume classifier output
- create Presentation Groups
- keep every grouped activity in `group.events`
- preserve activity-based unread counts
- assign group-owned navigation metadata
- choose the representative event through the priority system
- sort hidden events predictably

Projection must not contain duplicated grouping-key logic.

## Presentation Priority

Runtime owner:

`apps/web/src/lib/workspace/inbox-presentation-priority.ts`

Presentation priority determines which event is visible when multiple activities belong to one Presentation Group.

The priority system is configuration-based. Future activity types should be added by extending the priority map, not by adding component-level `if` statements.

Current priorities:

### Comment Context

| Priority | Activity |
| --- | --- |
| 1 | Mention |
| 2 | Reply |
| 3 | Comment |

Examples:

- Comment only: show Comment.
- Reply only: show Reply.
- Mention only: show Mention.
- Comment + Mention: show Mention.
- Reply + Mention: show Mention.
- Comment + Reply: show Reply.
- Comment + Reply + Mention: show Mention.

### Mark Context

| Priority | Activity |
| --- | --- |
| 1 | Assignment |
| 2 | Workflow change / Status change |
| 3 | Priority change |
| 4 | Label change |

Secondary activities remain in the group and can be summarized as additional updates.

### Review Context

Review priority follows the same configuration model.

Do not invent new product behavior in UI components. Add review-specific priority through the presentation priority map after Product confirms the ordering.

## Navigation Contract

Runtime owner:

`apps/web/src/lib/workspace/inbox-navigation.ts`

Presentation Groups own navigation metadata:

- `requiredContextType`
- `requiredContextId`
- `activityIds`
- `targetId`

Inbox rows must build URLs from the Presentation Group, not from `group.events[0]`.

The URL contract uses repeated `inboxActivity` query parameters when more than one activity belongs to the selected presentation context.

Example:

```text
/dashboard/YIN-5?inboxActivity=<id1>&inboxActivity=<id2>&inboxContextType=mention&inboxContextId=<mention_id>&inboxTargetId=comment-<comment_id>#comment-<comment_id>
```

The route contract can carry multiple ids, but server acknowledgement remains context-validated.

## Acknowledgement Contract

Runtime owners:

- `apps/web/src/components/dashboard/mark-detail-view.tsx`
- `apps/web/src/lib/workspace/actions/inbox.ts`
- `apps/web/src/lib/workspace/inbox-read-state.ts`

Acknowledgement rules:

- The dashboard consumes the navigation contract.
- Mark-context acknowledgement waits until Mark detail renders.
- Comment and mention acknowledgement waits until the target element is visible.
- Failed loads do not acknowledge.
- Repeated acknowledgement is idempotent.
- Server validation remains the safety boundary.

The server action validates that every requested activity belongs to the current workspace, current recipient, and supplied viewed context.

When a Presentation Group contains activities with different canonical required contexts but the same visible target, the dashboard must avoid sending one invalid mixed-context batch. It should submit safe attempts and allow server validation to accept only matching activity/context pairs.

## Unread Behavior

Unread counts remain activity-based.

Examples:

- A group with two unread activities contributes `2` to the badge.
- A group can render one visible card while retaining hidden unread activities in `group.events`.
- Reading one activity does not read unrelated activities.
- Reading a viewed context may acknowledge multiple grouped activities only when validation confirms the viewed context satisfies them.

## Realtime

Grouping V2 requires no new realtime database subscriptions.

The Inbox already invalidates/refetches from canonical activity and read-state changes. Presentation Groups are derived from the current snapshot after refetch.

## Database Impact

Grouping V2 does not require database changes.

No migrations are required for Presentation Groups, priority rules, or navigation metadata.

## Runtime Ownership Summary

| Concern | File |
| --- | --- |
| Presentation classification | `apps/web/src/lib/workspace/inbox-presentation-classifier.ts` |
| Presentation group projection | `apps/web/src/lib/workspace/inbox-presentation-projection.ts` |
| Presentation priority | `apps/web/src/lib/workspace/inbox-presentation-priority.ts` |
| Navigation URL contract | `apps/web/src/lib/workspace/inbox-navigation.ts` |
| Automatic acknowledgement | `apps/web/src/components/dashboard/mark-detail-view.tsx` |
| Server-side context validation | `apps/web/src/lib/workspace/inbox-read-state.ts` |

## Extension Rules

When adding a new Inbox activity type:

1. Add or confirm the canonical activity type and required context.
2. Classify it into a presentation context family.
3. Add priority configuration if it can share a group with other activities.
4. Add projection tests showing representative selection and hidden activity preservation.
5. Add navigation/acknowledgement tests for the viewed context.
6. Update `INBOX_QA_CHECKLIST.md`.

Do not add event-specific grouping or priority logic inside UI components.

## Current Open Product Questions

These questions are intentionally outside the current implementation:

1. Should representative selection eventually consider more nuanced importance beyond the current priority map?
2. Should Inbox expose hidden grouped activities in an expanded UI?
3. Should badge counts always remain activity-based, or should Product introduce a separate grouped-card count?
4. What final ordering should Review Context use when review-specific activity types expand?
