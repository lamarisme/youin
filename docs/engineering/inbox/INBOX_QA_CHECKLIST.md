# Inbox QA Checklist

Use this checklist before production rollout of the canonical Inbox Read implementation.

## Setup

- [ ] Apply all Inbox migrations through `0032_retire_legacy_inbox_realtime`.
- [ ] Run the canonical activity backfill in dry-run mode and review skipped rows.
- [ ] Run the canonical activity backfill with `--apply` in the target environment.
- [ ] Run the read-state backfill from legacy timestamps before disabling legacy behavior.
- [ ] Confirm `inbox_activities` and `inbox_activity_read_states` are in Supabase realtime publication.
- [ ] Confirm `inbox_read_states` is not in Supabase realtime publication.

## Assignment

- [ ] User A assigns a Mark to User B.
- [ ] User B sees one unread assignment activity.
- [ ] User B opens the activity from Inbox.
- [ ] The activity becomes read only after the Mark detail context renders.
- [ ] Other unread activities on the same Mark remain unread unless their own context is viewed.

## Mention

- [ ] User A mentions User B in a Mark description.
- [ ] User B sees one unread mention activity.
- [ ] Opening the Mark without the description context becoming visible does not acknowledge the activity.
- [ ] The activity becomes read after the description mention context is visible.
- [ ] User A mentions User B in a comment.
- [ ] The activity becomes read only after the target comment is visible.

## Comment

- [ ] User A comments on a Mark followed by User B according to the approved recipient rules.
- [ ] User B sees one unread comment activity.
- [ ] The Inbox link targets the correct comment anchor.
- [ ] The activity remains unread before the target comment is visible.
- [ ] The activity becomes read after the target comment is visible.

## Workflow Change

- [ ] User A changes a Mark workflow/status value that maps to approved Inbox behavior.
- [ ] User B sees one unread activity.
- [ ] Opening the Mark from Inbox acknowledges only that activity after Mark detail renders.

## Status Change

- [ ] User A closes or reopens a relevant Mark.
- [ ] User B sees one unread status activity.
- [ ] Viewing the Mark context marks that activity read.

## Priority Change

- [ ] User A changes priority on a relevant Mark.
- [ ] User B sees one unread priority activity.
- [ ] Viewing the Mark context marks that activity read.

## Label Change

- [ ] User A changes labels on a relevant Mark.
- [ ] User B sees one unread label activity.
- [ ] Viewing the Mark context marks that activity read.

## Multiple Activities On One Mark

- [ ] Create at least three unread activities on the same Mark.
- [ ] View only one required context.
- [ ] Confirm only the matching activity becomes read.
- [ ] Use Mark All Read.
- [ ] Confirm every remaining unread activity becomes read.

## Opening Marks Outside Inbox

- [ ] Open a Mark directly from Dashboard without Inbox route context.
- [ ] Confirm unrelated Inbox activities are not acknowledged.
- [ ] Open a Mark directly with no `inboxActivity` query param.
- [ ] Confirm the Inbox unread count does not change.

## Mark All Read

- [ ] Use Mark All Read with several unread activities.
- [ ] Confirm `inbox_activity_read_states` rows are inserted for current-user unread activities.
- [ ] Confirm no rows are inserted for another user.
- [ ] Repeat Mark All Read.
- [ ] Confirm no duplicate read-state rows are created.

## Realtime Synchronization

- [ ] Open Inbox in two browser tabs for the same user.
- [ ] Create a new activity from another session.
- [ ] Confirm both tabs converge to the same unread count.
- [ ] Acknowledge an activity in one tab.
- [ ] Confirm the other tab updates without a full workspace refresh.

## Multiple Browser Tabs

- [ ] Keep Dashboard open in one tab and Inbox open in another.
- [ ] Acknowledge a Mark-context activity from Dashboard.
- [ ] Confirm Inbox and sidebar badge update in the Inbox tab.
- [ ] Use Mark All Read in one tab.
- [ ] Confirm the other tab updates after realtime/refetch.

## Automatic Read Acknowledgement

- [ ] Confirm route start does not acknowledge read before content is rendered.
- [ ] Confirm failed Mark loads do not acknowledge read.
- [ ] Confirm repeated visits are idempotent.
- [ ] Confirm browser back/forward does not create duplicate read states.

## Comment Visibility Acknowledgement

- [ ] Open a comment activity whose target comment is below the fold.
- [ ] Confirm it remains unread before scroll.
- [ ] Scroll until the comment is visibly in view.
- [ ] Confirm the activity becomes read.
- [ ] Delete or hide the target comment in a test dataset.
- [ ] Confirm missing target content does not produce a false read.

## Mention Visibility Acknowledgement

- [ ] Open a comment mention activity.
- [ ] Confirm the containing comment must be visible before acknowledgement.
- [ ] Open a description mention activity.
- [ ] Confirm the Notes section must be visible before acknowledgement.
- [ ] Confirm opening the same Mark without the mention target does not acknowledge the mention.

## Refresh Behavior

- [ ] Refresh Inbox after reading an activity.
- [ ] Confirm read state persists.
- [ ] Refresh Dashboard after automatic acknowledgement.
- [ ] Confirm unread count remains correct.

## Browser Reload

- [ ] Hard reload with an unread Inbox item open.
- [ ] Confirm acknowledgement waits for the required context to render again.
- [ ] Hard reload after acknowledgement.
- [ ] Confirm no duplicate read state is written.

## Backfill Verification

- [ ] Compare projected canonical activity counts against expected legacy counts for representative workspaces.
- [ ] Confirm skipped source rows are explainable.
- [ ] Confirm rerunning activity backfill does not create duplicates.
- [ ] Confirm accepted workspace invites are projected as canonical invite activities for the inviter.
- [ ] Confirm historical deleted mentions are documented as unreconstructable.

## Database Integrity

- [ ] Verify one `inbox_activities` row per `(workspace_id, recipient_user_id, source_type, source_id)`.
- [ ] Verify one `inbox_activity_read_states` row per `(activity_id, user_id)`.
- [ ] Verify read states always belong to the activity recipient.
- [ ] Verify RLS blocks another user from selecting activities or read states.
- [ ] Verify deleting a workspace cascades canonical Inbox rows.

## Performance Verification

- [ ] Load Inbox for a workspace with many canonical activities.
- [ ] Confirm timeline query uses recipient and created-at indexes.
- [ ] Confirm unread lookup uses user/workspace read-state indexes.
- [ ] Confirm realtime read-state changes invalidate only Inbox data.
- [ ] Confirm Mark All Read remains responsive for large unread sets.

## Review Link Source

- [ ] Confirm no Review Link canonical activity is expected until Product approves recipient and trigger rules.
- [ ] After approval, add QA scenarios for review creation, review visibility, acknowledgement, and recipient isolation.
