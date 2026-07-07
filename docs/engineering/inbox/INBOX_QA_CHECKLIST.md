# Inbox QA Checklist

Use this checklist before production rollout of the canonical Inbox Read implementation.

## Setup

- [x] Apply all Inbox migrations through `0032_retire_legacy_inbox_realtime`.
- [x] Run the canonical activity backfill in dry-run mode and review skipped rows.
- [x] Run the canonical activity backfill with `--apply` in the target environment.
- [x] Run the read-state backfill from legacy timestamps before disabling legacy behavior.
- [ ] Confirm `inbox_activities` and `inbox_activity_read_states` are in Supabase realtime publication.
- [ ] Confirm `inbox_read_states` is not in Supabase realtime publication.

## Assignment

- [x] User A assigns a Mark to User B.
- [x] User B sees one unread assignment activity.
- [x] User B opens the activity from Inbox.
- [x] The activity becomes read only after the Mark detail context renders.
- [x] Other unread activities on the same Mark remain unread unless their own context is viewed.

## Mention

- [x] User A mentions User B in a Mark description.
- [x] User B sees one unread mention activity.
- [x] Opening the Mark without the description context becoming visible does not acknowledge the activity.
- [x] The activity becomes read after the description mention context is visible.
- [x] User A mentions User B in a comment.
- [x] The activity becomes read only after the target comment is visible.

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

- [x] Create at least three unread activities on the same Mark.
- [x] View only one required context.
- [x] Confirm only the matching activity becomes read.
- [x] Use Mark All Read.
- [x] Confirm every remaining unread activity becomes read.

## Opening Marks Outside Inbox

- [x] Open a Mark directly from Dashboard without Inbox route context.
- [x] Confirm unrelated Inbox activities are not acknowledged.
- [x] Open a Mark directly with no `inboxActivity` query param.
- [x] Confirm the Inbox unread count does not change.

## Mark All Read

- [x] Use Mark All Read with several unread activities.
- [x] Confirm `inbox_activity_read_states` rows are inserted for current-user unread activities.
- [x] Confirm no rows are inserted for another user.
- [x] Repeat Mark All Read.
- [x] Confirm no duplicate read-state rows are created.

## Realtime Synchronization

- [x] Open Inbox in two browser tabs for the same user.
- [x] Create a new activity from another session.
- [x] Confirm both tabs converge to the same unread count.
- [x] Acknowledge an activity in one tab.
- [x] Confirm the other tab updates without a full workspace refresh.

## Multiple Browser Tabs

- [ ] Keep Dashboard open in one tab and Inbox open in another.
- [ ] Acknowledge a Mark-context activity from Dashboard.
- [ ] Confirm Inbox and sidebar badge update in the Inbox tab.
- [ ] Use Mark All Read in one tab.
- [ ] Confirm the other tab updates after realtime/refetch.

## Automatic Read Acknowledgement

- [x] Confirm route start does not acknowledge read before content is rendered.
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

- [x] Open a comment mention activity.
- [x] Confirm the containing comment must be visible before acknowledgement.
- [x] Open a description mention activity.
- [x] Confirm the Notes section must be visible before acknowledgement.
- [x] Confirm opening the same Mark without the mention target does not acknowledge the mention.

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

- [x] Compare projected canonical activity counts against expected legacy counts for representative workspaces.
- [x] Confirm skipped source rows are explainable.
- [x] Confirm rerunning activity backfill does not create duplicates.
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
