# Phase 2 Implementation Report: Onboarding Gate And Explicit Join-Or-Create Flow

## Summary

Phase 2 moves the workspace decision out of dashboard bootstrap and into a dedicated onboarding gate.

Users no longer receive a workspace as an incidental side effect of visiting `/dashboard`, a workspace route, or the extension API. The new flow is:

```text
Signed-in user
-> has workspace membership?
   -> yes: dashboard
   -> no: onboarding
      -> pending invite exists: show invite first, join workspace
      -> no pending invite: create workspace explicitly
```

This phase uses the Phase 1 invitation discovery and acceptance primitives. It does not implement Phase 3 surfaces such as inbox reminders, notification banners, workspace switching, or multi-workspace UX.

## Runtime Flow Before

Before Phase 2, workspace resolution and workspace creation were coupled inside `ensureWorkspaceForUser()`.

```text
User signs in
-> /dashboard
-> workspace layout
-> getCurrentWorkspaceShellBootstrap()
-> getWorkspaceSession()
-> ensureWorkspaceForUser()
   -> existing membership? return workspace
   -> pending invite? attach automatically
   -> otherwise bootstrap a new workspace
-> dashboard
```

This meant:

- A user could receive a new personal workspace without an explicit choice.
- A pending invitation could be accepted implicitly before the user saw it.
- `/dashboard` was doing product onboarding work.
- The extension API could also trigger workspace creation.

## Runtime Flow After

After Phase 2, workspace routes only resolve existing memberships.

```text
User signs in
-> /onboarding
-> resolve existing membership
   -> found: redirect dashboard
   -> not found: discover pending invites
      -> invite found: show join cards
      -> no invite: show create workspace form
```

Dashboard entry now behaves like this:

```text
User visits /dashboard
-> workspace layout
-> resolve existing membership only
   -> anonymous: redirect login
   -> unresolved: redirect onboarding
   -> authenticated: render dashboard
```

Workspace creation now happens only through `createOnboardingWorkspaceAction()`, after the user submits the onboarding create form.

## Files Changed

### `apps/web/src/lib/workspace/workspace-bootstrap.ts`

Responsibility:

- Profile sync, workspace membership resolution, and explicit workspace creation.

Changes:

- Added `resolveWorkspaceForUser()` for existing membership lookup only.
- Added `createWorkspaceForUser()` for explicit workspace creation.
- Changed `ensureWorkspaceForUser()` so it no longer creates or attaches; it now throws if onboarding is required.
- Kept `bootstrap_workspace` RPC usage intact behind explicit creation.

### `apps/web/src/lib/workspace/actions/session.ts`

Responsibility:

- Current authenticated workspace session.

Changes:

- Added `getWorkspaceSessionResult()` with three states:
  - `anonymous`
  - `unresolved`
  - `authenticated`
- Updated session resolution to call `resolveWorkspaceForUser()` instead of creating a workspace.

### `apps/web/src/lib/workspace/server-read-models.ts`

Responsibility:

- Server-side read model loaders for current workspace routes.

Changes:

- Handles the new `unresolved` session state.
- Returns `unresolved` instead of treating no-workspace users as bootstrap failures.

### `apps/web/src/app/(workspace)/layout.tsx`

Responsibility:

- Protected workspace shell.

Changes:

- Redirects unresolved signed-in users to `/onboarding?next=/dashboard`.
- Continues redirecting anonymous users to login.
- Continues treating real bootstrap errors as incomplete auth/error state.

### `apps/web/src/app/onboarding/layout.tsx`

Responsibility:

- Onboarding visual shell.

Changes:

- Uses the existing `AuthShellLayout` so onboarding is account-level and outside the workspace app shell.

### `apps/web/src/app/onboarding/page.tsx`

Responsibility:

- Server-side onboarding gate.

Changes:

- Requires a signed-in user.
- Redirects users with existing workspace membership to the requested next path.
- Discovers pending invitations for users with no workspace.
- Passes invite cards or workspace creation defaults to the client view.

### `apps/web/src/app/onboarding/onboarding-client.tsx`

Responsibility:

- Client-side join-or-create UI.

Changes:

- Shows pending invitations first when any exist.
- Allows explicit invitation acceptance through `acceptWorkspaceInviteAction()`.
- Shows explicit workspace creation form only when there are no pending invites.
- Redirects to dashboard after join or create.

### `apps/web/src/lib/workspace/actions/onboarding.ts`

Responsibility:

- Explicit workspace creation action for onboarding.

Changes:

- Added `createOnboardingWorkspaceAction()`.
- Validates workspace name.
- Calls `createWorkspaceForUser()` after authenticated user intent.
- Revalidates dashboard/account/onboarding paths.

### `apps/web/src/lib/workspace/actions/index.ts`

Responsibility:

- Workspace action exports.

Changes:

- Exports onboarding workspace creation action and types.

### `apps/web/src/app/auth/callback/route.ts`

Responsibility:

- Supabase auth callback.

Changes:

- Default post-auth redirect is now `/onboarding` instead of `/dashboard`.

### `apps/web/src/app/login/page.tsx`

Responsibility:

- Sign-in form.

Changes:

- Default post-login destination is now `/onboarding`.
- Existing `next` handling remains intact.

### `apps/web/src/app/signup/page.tsx`

Responsibility:

- Account creation.

Changes:

- Signup now defaults to `/onboarding`.
- Signup now collects account/profile setup only.
- Workspace metadata can still seed onboarding defaults, but workspace creation happens in onboarding.

### `apps/web/src/lib/supabase/middleware.ts`

Responsibility:

