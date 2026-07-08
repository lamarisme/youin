# Inbox Engineering Docs

This folder contains the maintained engineering documentation for the YouIn Inbox.

The Inbox model has two separate concerns:

- **Canonical read model:** immutable activity facts plus per-activity read state.
- **Presentation model:** grouped Inbox cards, navigation metadata, and visible representative selection.

## Maintained Documents

Read these documents in this order:

1. `READ_UNREAD_BEHAVIOR.md`
   - Product-facing read/unread rules.
   - Defines when an Inbox activity is considered read.

2. `INBOX_READ_ARCHITECTURE.md`
   - Architecture record for canonical Inbox activities and read-state storage.
   - Explains why read state is activity-based.

3. `INBOX_GROUPING_V2_ARCHITECTURE.md`
   - Current presentation grouping architecture.
   - Defines Presentation Groups, classifier ownership, navigation, acknowledgement candidates, and priority rules.

4. `INBOX_QA_CHECKLIST.md`
   - Manual QA checklist for canonical read behavior and presentation grouping.

## Historical Planning Documents

`INBOX_READ_IMPLEMENTATION_PLAN.md` is retained as historical migration context for the canonical read model. It is not the current source of truth for runtime behavior.

Completed temporary plans, exploratory QA reports, account-specific test notes, and investigation scratch files should not live in this folder. Capture follow-up work in the issue tracker instead.

## Runtime Ownership

| Concern | Runtime owner |
| --- | --- |
| Canonical activity facts | `apps/web/src/lib/workspace/inbox-canonical.ts` |
| Inbox query and normalization | `apps/web/src/lib/workspace/inbox-query.ts` |
| Presentation classification | `apps/web/src/lib/workspace/inbox-presentation-classifier.ts` |
| Presentation projection | `apps/web/src/lib/workspace/inbox-presentation-projection.ts` |
| Presentation priority | `apps/web/src/lib/workspace/inbox-presentation-priority.ts` |
| Navigation contract | `apps/web/src/lib/workspace/inbox-navigation.ts` |
| Read-state validation and writes | `apps/web/src/lib/workspace/inbox-read-state.ts` |
| Server actions | `apps/web/src/lib/workspace/actions/inbox.ts` |

## Documentation Rules

- Keep this folder free of real user emails, local QA accounts, screenshots, and environment-specific data.
- Keep product decisions separate from implementation plans.
- Update the architecture docs when behavior changes.
- Update the QA checklist when adding a new Inbox activity family or acknowledgement rule.
