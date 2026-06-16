# Youin Chrome Extension

The extension is a Plasmo app that adds Youin review tools to live web pages. It handles popup auth, review mode, page capture, in-page badges, local persistence, Supabase sync, and migration of older local pins after sign-in.

## Local Setup

From the repository root:

```bash
corepack enable
pnpm install
cp apps/extension/.env.example apps/extension/.env
```

Set these variables in `apps/extension/.env`:

```bash
PLASMO_PUBLIC_SUPABASE_URL=
PLASMO_PUBLIC_SUPABASE_KEY=
PLASMO_PUBLIC_WEB_APP_URL=http://localhost:3000
```

Use the same development Supabase project as the web app. Keep `apps/extension/.env` out of commits.

## Run

Start the web app first when testing sign-in:

```bash
pnpm dev:web
```

Then start the extension:

```bash
pnpm dev:extension
```

Load the development build in Chrome:

1. Open `chrome://extensions`.
2. Enable Developer Mode.
3. Click Load unpacked.
4. Select `apps/extension/build/chrome-mv3-dev`.

If the extension does not refresh after a change, reload it from `chrome://extensions` and refresh the page being reviewed.

## Scripts

```bash
pnpm --filter @youin/extension dev
pnpm --filter @youin/extension build
pnpm --filter @youin/extension package
```

Run `build` before opening a PR that changes extension runtime code. Run `package` when preparing a browser-store bundle.

## Structure

| Path                         | Purpose                                                     |
| ---------------------------- | ----------------------------------------------------------- |
| `popup.tsx`                  | Popup UI, auth states, and entry points into review mode.   |
| `background/index.ts`        | Background service worker and OAuth bridge receiver.        |
| `contents/review-mode.ts`    | Content-script review mode orchestration.                   |
| `contents/widget.tsx`        | Floating review widget.                                     |
| `contents/capture-panel.tsx` | Docked capture, feedback list, and thread UI.               |
| `contents/pin-badges.tsx`    | Feedback badge rendering.                                   |
| `lib/auth.ts`                | Extension auth helpers and cross-context session detection. |
| `lib/supabase.ts`            | Supabase client using Chrome storage.                       |
| `lib/migrate.ts`             | One-shot local data migration after sign-in.                |
| `lib/storage.ts`             | Local persistence and workspace mirrors.                    |
| `lib/sync.ts`                | Sync queue behavior.                                        |

## Permissions

The extension runs on `http://*/*` and `https://*/*` because the core workflow is spatial review on arbitrary customer websites. Content scripts provide the floating review button, inspect mode, in-page feedback badges, and the capture panel.

Required permissions:

- `storage`: persists local-first feedback, workspace mirrors, auth session state, privacy settings, and retry queues.
- `tabs`: starts review mode from the popup on the active tab and reads the current page URL for page-scoped counts.
- `scripting`: injects the review UI into an already-open tab when Chrome has not loaded the content scripts yet.
- `host_permissions` for HTTP/HTTPS pages: injects the review UI and captures selected elements on pages the user reviews.

Privacy controls live in the popup settings:

- Element screenshots can be disabled.
- DOM context capture can be disabled.
- The extension can be disabled per domain.

Current limitation: review UI runs in the top frame only. Same-origin iframe, cross-origin iframe, and Shadow DOM targeting need a separate selector and positioning pass after the core health, drawer, and edit flows stabilize.

## Review Checklist

- Test popup sign-in and sign-out.
- Test Google sign-in through the extension bridge.
- Test review mode on at least one HTTP or HTTPS page.
- Capture both element feedback and area screenshot feedback.
- Confirm captured marks sync to the web app workspace, then reopen the popup and confirm the sync state still reads correctly.
- Force a failed sync, for example by stopping the web app or going offline, then confirm Retry sync reports the real error and recovers.
- Confirm remote marks pull back into the extension after a manual sync.
- Open a stale or approximate mark and verify scroll-to-saved-position, reattach element, and copy AI prompt actions.
- Confirm the current-domain disable toggle hides the widget, badges, and drawer.
- Confirm disabled screenshot and DOM-context settings are respected.
- Reload the unpacked extension after manifest, background, or content-script changes.

Automated checks:

```bash
pnpm --filter @youin/extension typecheck
pnpm --filter @youin/extension test
pnpm --filter @youin/extension build
```
