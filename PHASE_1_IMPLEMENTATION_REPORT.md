# Phase 1 Implementation Report: Workspace Invitation Discovery And Acceptance

## Summary

Phase 1 establishes the backend foundation for invitation-aware onboarding without implementing onboarding UI, routes, banners, inbox changes, workspace switching, or automatic workspace creation changes.

This phase adds:

- A trusted invitation discovery RPC for the signed-in user's email.
- An explicit invitation acceptance RPC that validates status, expiration, and recipient identity.
- Server actions that expose those RPCs to future onboarding or account UI.
- A small typed normalization layer for predictable app-level invite cards and acceptance results.
- A migration and updated canonical Supabase setup SQL.

The current runtime remains compatible: existing workspace bootstrap can still attach a user through an invite, but the legacy helper now accepts only one valid, unexpired invite instead of bulk-accepting every pending invite for the same email.

## What Was Implemented

### Invitation Discovery

Implemented `discover_pending_workspace_invites()` in SQL.

It:

- Requires an authenticated Supabase user.
- Reads the authenticated user's email from `auth.users`.
- Matches pending invitations by lowercase email.
- Returns only invitations with `status = 'pending'`.
- Excludes expired invitations with `expires_at <= now()`.
- Excludes revoked and accepted invitations by status.
- Returns a limited user-facing read model:
  - invite id
  - workspace id
  - workspace name
  - invited email
  - inviter profile display fields
  - invited/expires timestamps
  - invite source

Added `discoverPendingWorkspaceInvitesAction()` for app code.

### Invitation Acceptance

Implemented `accept_workspace_invite(p_invite_id uuid, p_token text)` in SQL.

It:

- Requires an authenticated Supabase user.
- Accepts exactly one invite by invite id or token.
- Validates that the invite exists.
- Validates that the signed-in user's email matches the invite email.
- Handles `accepted`, `revoked`, `expired`, and `pending` states explicitly.
- Converts stale pending invites to `expired` at acceptance time.
- Creates a `workspace_members` row with role `member`.
- Uses `ON CONFLICT DO NOTHING` to prevent duplicate membership creation.
- Marks the invite `accepted` with `accepted_at = now()`.
- Returns a structured status instead of relying only on thrown errors.

Added `acceptWorkspaceInviteAction()` for app code.

### Legacy Auto-Attach Hardening

Updated `attach_user_via_invite(p_token text)` to:

- Match only valid pending invites.
- Reject expired invites.
- Require email match even when a token is supplied.
- Accept one invite only.
- Delegate final acceptance to the new explicit acceptance function.

This keeps the current app working while removing the most dangerous legacy behavior: bulk-accepting multiple pending invites for the same email.

## Files Changed

### `apps/web/supabase/onboarding-rpcs.sql`

Responsibility:

- Canonical Supabase SQL setup for onboarding and membership bootstrap RPCs.

Changes:

- Added `discover_pending_workspace_invites()`.
- Added `accept_workspace_invite(uuid, text)`.
- Hardened `attach_user_via_invite(text)`.
- Added grants/revokes for the new RPCs.

### `apps/web/drizzle/0018_workspace_invitation_phase_1.sql`

Responsibility:

- Migration for Phase 1 RPC changes.

Changes:

- Adds the new discovery and acceptance RPCs.
- Replaces the legacy auto-attach RPC with the safer single-invite version.
- Grants execute permissions to `authenticated`.

### `apps/web/drizzle/meta/_journal.json`

Responsibility:

- Drizzle migration journal.

Changes:

- Registers migration `0018_workspace_invitation_phase_1`.

### `apps/web/src/lib/workspace/invitations.ts`

Responsibility:

- Typed app contract for invitation discovery and acceptance.

Changes:

- Defines pending invite read model.
- Defines acceptance statuses.
- Defines accept action input shape.
- Normalizes RPC discovery rows.
- Normalizes RPC acceptance rows.
- Validates UUID input format.

### `apps/web/src/lib/workspace/invitations.test.ts`

Responsibility:

- Unit tests for the app-level invitation contract.

