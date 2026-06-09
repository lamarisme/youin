# Phase 5 Implementation Report: Invitation Discoverability And Visibility

## Summary

Phase 5 improves invitation awareness for existing invitees and workspace owners without adding notification infrastructure, email delivery, new routes, workspace switching, or multi-workspace management.

The implementation adds:

- A lightweight pending-invitation reminder on Dashboard.
- Clear invitation lifecycle status in the Team tab.
- In-product invitation copy that does not imply email delivery is required.
- Revocation that preserves the invitation row instead of deleting its history.
- A shared effective-status helper that presents stale pending invitations as expired.

Inbox remains the explicit acceptance surface introduced in Phase 3.

## Phase 5 Scope

Implemented:

- Existing-user invitation awareness outside Inbox.
- Owner visibility into pending, accepted, revoked, and expired invitations.
- Secondary reminders using the existing Dashboard.
- Clear in-app discovery language.
- Durable revoked status.

Not implemented:

- Workspace switching.
- Multi-workspace management.
- Workspace-id URLs.
- Onboarding redesign.
- Notification infrastructure.
- Email delivery.
- Phase 6 edge-case screens and polish.

## User-Facing Surfaces Reviewed

### Dashboard

Before:

- Existing users only discovered invitations if they opened Inbox.

After:

- Dashboard shows a compact reminder when pending invitations exist.
- The reminder identifies the first workspace and inviter.
- Multiple pending invitations are summarized by count.
- `Review invite` opens Inbox.

### Inbox

Before Phase 5:

- Inbox already showed invitation cards and supported acceptance.

Phase 5 decision:

- Keep Inbox unchanged as the explicit resolution surface.
- Avoid duplicating acceptance state and error handling on Dashboard.

### Team Tab

Before:

- Copy implied that email delivery was part of the flow.
- Every invitation was presented as pending.
- Accepted, revoked, and expired states were not visible.
- Cancelling an invitation deleted the database row.

After:

- Copy explains that YouIn matches invitations when the email signs in.
- Email delivery is explicitly optional.
- Invitation rows show:
  - email,
  - status,
  - invitation date or lifecycle date,
  - inviter,
  - revoke action only while effectively pending.
- Revocation preserves the row with `status = 'revoked'`.

## Runtime Flow Before

### Existing Invitee

1. Owner created an invitation.
2. Invitation existed in `workspace_invites`.
3. Existing invitee opened Dashboard.
4. No invitation awareness appeared.
5. Invitee had to independently navigate to Inbox.

### Workspace Owner

1. Owner created an invitation.
2. Team tab showed a subordinate invited-email row.
3. The UI treated every loaded invite as pending.
4. Accepted or expired state was not distinguishable.
5. Cancelling removed the row, so the owner lost visibility into the revoked state.

## Runtime Flow After

### Existing Invitee

1. Dashboard loads the current workspace read model.
2. Dashboard also calls `discoverPendingWorkspaceInvitesAction()`.
3. Valid pending invitations produce a reminder above Triage.
4. Invitee selects `Review invite`.
5. Inbox displays the existing invitation card.
6. Invitee selects `Join and open`.
7. Phase 1 acceptance and Phase 4 activation continue unchanged.

If reminder discovery fails:

- Dashboard still loads normally.
- The secondary reminder is omitted.
- Core dashboard availability does not depend on invitation awareness.

### Workspace Owner

1. Account Team read model loads all workspace invitation rows.
2. Each row includes status, expiration, and acceptance timestamps.
3. UI derives an effective state.
4. A stale pending row is presented as expired.
5. Pending invitations can be revoked.
6. Revocation updates the row to `revoked` instead of deleting it.
7. Accepted, revoked, and expired history remains visible.

## Files Changed

### `apps/web/src/app/(workspace)/dashboard/page.tsx`

- Loads pending invitations in parallel with Dashboard data.
- Treats reminder discovery as non-blocking.
- Passes invitation data to `WorkspaceDashboard`.

### `apps/web/src/components/dashboard/workspace-dashboard.tsx`

- Adds the compact Dashboard invitation reminder.
- Links to the existing Inbox surface.
- Summarizes multiple invitations without implementing a chooser.

### `apps/web/src/app/(workspace)/account/tabs/team-tab.tsx`

- Updates invitation language.
- Shows effective status badges and lifecycle dates.
- Shows the revoke action only for pending invitations.
- Keeps invitation history visually subordinate to the member roster.

### `apps/web/src/lib/collab-types.ts`

- Extends `TeamInvite` with:
  - `status`,
  - `expiresAt`,
  - `acceptedAt`.

### `apps/web/src/lib/workspace/read-models.ts`

- Returns complete invitation lifecycle fields.
- Orders invitations by newest first.

### `apps/web/src/lib/workspace/load-workspace.ts`

- Keeps the legacy aggregate loader aligned with the expanded invitation type.

### `apps/web/src/lib/workspace/actions/invites.ts`

- Changes cancellation from row deletion to pending-to-revoked transition.

### `apps/web/src/lib/queries/use-workspace-mutations.ts`

- Keeps optimistic invitation objects aligned with the expanded type.
- Optimistically marks revoked invitations instead of removing them.
- Updates user-facing creation and revocation messages.

### `apps/web/src/lib/workspace/invite-state.ts`

- Defines effective invitation state for presentation.

### `apps/web/src/lib/workspace/invite-state.test.ts`

- Tests pending, expired, accepted, and revoked presentation behavior.

## Product Decisions