- Auth session refresh and route protection.

Changes:

- Protects `/onboarding`.
- Redirects signed-in login/signup users to `/onboarding` by default.

### `apps/web/src/app/api/extension/marks/route.ts`

Responsibility:

- Extension mark API authorization and workspace resolution.

Changes:

- Uses `resolveWorkspaceForUser()` instead of implicit workspace creation.
- Returns `409` with onboarding-required copy if the user has no workspace.

## Engineering Decisions

### Decision: Add `/onboarding` Outside `(workspace)`

Why:

- The onboarding decision must happen before workspace shell bootstrap.
- `(workspace)` routes assume a workspace exists and load workspace read models.

Alternative considered:

- Put onboarding under the workspace layout.

Why rejected:

- That would keep onboarding dependent on the same bootstrap path that previously created workspaces.

Future implication:

- Phase 3 can add account-level invitation surfaces without coupling them to workspace data.

### Decision: Keep Existing Workspace Routes Workspace-Scoped

Why:

- Phase 2 is not a route architecture rewrite.
- Current dashboard/account/inbox/views surfaces depend on a single current workspace.

Alternative considered:

- Add workspace ids to URLs now.

Why rejected:

- That is multi-workspace infrastructure and belongs later.

Future implication:

- The resolver now has a clean unresolved state, which can later evolve into active workspace selection.

### Decision: Do Not Auto-Accept Invites In Bootstrap

Why:

- The approved UX requires visible, explicit acceptance.
- Pending invitations should appear before dashboard access.

Alternative considered:

- Continue auto-attaching invites but redirect no-invite users to onboarding.

Why rejected:

- That would still hide the invitation decision.

Future implication:

- Invitation acceptance UI can now be tested independently of dashboard bootstrap.

### Decision: Leave Phase 1 RPCs Intact

Why:

- Phase 2 only changes when the RPCs are called.
- Discovery and acceptance were already hardened in Phase 1.

Alternative considered:

- Rewrite acceptance logic during onboarding work.

Why rejected:

- That would mix UI flow changes with lower-level database behavior and increase risk.

## Product Reasoning

### Invitation-First

If a pending invite exists, onboarding shows that invitation immediately. The user does not land in a personal dashboard first and does not have to check Inbox.

### Explicit Workspace Creation

Workspace creation is now a product choice. If no invitation exists, onboarding asks the user to create a workspace and calls the creation action only after form submission.

### Clear Ownership Of Flow

Dashboard is now for users who already belong to a workspace. Onboarding is for users who need to decide how they get a workspace.

## Edge Cases

### Existing Member Opens `/onboarding`

The server page resolves the existing membership and redirects to dashboard.

### Signed-Out User Opens `/onboarding`

Middleware and the page both route the user to login with `next=/onboarding`.

### No Workspace, Pending Invite

The onboarding page shows invitation cards and no create workspace form.

### No Workspace, No Invite

The onboarding page shows the workspace creation form.

### Accepted/Expired/Revoked Invite After Page Load

Acceptance returns a structured status from Phase 1. The UI shows a clear error and does not create a workspace.

### Extension Used Before Onboarding

The API returns `409` and does not create a workspace.

### Existing User With A Workspace Gets Invited Later

This remains Phase 3. Existing users with a workspace are redirected to dashboard, not forced through onboarding.

## Manual Testing Guide

### Scenario 1: New User With Pending Invite

1. Owner invites `hind@example.com`.
2. Hind signs up or signs in with `hind@example.com`.
3. Hind lands on `/onboarding`.
4. Hind sees the invitation card before dashboard access.
5. Hind clicks "Join workspace."

Expected:

- Hind becomes a workspace member.
- Invite status becomes accepted.
- Hind is redirected to `/dashboard`.
- No personal workspace is created.

### Scenario 2: New User With No Invite

1. Sign up with an email that has no pending invites.
2. Land on `/onboarding`.
3. Fill workspace name and project name.
4. Submit the create form.

Expected:

- Workspace is created only after submit.
- User becomes owner.
- Default project is created.
- User is redirected to `/dashboard`.

### Scenario 3: Signed-In User With No Workspace Opens Dashboard

1. Use an authenticated account with no `workspace_members` row.
2. Visit `/dashboard`.

Expected:

- User redirects to `/onboarding`.
- No workspace is created automatically.

### Scenario 4: Existing Member Opens Onboarding

1. Sign in as a user who already belongs to a workspace.
2. Visit `/onboarding`.

Expected:

- User redirects to `/dashboard`.

### Scenario 5: Extension Before Onboarding

1. Authenticate extension as a user with no workspace.
2. Try fetching or creating marks.

Expected:

- API returns onboarding-required error.
- No workspace is created.

## Risks

### Existing Multi-Workspace Ambiguity Remains

The resolver still returns the first membership it finds. Phase 2 does not add active workspace selection.

### Existing Users Invited Later Need Phase 3

Users who already have a workspace will not see invite discovery before dashboard. That requires a dashboard/account/inbox surface.

### Race On Workspace Creation

The create action checks for existing membership before creating, but two simultaneous submissions could still race at the database level. The UI disables duplicate submission, and stronger idempotency can be added later.

### Signup Still Stores Workspace Defaults

Signup may still store default workspace metadata, but it no longer creates a workspace. Onboarding uses this only as a prefill.

## Follow-up Work For Phase 3

- Add existing-user invitation discovery surfaces.
- Add account/dashboard/inbox invitation reminders.
- Add a minimal active workspace concept before broader multi-workspace support.
- Add copyable invite links if needed.
- Improve owner invite status management and revoked/expired visibility.