Changes:

- Verifies pending invite normalization.
- Verifies incomplete invite rows are dropped.
- Verifies acceptance result normalization.
- Verifies malformed acceptance results fall back to `not_found`.
- Verifies UUID validation.

### `apps/web/src/lib/workspace/actions/invites.ts`

Responsibility:

- Server actions for workspace invitations and membership management.

Changes:

- Added `discoverPendingWorkspaceInvitesAction()`.
- Added `acceptWorkspaceInviteAction()`.
- Kept owner invite creation/cancel/member removal behavior unchanged.

### `apps/web/src/lib/workspace/actions/index.ts`

Responsibility:

- Workspace action export barrel.

Changes:

- Exports the new discovery and acceptance actions.

### `apps/web/package.json`

Responsibility:

- Web app scripts and package-level dependencies.

Changes:

- Adds `tsx` as a direct dev dependency.
- Updates the test script from raw `node --test` to `tsx --test` so the existing TypeScript test suite actually runs.

### `pnpm-lock.yaml`

Responsibility:

- Workspace dependency lockfile.

Changes:

- Records `tsx` as a direct web dev dependency.

## Runtime Flow Before

### Discovery Before

1. Workspace owner created an invite through `inviteMemberAction(email)`.
2. A `workspace_invites` row was inserted with `status = 'pending'`.
3. Invitees had no explicit discovery action or API.
4. Non-members could not directly read `workspace_invites` through RLS.
5. The only invitee-side path was implicit:
   - user entered workspace bootstrap,
   - `ensureWorkspaceForUser()` called `attach_user_via_invite()`,
   - the RPC searched pending invites by email,
   - if found, it attached the user.

### Acceptance Before

1. Acceptance was not a deliberate user action.
2. `attach_user_via_invite()` accepted matching invites during workspace bootstrap.
3. It did not validate expiration.
4. It could mark multiple pending invites accepted for one email while returning only one workspace id.
5. Token-based acceptance did not verify the token's email against the signed-in user's email.

## Runtime Flow After

### Discovery After

1. Signed-in app code calls `discoverPendingWorkspaceInvitesAction()`.
2. The action verifies the user session.
3. The action calls `discover_pending_workspace_invites()`.
4. The RPC reads the authenticated email from `auth.users`.
5. The RPC returns only valid pending, unexpired invitations for that email.
6. The action normalizes rows into `PendingWorkspaceInvite[]`.

### Acceptance After

1. Signed-in app code calls `acceptWorkspaceInviteAction({ inviteId })` or `acceptWorkspaceInviteAction({ token })`.
2. The action validates basic input and session state.
3. The action syncs the profile row to protect the membership foreign key path.
4. The action calls `accept_workspace_invite`.
5. The RPC locks the selected invite row.
6. The RPC validates recipient email, status, and expiration.
7. If valid, the RPC creates membership and marks the invite accepted.
8. The RPC returns a structured result:
   - `accepted`
   - `already_member`
   - `already_accepted`
   - `email_mismatch`
   - `expired`
   - `invalid_request`
   - `not_found`
   - `revoked`

## Engineering Decisions

### Decision: Use RPCs For Discovery And Acceptance

Why:

- Invitees are not workspace members yet, so normal `workspace_invites` RLS should not expose the table directly.
- SQL RPCs can use `auth.uid()` and `auth.users.email` to scope access tightly.
- Acceptance needs row locking and atomic membership creation.

Alternative considered:

- Query `workspace_invites` directly from a server action with Drizzle.

Why rejected:

- It would work from the app server but would spread sensitive access rules into TypeScript.
- It would be easier to accidentally reuse the query in a workspace-scoped context or bypass future RLS assumptions.

Future implication:

- Onboarding UI can call a simple action without knowing the table/RLS details.

### Decision: Return Structured Statuses Instead Of Throwing For Expected States

Why:

- Expired, revoked, accepted, and wrong-email states are product states, not system failures.
- Future UI needs to render clear screens for each outcome.

Alternative considered:

- Throw errors from SQL for every failed acceptance.

