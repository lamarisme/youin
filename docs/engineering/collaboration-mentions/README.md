# Collaboration Mentions Engineering Docs

This folder documents the engineering work for structured collaboration mentions in YouIn.

Collaboration Mentions cover parsing `@username` text, resolving mentions against workspace members, persisting mention facts, integrating the TipTap editor runtime, and projecting mention activity into Inbox.

## Available documents

- `IMPLEMENTATION_REPORT.md` - implementation report covering feature scope, architecture, runtime behavior, persistence, Inbox integration, validation, and future evolution.

## Recommended reading order

1. `IMPLEMENTATION_REPORT.md` executive summary
2. `IMPLEMENTATION_REPORT.md` feature structure and responsibilities by layer
3. `IMPLEMENTATION_REPORT.md` architecture, domain model, and persistence sections
4. `IMPLEMENTATION_REPORT.md` Inbox integration, limitations, and future evolution sections

## Related source-code areas

- `packages/domain/src/mentions/`
- `apps/web/src/lib/workspace/mentions.ts`
- `apps/web/src/lib/workspace/actions/comments.ts`
- `apps/web/src/components/dashboard/`
- `apps/web/src/lib/workspace/inbox-query.ts`
- `apps/web/src/app/(workspace)/inbox/`
