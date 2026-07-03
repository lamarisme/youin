# Inbox Engineering Docs

This folder documents the engineering model, behavior, and validation for the YouIn Inbox.

The Inbox covers activity projection, read/unread state, grouped activity rendering, navigation back to workspace context, realtime/cache behavior, and related product questions.

## Available documents

- `INBOX_READ_ARCHITECTURE.md` - architecture review and proposal for Inbox activity and read-state modeling.
- `READ_UNREAD_BEHAVIOR.md` - behavior specification for read/unread rules and expected user-facing semantics.
- `QA_REPORT.md` - QA report covering end-to-end Inbox validation, exploratory findings, product observations, and follow-up marks.

## Recommended reading order

1. `READ_UNREAD_BEHAVIOR.md`
2. `INBOX_READ_ARCHITECTURE.md`
3. `QA_REPORT.md`

## Related source-code areas

- `apps/web/src/app/(workspace)/inbox/`
- `apps/web/src/lib/workspace/inbox-model.ts`
- `apps/web/src/lib/workspace/inbox-query.ts`
- `apps/web/src/lib/workspace/actions/inbox.ts`
- `apps/web/src/components/providers/workspace-realtime-provider.tsx`