Why rejected:

- Error strings are brittle UI contracts.
- Expected states would be harder to test and localize later.

Future implication:

- Onboarding can map statuses directly to user-facing copy.

### Decision: Keep Legacy `attach_user_via_invite` But Harden It

Why:

- Phase 1 must not implement onboarding changes or alter workspace bootstrap architecture.
- Current runtime may still depend on implicit invite attachment.
- Removing or disabling it would be a Phase 2 behavior change.

Alternative considered:

- Remove implicit attachment from `ensureWorkspaceForUser()`.

Why rejected:

- That belongs to Phase 2, where onboarding and workspace creation flow will be changed deliberately.

Future implication:

- Phase 2 can stop calling the legacy helper once onboarding owns the join-or-create decision.

### Decision: Add A Thin TypeScript Normalization Layer

Why:

- Supabase RPC responses are untyped at the app boundary.
- Future onboarding should consume stable app-level types.
- Tests can pin the app contract without needing a live database.

Alternative considered:

- Inline all mapping in the server action.

Why rejected:

- It would make the server action harder to test and make future UI code depend on raw RPC column names.

Future implication:

- UI can use `PendingWorkspaceInvite` and `WorkspaceInviteAcceptanceResult` directly.

## Product Reasoning

### Invitation Discovery

The implementation supports in-app discovery without requiring email delivery. A user who signs in with an invited email can be matched against pending database invitations.

This supports the approved UX direction:

```text
Pending invite exists
-> discover invitation
-> user chooses whether to join
```

### Explicit Acceptance

Acceptance is now a callable, explicit action. This prepares the future UI to show a clear "Join workspace" button instead of relying on hidden bootstrap behavior.

### Future Onboarding Flow

Phase 1 does not add onboarding screens, but it gives Phase 2 the primitives it needs:

- check pending invites,
- show invite cards,
- accept one invite,
- handle expired/revoked/wrong-email states,
- create membership safely.

## Database Changes

### Schema Changes

No table or enum schema changes were added in Phase 1.

Existing tables used:

- `workspace_invites`
- `workspace_members`
- `workspaces`
- `profiles`
- `auth.users`

Existing statuses used:

- `pending`
- `accepted`
- `revoked`
- `expired`

### Migration

Added:

- `apps/web/drizzle/0018_workspace_invitation_phase_1.sql`

Updated:

- `apps/web/drizzle/meta/_journal.json`

### Membership Creation Flow

Membership is created inside `accept_workspace_invite`:

1. Validate invite belongs to signed-in email.
2. Validate status is `pending`.
3. Validate `expires_at > now()`.
4. Insert into `workspace_members` with role `member`.
5. Use generated workspace username from `member_username_from_email`.
6. Use `ON CONFLICT DO NOTHING` for duplicate safety.

### Invitation Lifecycle Updates

Acceptance:

- `pending -> accepted`
- sets `accepted_at = now()`

Expired-at-acceptance:

- stale `pending -> expired`

Revoked and already accepted:

- no mutation during acceptance attempt.

## RPC / API Changes

### New RPC: `discover_pending_workspace_invites()`

Input:

- none

Auth:

- authenticated user required

Output:

- zero or more valid pending invite rows for the signed-in email.

### New RPC: `accept_workspace_invite(p_invite_id uuid, p_token text)`

Input:

- `p_invite_id`, optional
- `p_token`, optional
- at least one must be provided

Auth:

- authenticated user required

Output:

- one status row with:
  - `status`
  - `workspace_id`
  - `invite_id`

### Updated RPC: `attach_user_via_invite(p_token text)`

Input:

- optional token

Output:

- workspace id or null

Change:

- Still supports current bootstrap compatibility.
- Now accepts only one unexpired matching invite.
- Now validates token email match.
- Now delegates final acceptance to `accept_workspace_invite`.

### New Server Actions

`discoverPendingWorkspaceInvitesAction()`

- Returns `PendingWorkspaceInvite[]`.

`acceptWorkspaceInviteAction(input)`

