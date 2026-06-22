# Dashboard QA Report

Date: 2026-06-22
Target: `http://localhost:3001`
Scope: authenticated dashboard, mark detail, saved views, inbox, command palette, account settings, mobile touch behavior, dialogs, and accessibility affordances.

## Summary

The live QA pass found a cluster of production polish issues rather than one large broken flow. Most problems were concentrated around mobile hit targets, destructive actions without confirmations, unlabeled rich-text or inline edit fields, stale overlays, and a few data/query edge cases.

Current status: fixed issues have been browser-verified and the web app passes tests and production build.

## Resolved Findings

| Area | Finding | Fix |
| --- | --- | --- |
| Dashboard search | Searching could crash from unsafe SQL string composition. | Replaced the sequence label expression with Postgres-safe concatenation. |
| Dashboard mobile | View controls could slide offscreen or become hard to reach. | Reworked the mobile view toolbar into a chip rail with a separate action cluster. |
| Dashboard view options | The mobile view-options menu was taller than the available viewport and initially hid `Save view` and `Manage views` below the scroll boundary. | Moved the action block to the top of the menu so the primary commands are immediately visible before the scrollable sort/group controls. |
| Dashboard page structure | Main dashboard lacked a primary heading for assistive tech. | Added a hidden `h1` for the dashboard route. |
| Dashboard row actions | Repeated row-level external page links all announced as `Open page in new tab`, making them indistinguishable in link lists. | Added mark-title context to the shared page-open/copy control so row, table, capture, and detail actions expose distinct accessible names. |
| Dashboard empty state | The no-project empty-state CTA linked to `/spaces`, but that route redirected straight back to the dashboard. | Pointed the CTA to `/account/projects` and made legacy `/spaces` URLs route to project settings or a project-filtered dashboard. |
| Mark detail | Sidebar preference state could hydrate differently between server and client. | Loaded persisted sidebar width/collapsed state after mount. |
| Mark detail | Title and page URL inline edit inputs had no accessible names. | Added `aria-label="Mark title"` and `aria-label="Page URL"`; set page input to `type="url"`. |
| Mark detail | Notes editor needed a stable accessible name. | Added explicit editor labels for mark notes and new mark descriptions. |
| Comments | Comment composer briefly rendered an external `label` before the Tiptap editor mounted, leaving a broken `for` association during hydration. | Removed the redundant external label and kept the editor's own `aria-label` as the stable accessible name. |
| Mark detail | Copy actions relied on a brittle clipboard path. | Added a shared clipboard helper with navigator and textarea fallback. |
| Comments | Comment composer and edit fields were unlabeled. | Added explicit labels for add and edit comment editors. |
| Comments | Delete and edit controls were too small on mobile. | Increased icon-button hit areas and used destructive dialog styling. |
| New mark | Invalid page URLs failed without clear inline feedback. | Added inline validation, `aria-invalid`, and stricter URL normalization. |
| Bulk actions | Selection copy could fail silently in restricted clipboard contexts. | Added fallback manual-copy dialog. |
| Bulk actions | Selected count and close/reopen wording were awkward for singular cases. | Added singular/plural copy and clearer status labels. |
| Saved views | Delete actions were too easy to trigger. | Added confirmation dialogs on list and detail pages. |
| Saved views | Detail delete could leave stale optimistic cache state. | Added optional non-optimistic delete behavior and success cache cleanup. |
| Saved views mobile | Row link tap target was below the mobile target floor. | Raised saved-view row links to at least 40px. |
| Saved views page structure | List/detail pages lacked primary headings for assistive tech. | Added hidden `h1` elements. |
| Command palette | `Create new mark` from mark detail routes could target the wrong route. | Route creation to `/dashboard?...&new=1` outside the exact dashboard page. |
| Command palette | Opening the palette while another overlay was open could stack UI layers. | Close transient overlays before opening the palette. |
| Command palette | The palette dialog exposed a dangling `aria-describedby` reference, and the search input's touch area was only text-line height on mobile. | Added a hidden dialog description and raised the mobile command input hit area to 40px. |
| Workspace switcher | Duplicate workspace names were indistinguishable. | Added `Current` and short ID disambiguation. |
| Account settings | Several destructive actions had no confirmation or weak destructive styling. | Added confirmations for labels, statuses, invites, review links, member removal, and danger-zone actions. |
| Account settings | Guest review link origin errors surfaced too late. | Added shared origin normalization and inline validation. |
| Account settings | Guest review link site origin accepted URL-like input but rendered as a plain text field. | Set the origin field to `type="url"` with URL input mode while preserving bare-host normalization and inline validation. |
| Account settings mobile | Inputs and menu items were below practical touch target sizes. | Updated shared input/dropdown primitives and specific account controls to meet mobile targets. |
| Account settings | Status rename input lacked a specific accessible name. | Added status-specific `aria-label` text. |
| Project settings | Project row links used the generic accessible name `Open`, which becomes ambiguous with multiple projects. | Added project-specific labels such as `Open Dashboard smoke test project marks`. |
| Integrations | Guest review script action copy did not lead to the actual management surface. | Renamed action to `Manage links` and deep-linked to team review links. |
| Inbox page structure | Inbox lacked a primary heading for assistive tech. | Added a hidden `h1`. |
| Full image preview | Dialog content lacked a description for screen readers. | Added hidden dialog description. |
| Onboarding redirect | Onboarded users could land on `/onboarding` with onboarding metadata while dashboard content rendered. | Added an onboarded-user handoff screen that replaces the URL with the intended workspace route. |
| Auth shell headings | Auth pages exposed the shell marketing headline and the form title as competing primary headings. | Made the shell headline non-heading copy and promoted reset/error panel titles to the single page `h1`. |
| Auth recovery mobile | Secondary footer links on reset/error pages were only text-height tap targets on mobile. | Raised those links to compact 40px inline-flex targets while keeping the same visual style. |
| Public pages mobile | Contact, privacy, and terms header/footer links were only text-height tap targets on narrow screens. | Raised those links to 40px inline-flex targets with consistent focus rings. |
| Not found page mobile | 404 recovery links and secondary auth links were too small for reliable touch use. | Raised header, shortcut, and footer recovery links to 40px targets while preserving the compact layout. |
| Not found metadata | The 404 route inherited the homepage document title, making fallback tabs/history hard to identify. | Converted the 404 page to a server component and added dedicated title and description metadata. |
| Not found copy | The visible 404 headline said "This route has no landing yet.", which read like internal routing jargon. | Changed the headline and aside note to user-facing page-not-found language while preserving recovery links. |
| Saved view missing state | A deleted or unknown saved-view URL had no page-level heading and a compact breadcrumb escape link on mobile. | Added a hidden `h1`, raised the missing-view action to 40px, and made breadcrumbs 40px on mobile while staying compact on desktop. |
| Account fallback metadata | Invalid account section URLs rendered the 404 UI while keeping an account-settings title. | Return `Page not found` metadata for invalid account section routes. |
| Account overview URL | `/account/overview` was a natural inferred URL but rendered the 404, unlike the other account section routes. | Treat `overview` as a valid section alias and render the overview tab with account metadata. |
| Profile shortcut | `/profile` advertised Profile settings metadata but redirected to the account overview tab. | Redirect `/profile` to `/account/profile` so the shortcut lands on the intended profile editor. |
| Team settings fields | Team fields relied on associated labels or placeholder text, which made automation and some assistive surfaces less explicit. | Added explicit accessible labels to the workspace username and review-link label inputs. |
| Mark detail page structure | Full-page mark detail could expose no route-level `h1` in the mobile detail shell. | Added a stable hidden `h1` for full-page mark detail and kept the editable visual title out of the primary-heading slot. |
| Detail route metadata | Mark detail and saved-view detail pages used generic browser titles, and missing saved views did not identify themselves in tab/history. | Added cached dynamic metadata so mark detail uses `YIN-#: title`, saved views use the saved view name, and missing views use `View not found`. |
| Missing mark route | Unknown mark URLs rendered a useful empty state but lacked a page heading, had a compact return action, and could borrow the wrong mark title in metadata. | Added a hidden `h1`, raised the return action to 40px, and made mark metadata match only the requested route param. |
| Mark detail mobile controls | Full-page mark detail still had several sub-40px editable controls on mobile. | Raised the editable title, page URL, notes, and label picker controls to 40px mobile targets while keeping desktop density. |

