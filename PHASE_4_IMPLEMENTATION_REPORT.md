# Phase 4 Implementation Report: Active Workspace Selection

## Summary

Phase 4 adds the smallest active-workspace mechanism needed for existing users who accept invitations after they already own or belong to another workspace.

The implementation adds a nullable `profiles.current_workspace_id` pointer. Explicit invitation acceptance changes that pointer to the accepted workspace inside the same database transaction that creates membership and accepts the invitation. Workspace resolution now prefers the active workspace when the user still has membership and falls back deterministically when the pointer is missing or inaccessible.

No workspace switcher, multi-workspace management UI, workspace-id route, URL architecture change, or onboarding redesign was added.

## Runtime Flow Before

1. User owned or belonged to Workspace A.
2. User accepted an invitation to Workspace B from Inbox.
3. `accept_workspace_invite` created the Workspace B membership.
4. The invitation changed to `accepted`.
5. `resolveWorkspaceForUser()` selected the first membership returned by PostgreSQL.
6. The resolver had no explicit active-workspace preference or ordering.
7. Dashboard could continue loading Workspace A even though acceptance succeeded.

## Runtime Flow After

1. User owns or belongs to Workspace A.
2. User opens Inbox and selects `Join and open` for Workspace B.
3. `accept_workspace_invite` locks and validates the invitation.
4. The RPC creates the Workspace B membership if needed.
5. The RPC changes the invitation to `accepted`.
6. The same transaction updates `profiles.current_workspace_id` to Workspace B.
7. Inbox navigates to `/dashboard`.
8. `resolveWorkspaceForUser()` reads the active pointer.
9. The resolver confirms the user still has Workspace B membership.
10. Dashboard loads Workspace B.
11. Workspace A and all its data remain unchanged.

## Schema Changes

### `profiles.current_workspace_id`

Added:

```text
profiles.current_workspace_id uuid nullable
```

Constraint:

```text
FOREIGN KEY (current_workspace_id)
REFERENCES workspaces(id)
ON DELETE SET NULL
```

Index:

```text
profiles_current_workspace_id_idx
```

Why a profile column was chosen:

- One pointer is sufficient for the current MVP.
- It avoids introducing a preference table and its RLS/API surface.
- It preserves a direct path to a future workspace switcher: changing workspaces can update the same pointer.
- It does not change workspace membership or ownership.

### Backfill

Existing profiles are assigned their earliest membership using:

1. `workspace_members.created_at ASC`
2. `workspace_members.workspace_id ASC`

This preserves a stable existing workspace for current users and removes dependence on arbitrary database row order.

## Files Changed

### `apps/web/src/db/schema.ts`

- Adds `profiles.currentWorkspaceId`.
- Adds the workspace foreign key.
- Adds the active-workspace index.

### `apps/web/drizzle/0022_active_workspace_selection.sql`

- Adds the active-workspace column, foreign key, and index.
- Backfills existing users deterministically.
- Updates `bootstrap_workspace`.
- Updates `accept_workspace_invite`.

### `apps/web/drizzle/meta/_journal.json`

- Registers migration `0022_active_workspace_selection`.

### `apps/web/supabase/onboarding-rpcs.sql`

- Keeps the canonical Supabase RPC setup aligned with migration `0022`.
- Makes newly created workspaces active.
- Makes accepted workspaces active.

### `apps/web/src/lib/workspace/workspace-resolution.ts`

- Contains the small deterministic workspace-selection rule.

### `apps/web/src/lib/workspace/workspace-resolution.test.ts`

- Tests active selection, stale-pointer fallback, and no-membership behavior.

### `apps/web/src/lib/workspace/workspace-bootstrap.ts`

- Resolves the current profile pointer.
- Orders all memberships deterministically.
- Uses the active workspace only when membership still exists.
- Repairs missing or stale pointers using compare-and-swap semantics.

### `apps/web/src/app/(workspace)/inbox/inbox-view.tsx`

- Changes the action label to `Join and open`.
- Navigates successful acceptance to `/dashboard`.
- Does not treat an inconsistent `already_accepted` result without membership as successful workspace access.

## RPC Changes

### `accept_workspace_invite`

After valid acceptance:

1. Membership is inserted or confirmed.
2. Invitation is marked accepted.
3. `profiles.current_workspace_id` is updated to the accepted workspace.

All three operations occur inside the RPC transaction.

When an accepted invite is retried and membership exists:

- The RPC returns `already_member`.
- The accepted workspace is made active again.

When an accepted invite has no membership:

- The RPC returns `already_accepted`.
- The active workspace is not changed.

### `bootstrap_workspace`

After owner membership creation:

- The newly created workspace becomes `profiles.current_workspace_id`.

This keeps new-user workspace creation aligned with the same active-workspace model.

## Workspace Resolution

`resolveWorkspaceForUser()` now:

1. Synchronizes the profile.
2. Reads `profiles.current_workspace_id`.
3. Loads memberships ordered by creation time and workspace id.
4. Returns the pointer when the matching membership exists.
5. Otherwise returns the first deterministic membership.
6. Repairs the profile pointer when fallback is required.
7. Returns `null` when no membership exists.