- Accepts `{ inviteId?: string; token?: string }`.
- Returns `WorkspaceInviteAcceptanceResult`.

## Manual Testing Guide

These scenarios assume a database with the Phase 1 migration applied.

### Scenario 1: User Has Valid Pending Invitation

Setup:

1. Create workspace as Kanata.
2. Invite `hind@example.com`.
3. Sign in as Hind.

Test:

1. Call `discoverPendingWorkspaceInvitesAction()`.
2. Confirm the invite appears.
3. Call `acceptWorkspaceInviteAction({ inviteId })`.

Expected:

- Result status is `accepted`.
- `workspace_members` has Hind as `member`.
- `workspace_invites.status` is `accepted`.
- `workspace_invites.accepted_at` is set.

### Scenario 2: Invitation Already Accepted

Setup:

1. Use the invite from Scenario 1 after it is accepted.

Test:

1. Call `acceptWorkspaceInviteAction({ inviteId })` again as Hind.

Expected:

- Result status is `already_member`.
- No duplicate membership row is created.

### Scenario 3: Invitation Expired

Setup:

1. Create pending invite for `hind@example.com`.
2. Set `expires_at` to a past timestamp.
3. Sign in as Hind.

Test:

1. Call `discoverPendingWorkspaceInvitesAction()`.
2. Call `acceptWorkspaceInviteAction({ inviteId })`.

Expected:

- Discovery does not return the invite.
- Acceptance returns `expired`.
- Invite status becomes `expired`.
- No membership row is created.

### Scenario 4: Invitation Revoked

Setup:

1. Create invite for `hind@example.com`.
2. Set `workspace_invites.status = 'revoked'`.
3. Sign in as Hind.

Test:

1. Call discovery.
2. Call acceptance.

Expected:

- Discovery does not return the invite.
- Acceptance returns `revoked`.
- No membership row is created.

### Scenario 5: Wrong User Attempts Acceptance

Setup:

1. Create invite for `hind@example.com`.
2. Sign in as `amin@example.com`.

Test:

1. Call `acceptWorkspaceInviteAction({ inviteId })` or use the token.

Expected:

- Result status is `email_mismatch`.
- No membership row is created.
- Invite remains pending.

### Scenario 6: Duplicate Acceptance Attempt

Setup:

1. Create valid invite for Hind.
2. Open two sessions/tabs as Hind.

Test:

1. Accept invite in the first session.
2. Accept the same invite in the second session.

Expected:

- First result is `accepted`.
- Second result is `already_member`.
- Only one `workspace_members` row exists.

## Risks

### Legacy Bootstrap Still Auto-Accepts

Phase 1 keeps `ensureWorkspaceForUser()` behavior intact. A user who reaches current workspace bootstrap may still be attached automatically through the legacy helper.

Reason:

- Removing this belongs to Phase 2 onboarding work.

### No UI Yet

The new actions are not wired to screens. This is intentional for Phase 1.

### No Active Workspace Selection Yet

Existing users who accept invites later will need Phase 2 or Phase 3 active workspace handling before the dashboard can reliably open the newly joined workspace.

### Expiration Cleanup Is Opportunistic

Expired pending invites are excluded from discovery and marked expired during acceptance attempts, but there is no scheduled cleanup job yet.

### No `accepted_by_user_id`

The schema still records `accepted_at` but not the accepting user id. Membership rows provide practical evidence, but auditability could improve later.

## Follow-up Work

### Phase 2

Recommended next work:

- Add account-level onboarding route outside `(workspace)`.
- Redirect unresolved signup/signin sessions through onboarding.
- Stop dashboard bootstrap from being the first join-or-create decision point.
- Use `discoverPendingWorkspaceInvitesAction()` before workspace creation.
- Use `acceptWorkspaceInviteAction()` from the explicit "Join workspace" UI.

### Phase 3

Recommended next work:

- Add existing-user invitation surfaces.
- Add account/inbox/dashboard reminder cards.
- Add minimal active workspace selection if existing users can belong to multiple workspaces.
- Improve owner invite management states.
- Optionally add copyable invite links.
