# Phase 2 Invite Acceptance Fix Report

## Summary

Clicking "Join workspace" failed because the live `accept_workspace_invite` RPC referenced database objects ambiguously or incorrectly inside PL/pgSQL.

The original browser error reported:

- code: `42704`
- operation: `acceptWorkspaceInviteAction({ inviteId })`
- invite id: `916ccde8-6698-4371-a915-81b96101ce2b`

Investigation showed that migration `0019` had been applied, and PostgREST was running that latest function definition. The problem was not a stale migration. The problem was the object name used by the migration:

```sql
ON CONFLICT ON CONSTRAINT workspace_members_pkey DO NOTHING
```

That constraint does not exist in this schema. The actual primary-key constraint is:

```sql
workspace_members_workspace_id_user_id_pk
```

After fixing that, a real acceptance test exposed one additional PL/pgSQL ambiguity in the same function: bare `status` references inside `UPDATE public.workspace_invites ... WHERE status = 'pending'` conflicted with the RPC output column named `status`.

## Root Cause

### First Failure: `42704`

Exact failing SQL statement:

```sql
INSERT INTO public.workspace_members (workspace_id, user_id, role, username)
VALUES (...)
ON CONFLICT ON CONSTRAINT workspace_members_pkey DO NOTHING;
```

Exact missing PostgreSQL object:

```text
constraint workspace_members_pkey
```

Why it failed:

- Drizzle created the composite primary key with the explicit generated name `workspace_members_workspace_id_user_id_pk`.
- The hotfix migration `0019` assumed PostgreSQL's default `{table}_pkey` naming convention.
- Because the function is PL/pgSQL, the invalid constraint name was not caught at function creation time. It failed only when the `INSERT ... ON CONFLICT` branch executed.

### Second Failure Found During Validation: `42702`

Exact failing SQL statement:

```sql
UPDATE public.workspace_invites
SET status = 'accepted', accepted_at = now()
WHERE id = v_invite.id
  AND status = 'pending';
```

Exact ambiguous object:

```text
column reference status
```

Why it failed:

- `accept_workspace_invite` returns a table with an output column named `status`.
- The function also updates a table column named `status`.
- In PL/pgSQL, bare `status` could refer to either the output variable or the table column.

## Database State Found

### Workspace Members Constraint

Live database constraints on `public.workspace_members`:

```text
workspace_members_workspace_id_user_id_pk
  PRIMARY KEY (workspace_id, user_id)

workspace_members_user_id_profiles_id_fk
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE

workspace_members_workspace_id_workspaces_id_fk
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
```

Conclusion:

- `workspace_members_pkey` does not exist.
- `workspace_members_workspace_id_user_id_pk` is the correct conflict target.

### Migration State

Live database had migration `0019` applied before this fix:

```text
18  0018_workspace_invitation_phase_1
19  0019_fix_invite_acceptance_conflict
```

After this fix, migration `0021` is applied:

```text
18  0018_workspace_invitation_phase_1
19  0019_fix_invite_acceptance_conflict
20  0020_fix_invite_acceptance_constraint_name
21  0021_fix_invite_acceptance_status_ambiguity
```

### RPC Definition State

Before the fix:

- The live RPC used `workspace_members_pkey`.
- That did not match the database.

After the fix:

- The live RPC uses `workspace_members_workspace_id_user_id_pk`.
- The live RPC aliases `workspace_invites` updates as `wi`.
- The live RPC no longer uses `workspace_members_pkey`.

## Actions Taken

### 1. Verified Constraint Names

Queried `pg_constraint` for `public.workspace_members`.

Result:

- Confirmed the actual primary-key constraint is `workspace_members_workspace_id_user_id_pk`.
- Confirmed `workspace_members_pkey` does not exist.

### 2. Verified Migration History

Queried `drizzle.__drizzle_migrations`.

Result:

- Confirmed `0019` was applied correctly.
- Confirmed the failure was not caused by an unapplied migration.

### 3. Verified Live RPC Definition

Queried `pg_get_functiondef(...)` for `accept_workspace_invite`.

Result:

- Confirmed Supabase was running the repository's `0019` function body.
- Confirmed PostgREST was not the source of the `42704` mismatch.

### 4. Added Migration `0020`

Created:

- `apps/web/drizzle/0020_fix_invite_acceptance_constraint_name.sql`

Change:

```sql
ON CONFLICT ON CONSTRAINT workspace_members_workspace_id_user_id_pk DO NOTHING
```

Also updated:

- `apps/web/supabase/onboarding-rpcs.sql`
- `apps/web/drizzle/meta/_journal.json`

### 5. Tested Acceptance And Found Second Ambiguity

After `0020`, a real RPC acceptance test reached the later update statement and failed with:

```text
42702 column reference "status" is ambiguous
```

### 6. Added Migration `0021`

Created:

- `apps/web/drizzle/0021_fix_invite_acceptance_status_ambiguity.sql`

Change:

```sql
UPDATE public.workspace_invites AS wi
SET status = 'accepted', accepted_at = now()
WHERE wi.id = v_invite.id
  AND wi.status = 'pending';
```

The expired-invite update was also fixed:

```sql
UPDATE public.workspace_invites AS wi
SET status = 'expired'
WHERE wi.id = v_invite.id
  AND wi.status = 'pending';
```

Also updated:

- `apps/web/supabase/onboarding-rpcs.sql`
- `apps/web/drizzle/meta/_journal.json`

### 7. Applied Migrations

Ran:

```bash
pnpm --filter @youin/web db:migrate
```

Then notified PostgREST:

```sql
notify pgrst, 'reload schema';
```

## Validation Results

### Live RPC Definition

Verified after migration:

```text
USES_CORRECT_CONSTRAINT true
USES_OLD_CONSTRAINT false
USES_ALIASED_ACCEPTED_UPDATE true
```

### Scenario Test

Scenario:

```text
Kanata invites Hind
-> Hind signs in
-> Onboarding
-> Join Workspace
```

Tested invite:

```text
916ccde8-6698-4371-a915-81b96101ce2b
```

Before acceptance:

```text
invite status: pending
expires_at: 2026-06-22
matching auth user: exists
matching profile: exists
existing membership: none
```

Acceptance result:

```json
{
  "status": "accepted",
  "workspace_id": "47a41540-cf40-4f69-a974-0d193c77b317",
  "invite_id": "916ccde8-6698-4371-a915-81b96101ce2b"
}
```

After acceptance:

```text
invite status: accepted
accepted_at: set
workspace_members role: member
member user id: 0adcb1c5-9d17-4667-986b-dce35e8922b3
workspace id: 47a41540-cf40-4f69-a974-0d193c77b317
```

## Final Status

The invite acceptance RPC is fixed in:

- repository SQL setup
- Drizzle migrations
- live Supabase database
- PostgREST schema cache

The tested Kanata -> Hind invite has been accepted successfully, and the membership row exists.

## Remaining Note

Because the specific pending invite from the browser error was accepted during validation, Hind should now refresh or revisit `/onboarding`. Since Hind now has workspace membership, the onboarding gate should redirect to `/dashboard`.