The repair update uses the previously read pointer as a condition. This prevents a stale concurrent request from overwriting a newer workspace choice made by invitation acceptance.

## Engineering Decisions

### Profile Column Instead Of Preference Table

Chosen because Phase 4 needs one preference only. A new table would require more schema, policies, queries, and ownership rules without improving the MVP behavior.

### Membership Validation In The Resolver

The foreign key proves that the workspace exists, but not that the user remains a member. The resolver therefore verifies membership before using the pointer.

This safely handles:

- membership removal,
- stale manual data,
- workspace deletion,
- incomplete historical records.

### Transactional Activation

The accepted workspace is activated inside `accept_workspace_invite`, not in a second TypeScript database write.

This prevents a state where:

- invitation acceptance succeeds,
- membership exists,
- active-workspace persistence fails separately.

### Deterministic Fallback

Fallback uses explicit ordering instead of `LIMIT 1` without `ORDER BY`.

This prevents workspace selection from changing because of query plans, indexes, or physical row order.

### No Workspace Switching UI

Phase 4 stores the choice but does not expose general workspace management. The pointer is ready for a future switcher without requiring route changes now.

## Product Reasoning

The user's explicit `Join and open` action expresses two decisions:

1. Join Workspace B.
2. Open Workspace B now.

Making Workspace B active matches that intent. Keeping Workspace A memberships intact prevents data loss and preserves future multi-workspace support.

The dashboard remains workspace-id agnostic. This keeps the MVP small while making workspace behavior predictable.

## Edge Cases

### Missing Active Pointer

The resolver chooses the earliest membership deterministically and stores it as active.

### Active Workspace Membership Removed

The resolver ignores the stale pointer, falls back to another membership, and repairs the pointer.

### Active Workspace Deleted

The foreign key sets the pointer to `NULL`. The resolver falls back to another membership.

### User Has No Membership

The resolver returns `null`, preserving the Phase 2 onboarding gate.

### Duplicate Acceptance

If membership already exists, `already_member` reactivates the invited workspace and opens Dashboard.

### Accepted Invite Without Membership

The result remains `already_accepted`. The application does not activate or open a workspace the user cannot access.

### Concurrent Resolver And Invitation Acceptance

Resolver self-healing uses compare-and-swap. An older request cannot overwrite a newer active-workspace value written by invitation acceptance.

## Automated Validation

Commands run:

- `pnpm --filter @youin/web lint`
- `pnpm --filter @youin/web exec tsc --noEmit`
- `pnpm --filter @youin/web test`
- `pnpm --filter @youin/web build`

Results:

- Lint passed with two existing warnings in `src/components/motion.tsx`.
- Typecheck passed.
- Test suite passed: 45 tests.
- Production build passed.

New tests verify:

- A valid active workspace remains selected.
- An inaccessible pointer falls back deterministically.
- A user without memberships resolves to `null`.

## Migration Validation

Migration command:

```text
pnpm --filter @youin/web db:migrate
```

Live Supabase verification confirmed:

- `profiles.current_workspace_id` exists and is nullable.
- The workspace foreign key exists with `ON DELETE SET NULL`.
- `profiles_current_workspace_id_idx` exists.
- `bootstrap_workspace` contains active-workspace persistence.
- `accept_workspace_invite` contains active-workspace persistence.
- Existing profile backfill selected the user's original workspace.

## Real End-To-End Validation

Validation was performed against the live Supabase environment.

Existing user:

```text
test-agent@example.com
```

Workspace A before acceptance:

```text
Test Workspace
0a3195bb-5440-4a15-97fa-f60ff152d8f9
role: owner
```

Workspace B invitation:

```text
My workspace-kanata
477db39a-b27d-4a98-a989-b8babbfaa69e
invite: a1bebddf-cb77-442b-9a0c-97a7179feb05
```

Observed result:

- Invitation discovery returned Workspace B.
- Acceptance returned `accepted`.
- Workspace B membership was created with role `member`.
- Invitation status changed to `accepted`.
- `profiles.current_workspace_id` changed from Workspace A to Workspace B.
- The active pointer references a valid Workspace B membership.
- Workspace A owner membership remained present.
- Existing memberships were not deleted or hidden.

## Risks And Limitations

### No Workspace Switcher

After Workspace B becomes active, there is intentionally no UI for returning to Workspace A. The membership remains available for future switcher work.

### Account Preference Is Server-Controlled By Current Flows

The resolver validates membership before honoring the pointer. Future workspace-switching actions must perform the same membership check.

### Current URL Does Not Identify Workspace

Refreshing or navigating continues to use the active pointer. This is intentional for the MVP and avoids route redesign.

## Future Work

Future workspace-switcher work can:

1. List the user's existing memberships.
2. Update `profiles.current_workspace_id` after membership validation.
3. Refresh the existing workspace routes.

No Phase 5 or Phase 6 invitation surfaces or broader multi-workspace management were implemented here.
