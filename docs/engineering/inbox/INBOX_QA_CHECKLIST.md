# Inbox QA Checklist

Use this checklist before shipping Inbox changes that affect canonical activities, read state, presentation grouping, navigation, or acknowledgement.

## Setup

- [ ] Run the full web test suite.
- [ ] Run TypeScript validation.
- [ ] Confirm `inbox_activities` is populated for the target workspace.
- [ ] Confirm `inbox_activity_read_states` has no duplicate rows for `(activity_id, user_id)`.
- [ ] Confirm current user can only read and acknowledge their own Inbox activities.
- [ ] Confirm realtime invalidation is active for Inbox activity and read-state changes.

## Canonical Activity Creation

- [ ] Assignment creates one Inbox activity for the recipient.
- [ ] Status change creates one Inbox activity for the recipient.
- [ ] Priority change creates one Inbox activity for the recipient.
- [ ] Label change creates one Inbox activity for the recipient.
- [ ] Comment creates one Inbox activity according to approved recipient rules.
- [ ] Comment mention creates one canonical mention activity for the mentioned user.
- [ ] Invite acceptance creates the approved invite activity, when that source is enabled.
- [ ] Self-authored activities are not sent to the actor.

## Read/Unread Semantics

- [ ] Unread badge counts unread activities, not visible cards.
- [ ] Opening unrelated pages does not change unread state.
- [ ] Mark-context activities become read only after the Mark detail context renders.
- [ ] Comment-context activities become read only after the target comment is visible.
- [ ] Mention activities become read only after the required visible target is reached.
- [ ] Failed Mark loads do not acknowledge activities.
- [ ] Missing target comments do not create false read states.
- [ ] Repeated visits are idempotent.
- [ ] Browser back/forward does not create duplicate read states.

## Mark Context Grouping

- [ ] Assignment + Status produce one Mark Context Presentation Group.
- [ ] Assignment + Priority produce one Mark Context Presentation Group.
- [ ] Assignment + Status + Priority + Labels produce one Mark Context Presentation Group.
- [ ] Assignment is the visible representative when present.
- [ ] Workflow/Status outrank Priority and Labels.
- [ ] Secondary activities remain in `group.events`.
- [ ] `activityIds` contains every activity in the Mark Context group.
- [ ] Viewing the Mark acknowledges only valid Mark-context candidates.

## Comment Context Grouping

- [ ] Comment only produces one Comment Context Presentation Group.
- [ ] Reply only produces one Comment Context Presentation Group.
- [ ] Mention only produces one Comment Context Presentation Group.
- [ ] Comment + Mention produce one Comment Context Presentation Group.
- [ ] Comment + Reply produce one Comment Context Presentation Group.
- [ ] Mention + Reply produce one Comment Context Presentation Group.
- [ ] Comment + Mention + Reply produce one Comment Context Presentation Group.
- [ ] Mention is the visible representative when present.
- [ ] Reply outranks Comment.
- [ ] Hidden activities remain in `group.events`.
- [ ] `activityIds` contains every activity in the Comment Context group.
- [ ] Navigation targets the containing comment.
- [ ] A mixed Comment/Mention group does not fail acknowledgement as one invalid mixed-context batch.

## Mixed Context Safety

- [ ] Mark Context and Comment Context activities for the same Mark remain separate Presentation Groups.
- [ ] Opening a Mark Context group does not acknowledge comment or mention activities.
- [ ] Opening a Comment Context group does not acknowledge unrelated Mark Context activities.
- [ ] Different comments on the same Mark do not merge into one Presentation Group.
- [ ] Comments from different Marks do not merge.
- [ ] Description mentions do not merge with comment mentions.

## Navigation Contract

- [ ] Inbox row URLs are built from Presentation Group metadata.
- [ ] URLs preserve repeated `inboxActivity` parameters when multiple activities belong to the group.
- [ ] URLs include `inboxContextType`.
- [ ] URLs include `inboxContextId`.
- [ ] Comment and mention routes include a stable `inboxTargetId`.
- [ ] Hash navigation scrolls to the target comment when present.
- [ ] Reloading the same URL preserves the acknowledgement behavior.

## Mark All Read

- [ ] Mark All Read inserts read states for all current-user unread activities.
- [ ] Mark All Read does not insert read states for another user.
- [ ] Repeating Mark All Read does not create duplicates.
- [ ] Badge count becomes zero after successful Mark All Read.
- [ ] New activities after Mark All Read become unread normally.

## Realtime And Cache

- [ ] A new activity created in another session appears in the current user's Inbox.
- [ ] Acknowledging an activity in one tab updates the Inbox badge in another tab.
- [ ] Mark All Read in one tab updates another tab.
- [ ] Realtime changes invalidate Inbox data without forcing unrelated workspace refreshes.

## Persistence

- [ ] Refresh after automatic acknowledgement keeps the activity read.
- [ ] Hard reload with an unread target open waits for the required context to render.
- [ ] Hard reload after acknowledgement does not create duplicate read states.
- [ ] Closing and reopening the browser keeps read state consistent.

## Performance

- [ ] Inbox loads acceptably for a workspace with many activities.
- [ ] Unread calculation uses canonical read-state rows.
- [ ] Mark All Read remains responsive for a large unread set.
- [ ] Presentation projection does not create duplicate groups.

## Documentation

- [ ] Update `READ_UNREAD_BEHAVIOR.md` when read semantics change.
- [ ] Update `INBOX_GROUPING_V2_ARCHITECTURE.md` when grouping, priority, navigation, or acknowledgement ownership changes.
- [ ] Keep real user emails, local accounts, screenshots, and one-off QA notes out of this folder.