## Verification

- Browser-verified key flows on `localhost:3001`: dashboard search, saved-view delete, mark detail edits, comment controls, new mark validation, command palette, bulk actions, account confirmations, mobile hit targets, and heading exposure.
- Browser-verified public and fallback routes on `localhost:3001`: landing, contact, privacy, terms, 404, authenticated redirects, and workspace route fallbacks.
- Browser-verified 404 metadata: document title resolves to `Page not found | youin`, description is route-specific, mobile layout has no overflow, and visible controls meet the 40px target.
- Browser-verified `/definitely-not-a-route` and `/account/not-a-section` at 390px: visible `h1` now reads `Page not found.`, titles are correct, and there are no undersized controls or horizontal overflow.
- Browser-verified `/views/not-a-view`, `/account/not-a-section`, and `/account/team` at 390px: correct fallback headings/titles, no horizontal overflow, no undersized or unnamed visible controls, and no console warnings.
- Browser-verified `/account/overview` at 390px: renders the account overview tab with `Account settings` title, no horizontal overflow, and no undersized visible controls.
- Browser-verified `/profile` at 390px: redirects to `/account/profile`, highlights the Profile account section, keeps the `Profile settings` title, and has no console warnings, bad touch targets, or horizontal overflow.
- Browser-verified `/account/team` guest review origin at 390px: field is labeled, `type="url"`, uses URL input mode, remains 40px tall, and invalid input is tied to the inline error with `aria-invalid`.
- Browser-verified dashboard external page links at 390px: row links now announce the mark title, have no duplicate accessible names, remain 40px tall, and do not introduce horizontal overflow.
- Browser-verified project routing at 390px: `/spaces` redirects to `/account/projects`, `/spaces/<project-id>` redirects to the matching filtered dashboard URL, Project settings has no console warnings, no bad touch targets, no horizontal overflow, and project links announce the project name.
- Browser-verified `/dashboard/YIN-1` at 390px: hidden page heading resolves to `YIN-1: Pricing CTA spacing feels heavy`, no horizontal overflow, no undersized or unnamed visible controls, and no console warnings.
- Browser-verified `/dashboard/YIN-1` semantic associations at 390px: no broken `label[for]` references immediately after load, and the mounted comment composer exposes `role="textbox"` with `aria-label="Add a comment"`.
- Browser-verified command palette at 390px: dialog description resolves, no broken `aria-describedby`, search input is 40px tall, no undersized controls, and no horizontal overflow.
- Browser-verified dashboard view options at 390px: `Save view` and `Manage views` are initially visible, 40px tall, and contained within the viewport while the longer menu remains scrollable.
- Browser-verified dynamic detail metadata: `/dashboard/YIN-1` resolves to `YIN-1: Pricing CTA spacing feels heavy`, an existing saved view resolves to its view name, and `/views/not-a-view` resolves to `View not found`.
- Browser-verified `/dashboard/YIN-404` and `/dashboard/YIN-1` at 390px: correct titles/headings, no horizontal overflow, no undersized or unnamed visible controls, and no console warnings.
- `git diff --check`: passed.
- `pnpm --filter @youin/web test`: passed, 61 of 61 tests.
- `pnpm --filter @youin/web build`: passed.

## Remaining Watch Items

- Add a broader automated accessibility smoke test when the app has a stable Playwright test harness.
- Consider a dedicated fixture workspace with owner, member, and guest-like states so destructive account flows can be regression-tested without manual setup.
- Add a compact release checklist for mobile touch targets and destructive-action confirmation consistency.
