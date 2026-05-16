# YouIn Chrome Extension

## Permissions

The extension runs on `http://*/*` and `https://*/*` because the core workflow is spatial review on arbitrary customer websites. Content scripts provide the floating review button, inspect mode, in-page feedback badges, and the capture panel.

Required permissions:

- `storage`: persists local-first feedback, workspace mirrors, auth session state, privacy settings, and retry queues.
- `tabs`: starts review mode from the popup on the active tab and reads the current page URL for page-scoped counts.
- `host_permissions` for HTTP/HTTPS pages: injects the review UI and captures selected elements on pages the user reviews.

Privacy controls live in the popup settings:

- Element screenshots can be disabled.
- DOM context capture can be disabled.
- The extension can be disabled per domain.

Do not commit `apps/extension/.env`. Keep `apps/extension/.env.example` as the documented shape for local setup.