### Decision 1: Dashboard Reminder, Inbox Acceptance

Dashboard increases awareness, while Inbox owns the complete invitation action.

Why:

- Reuses existing acceptance UX and validation.
- Avoids duplicate loading, success, and error state.
- Keeps the Dashboard reminder compact.
- Makes Inbox secondary discovery instead of the only discovery path.

### Decision 2: No Dashboard Banner On Mark Detail

The reminder appears on the Dashboard/Triage surface, not inside individual Mark detail.

Why:

- Invitation awareness should not interrupt focused mark work.
- Dashboard is the natural workspace-entry surface.

### Decision 3: Reminder Failure Does Not Break Dashboard

Dashboard catches invitation-discovery failure and renders without the reminder.

Why:

- Invitation awareness is secondary.
- A temporary RPC problem should not block core backlog access.

### Decision 4: Preserve Revoked Invitations

Revoking an invitation updates status instead of deleting the row.

Why:

- Owners need to understand invitation history.
- The schema already models revocation as a first-class status.
- Preserved rows support future audit and reporting work.

### Decision 5: Derive Expired State In The UI

A pending invitation past `expires_at` is presented as expired.

Why:

- Expiration is a product fact even before a cleanup job mutates the row.
- Owners should not see a stale invitation labelled pending.
- No scheduled infrastructure is required.

### Decision 6: Do Not Add Copyable Invite Links Yet

Phase 5 plan described links as optional.

Why deferred:

- YouIn does not yet have a dedicated token acceptance route.
- Copying a token without a complete link UX would create another incomplete path.

### Decision 7: No Notification Infrastructure

The implementation reuses server-rendered Dashboard and Inbox surfaces.

Why:

- Meets discoverability needs with existing architecture.
- Avoids unread state, delivery guarantees, notification storage, and preference management.

## Invitation Status Presentation

### Pending

- Invitation status is `pending`.
- `expires_at` is in the future.
- Owner can revoke.
- Invitee can discover it.

### Accepted

- Invitation status is `accepted`.
- Acceptance date is shown when available.
- Revoke action is unavailable.

### Revoked

- Invitation status is `revoked`.
- Row remains visible to the owner.
- Invitee discovery excludes it.

### Expired

- Stored status is `expired`, or:
- Stored status is `pending` and `expires_at` is in the past.
- Revoke action is unavailable.
- Invitee discovery excludes it.

## Database Impact

No schema migration was required.

Existing columns used:

- `workspace_invites.status`
- `workspace_invites.invited_at`
- `workspace_invites.expires_at`
- `workspace_invites.accepted_at`
- `workspace_invites.invited_by_user_id`

Behavioral database change:

```text
Cancel before:
DELETE workspace_invites row

Revoke after:
UPDATE workspace_invites
SET status = 'revoked'
WHERE status = 'pending'
```

## Runtime Validation

Validation was performed against the live Supabase environment.

Workspace:

```text
PM-Hind-Workspace
ba64efaf-f357-47b5-9218-800df2a0e67b
```

Invitee:

```text
test-agent@example.com
```

Validation invitation:

```text
a7ca6f5e-4020-45c9-86cb-05e9c0ac6d52
```

Observed:

1. A pending invitation was created.
2. `discover_pending_workspace_invites()` returned exactly one matching invitation.
3. The owner-side status set contained `pending`.
4. The invitation was changed to `revoked`.
5. Invitee discovery returned zero matching invitations.
6. The database row remained present.
7. The owner-side status set contained `revoked`.

This validates the data path used by:

- Dashboard reminder discovery,
- Inbox discovery,
- Team tab lifecycle visibility.

## Automated Validation

Commands:

- `pnpm --filter @youin/web lint`
- `pnpm --filter @youin/web exec tsc --noEmit`
- `pnpm --filter @youin/web test`
- `pnpm --filter @youin/web build`

Results:

- Lint passed with two pre-existing warnings in `src/components/motion.tsx`.
- Typecheck passed.
- Tests passed: 48.
- Production build passed.

New tests confirm:

- Future pending invitations remain pending.
- Stale pending invitations display as expired.
- Accepted and revoked states remain terminal.

## Visual Validation

The local development server was available on port 3000.

Automated Browser verification was attempted twice. The Browser runtime failed before opening a page with:

```text
windows sandbox failed: spawn setup refresh
```

No visual defects were observed through Browser because the tool could not connect. Production compilation and runtime data validation completed successfully.

## Deferred To Phase 6

- Dedicated expired invitation screen.
- Dedicated revoked invitation screen.
- Wrong-email screen.
- Multiple-invitation decision experience.
- Loading and error polish across all invitation surfaces.
- Full desktop and mobile visual QA.
- Audit logging or accepted-by metadata.
- Scheduled expiration cleanup.

## Deferred To Future Multi-Workspace Work

- Workspace switcher.
- Workspace membership management across all joined workspaces.
- Active-workspace controls.
- Workspace-id routes.
- General workspace invitation center.
- Returning to a previously active workspace from UI.

## Deferred Product Extensions

- Copyable invitation links.
- Invitation token route.
- Email delivery.
- Notification center.
- Push or realtime invitation alerts.
- Invitation reminder preferences.

## Final Status

Phase 5 is complete within the requested scope:

- Existing users can notice pending invitations from Dashboard.
- Inbox remains the explicit acceptance surface.
- Owners can understand invitation lifecycle state.
- Revoked invitation history is preserved.
- No workspace architecture or multi-workspace UI was introduced.
