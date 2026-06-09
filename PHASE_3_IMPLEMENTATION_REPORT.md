# Phase 3 Implementation Report: Existing-User Invitation Discovery In Inbox

## Summary

Phase 3 adds the MVP invitation surface for users who already belong to a workspace.

Existing users can now discover pending workspace invitations from the Inbox and explicitly accept them from that same surface. This reuses the Phase 1 primitives:

- `discoverPendingWorkspaceInvitesAction()`
- `acceptWorkspaceInviteAction()`

No multi-workspace switcher, active workspace selection, URL architecture change, dashboard banner, notification system, or onboarding redesign was introduced.

## Chosen UI Surface

Inbox was chosen because it already represents "things that need my attention" inside the workspace product. A workspace invitation is not a mark update, but it is an account-level action item that a signed-in user must resolve.

Using Inbox for the MVP keeps the flow discoverable without adding a new navigation concept. It also avoids sending existing users back through onboarding, which would be surprising for someone who already owns or uses a workspace.

## Runtime Flow Before

1. A workspace owner created an invite from the team settings surface.
2. `workspace_invites` stored the invite as `pending`.
3. Phase 1 made pending invitations discoverable by matching the signed-in user's email.
4. Phase 2 used that discovery during onboarding for users with no workspace.
5. Existing users with an active workspace were sent directly into the product.
6. Existing users had no in-product surface that called invitation discovery.
7. A valid invite could exist in the database while the invited existing user had no visible way to accept it.

## Runtime Flow After

1. Existing user opens Inbox.
2. Inbox server page loads both:
   - mark inbox read model,
   - pending workspace invitations for the signed-in user's email.
3. Inbox displays pending invitations above normal mark activity.
4. User clicks `Join workspace`.
5. Inbox calls `acceptWorkspaceInviteAction({ inviteId })`.
6. Phase 1 RPC validation handles email match, status, expiration, duplicate membership, and membership creation.
7. Inbox removes resolved cards locally and refreshes server state.
8. Accepted invites no longer appear in discovery because their status changes from `pending` to `accepted`.

## Files Changed

### `apps/web/src/app/(workspace)/inbox/page.tsx`

Responsibility:

- Server entry point for the Inbox page.

Changes:

- Loads `discoverPendingWorkspaceInvitesAction()` in parallel with `getInboxReadModelForCurrentWorkspace()`.
- Passes `pendingInvites` into `InboxView`.

### `apps/web/src/app/(workspace)/inbox/inbox-view.tsx`

Responsibility:

- Client Inbox experience.

Changes:

- Accepts pending invitation data.
- Renders invitation cards above normal inbox activity.
- Adds a `Join workspace` action for each pending invite.
- Calls the existing acceptance action instead of duplicating invite logic.
- Handles expected acceptance statuses with inline success or error messaging.
- Refreshes Inbox state after acceptance.

## Engineering Decisions

### Decision: Reuse Phase 1 Actions Directly

Why:

- Phase 1 already centralized invitation discovery, validation, and acceptance.
- Reusing the actions keeps Inbox as a UI surface only.

Alternative considered:

- Add a dedicated Inbox invitation API.

Why rejected:

- It would duplicate invitation responsibility and create two acceptance paths.

### Decision: Fetch Invitations On The Inbox Server Page

Why:

- The Inbox route already has a server entry point that prepares initial data.
- Server fetching avoids a second loading state for the initial page render.

Alternative considered:

- Fetch invitations only from the client after page load.

Why rejected:

- That would make invitation visibility feel delayed and less reliable.

### Decision: Keep Invitations Separate From Mark Inbox Events

Why:

- Workspace invitations are account/workspace access decisions, not mark events.
- Keeping them separate avoids changing the mark inbox read model.

Alternative considered:

- Merge invitations into `InboxSnapshot.groups`.

Why rejected:

- It would blur two different domains and force mark-specific inbox types to represent workspace membership objects.

### Decision: Do Not Redirect After Acceptance

Why:

- Phase 3 explicitly does not introduce workspace switching or active workspace selection.
- After acceptance, the user becomes a member, and future multi-workspace work can decide where to send them.

Tradeoff:

- The user may not immediately enter the newly joined workspace from the current UI.
- This is acceptable for Phase 3 because the goal is discovery and acceptance, not navigation between workspaces.

## Product Reasoning

Inbox fits the MVP because it is already the product's attention surface. Existing users should not have to revisit onboarding or check account settings to discover an invite.

