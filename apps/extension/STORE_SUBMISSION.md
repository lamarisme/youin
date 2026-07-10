# Youin Chrome Web Store Submission

## Upload artifact

- Package: `apps/extension/build/chrome-mv3-prod.zip`
- Build command: `pnpm --filter @youin/extension package`
- The package script builds, finalizes the production manifest, removes development-only bridge origins, creates the zip, and verifies that every manifest file reference exists.

## Listing basics

- Name: `Youin`
- Category: `Developer Tools`
- Homepage URL: `https://youin.click`
- Privacy policy URL: `https://youin.click/privacy`
- Support email: `support@youin.click`
- Single purpose: Capture page-level and element-level visual feedback on websites and sync it to a Youin workspace.

## Short description

Visual feedback for live websites. Mark elements, capture context, and sync comments to your Youin workspace.

## Detailed description

Youin adds a focused visual feedback layer to live websites. Product, design, QA, and client-review teams can mark page elements, capture screenshots and DOM context, add comments, and sync feedback to a shared Youin workspace without leaving the page.

Core workflows:

- Start a review session from the extension popup or floating page widget.
- Mark a specific element or screenshot region on the current page.
- Save page URL, title, selector, viewport metadata, optional DOM context, optional screenshots, and comments.
- Sync local feedback to the Youin dashboard.
- Reopen page feedback, view mark badges, and jump back to saved context.
- Disable screenshots, disable DOM context capture, or disable Youin on specific domains.

## Permission justifications

- `storage`: Stores local-first feedback, auth session state, selected workspace/project, sync queues, widget preferences, and per-domain privacy settings.
- `tabs`: Reads the active tab URL/title so Youin can scope feedback to the current page and open the dashboard or auth bridge when requested.
- `activeTab`: Allows Youin to work with the page the user is actively reviewing after a direct user action.
- `scripting`: Injects review UI scripts into the active tab when Chrome has not already loaded the content scripts.
- `host_permissions` for `http://*/*` and `https://*/*`: Required because the product's purpose is spatial review on arbitrary customer websites. Content scripts render the floating widget, capture panel, review overlay, and page feedback badges only on reviewable web pages.

## Data disclosure guide

Disclose the data collected by the extension and service:

- Account data: name, email address, authentication provider, workspace membership, and workspace settings.
- User content: marks, comments, project names, labels, statuses, mentions, attachments, and audit activity.
- Website content: page URL, page title, selected element selector, sanitized DOM context, viewport/browser metadata, and screenshots when enabled.
- Authentication/session data: Supabase auth session state stored in Chrome storage for signed-in sync.
- Operational data: request logs, browser/device metadata, support messages, and error details used for reliability, security, abuse prevention, and support.

Declare that Youin does not sell user data, does not use extension data for advertising or unrelated profiling, does not use customer content to train third-party models, and complies with the Chrome Web Store User Data Policy including Limited Use requirements.

## Pre-submit checks

- `pnpm --filter @youin/extension typecheck`
- `pnpm --filter @youin/extension test`
- `pnpm --filter @youin/extension package`
- `pnpm --filter @youin/web test`
- `pnpm --filter @youin/web build`
- Confirm the packaged manifest has no `externally_connectable` entry.
- Confirm the production `chromiumapp.org/auth/callback` URL is allowlisted in Supabase Auth.
- Confirm `https://youin.click/privacy` and `https://youin.click/terms` are deployed before submitting.
- Confirm production `PLASMO_PUBLIC_SUPABASE_URL`, `PLASMO_PUBLIC_SUPABASE_KEY`, and `PLASMO_PUBLIC_WEB_APP_URL=https://youin.click` are used for the submitted package.
- Confirm `SUBMIT_KEYS` is configured before running `.github/workflows/submit.yml`.