This supports future multi-workspace work by creating the missing membership edge today. Once workspace switching exists, accepted memberships can appear there without reworking invitation acceptance.

New surfaces were avoided because they would increase product complexity before the core collaboration loop is proven. The smallest useful product behavior is:

```text
Existing user has pending invite
-> Inbox shows invite
-> User accepts
-> Membership is created
```

## Edge Cases

### Expired Invite

Discovery excludes expired pending invites. If the user attempts acceptance from stale UI, the action returns `expired`; Inbox removes the card and shows an error.

### Revoked Invite

Discovery excludes revoked invites. If the user attempts acceptance from stale UI, the action returns `revoked`; Inbox removes the card and shows an error.

### Already Accepted Invite

If another tab or session already accepted the invite, the action can return `already_accepted` or `already_member`; Inbox treats the invite as resolved and removes the card.

### Duplicate Acceptance

The button is disabled while a card is accepting. The database also prevents duplicate membership rows through the existing `(workspace_id, user_id)` primary key.

### Multiple Pending Invites

Inbox renders all pending invitations returned by discovery. Accepting one invite removes only that card and refreshes server state.

### Email Mismatch

The acceptance RPC validates that the signed-in user's email matches the invite email. Inbox shows an error if `email_mismatch` is returned.

## Testing Guide

### Existing User With Pending Invite

1. Sign in as a workspace owner.
2. Invite an email that belongs to an existing YouIn account with its own workspace.
3. Sign in as the invited user.
4. Open Inbox.
5. Confirm the invitation card appears.
6. Click `Join workspace`.
7. Confirm the card disappears and a success message appears.
8. Verify `workspace_members` contains the invited user for the inviting workspace.
9. Verify `workspace_invites.status = 'accepted'`.

### Expired Invite

1. Create a pending invite for the signed-in user's email.
2. Set `expires_at` in the past.
3. Open Inbox.
4. Confirm the invite is not shown.
5. If attempting acceptance from stale UI, expect `expired`.

### Revoked Invite

1. Create an invite.
2. Set `status = 'revoked'`.
3. Open Inbox.
4. Confirm the invite is not shown.
5. If attempting acceptance from stale UI, expect `revoked`.

### Duplicate Acceptance

1. Open Inbox in two tabs with the same pending invite.
2. Accept the invite in the first tab.
3. Accept it in the second tab.
4. Confirm no duplicate membership is created.
5. Confirm the second result resolves as already handled.

## Automated Validation

Commands run:

- `pnpm --filter @youin/web lint`
- `pnpm --filter @youin/web exec tsc --noEmit`
- `pnpm --filter @youin/web test`
- `pnpm --filter @youin/web build`

Results:

- Lint passed with two existing warnings in `src/components/motion.tsx`.
- Typecheck passed.
- Test suite passed: 42 tests.
- Production build passed.

## Real End-To-End Validation

Validation was performed against the live Supabase database using a real existing user account that already owned a workspace.

Validation pair:

- Inviting owner: `kanata10kan@gmail.com`
- Inviting workspace: `My workspace-kanata`
- Existing invitee account: `test-agent@example.com`
- Invitee existing workspace: `Test Workspace`

Observed runtime results:

- A valid pending invite existed for `test-agent@example.com`.
- `discover_pending_workspace_invites()` returned the invite for the invitee auth context.
- `accept_workspace_invite(invite_id, null)` returned `accepted`.
- `workspace_members` gained a member row for the invitee in Kanata's workspace.
- `workspace_invites.status` changed to `accepted`.
- `workspace_invites.accepted_at` was populated.
- A second discovery call no longer returned the invite.

Validated invite id:

```text
53a0a70a-e329-4c4c-819b-1dde324c2f85
```

Validated acceptance result:

```text
status: accepted
workspace_id: 47a41540-cf40-4f69-a974-0d193c77b317
```

## Future Considerations

### Workspace Switching

Once users can belong to multiple workspaces, accepted invitations should appear in a workspace switcher or workspace menu. Phase 3 intentionally stops at membership creation.

### Active Workspace Selection

Future work can decide whether accepting an invite should set the new workspace as active, ask the user, or leave the current workspace active.

### Notification System

A future notification system could point users toward Inbox invitations, but Inbox should remain the durable place to resolve them.

### Account-Level Invitation Center

If YouIn grows into a larger collaboration platform, account settings could include a full invitation history. This is unnecessary for the MVP.
