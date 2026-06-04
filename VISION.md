# YouIn Vision

YouIn turns any website or web app into an interactive visual backlog.

Users can click directly on UI elements, create contextual marks, organize them into views, and generate implementation-ready prompts for AI coding agents such as Claude Code, Codex, Cursor, and other assistants.

Instead of maintaining disconnected TODO lists, screenshots, Slack threads, and vague client notes, the backlog lives directly on top of the interface being built.

## One-Sentence Pitch

YouIn is a visual backlog that lives directly on top of your UI, allowing developers, teams, and clients to create contextual tasks and AI-ready prompts by clicking on the interface itself.

## Category

YouIn is best understood as a spatial backlog for web applications.

The product is not only a screenshot annotation tool. It is a work layer mapped onto the live product. Every task, comment, status, label, and future integration should be grounded in the exact interface moment that created it.

Initial positioning:

> Visual backlog for AI-assisted developers.

Mid-term positioning:

> Collaborative feedback layer for web applications.

Long-term positioning:

> The collaboration layer for software interfaces.

## Core Problem

Developers, founders, agencies, and product teams lose context whenever UI work leaves the interface.

- Screenshots become outdated as soon as the product changes.
- TODO lists are detached from the element that needs work.
- AI coding agents often receive vague prompts with missing page, selector, state, and visual context.
- Clients and stakeholders send feedback like "change this button" without a reliable way to identify the button.
- Product discussions get scattered across Slack, Linear, screenshots, Notion, email, and calls.

The work is spatial, but most planning tools are flat.

YouIn fixes this by attaching work directly to UI elements.

## Core Object: The Mark

Everything revolves around a Mark.

A Mark represents a piece of work attached to a real interface moment. It can be a bug, polish note, client comment, QA finding, product idea, or AI implementation request.

A Mark should carry:

- Page URL.
- DOM selector.
- Element or region screenshot.
- Browser, viewport, OS, and capture metadata.
- DOM snapshot or bounded element context.
- Title and description.
- Threaded notes or comments.
- Labels.
- Status and workflow status.
- Priority.
- Project and workspace ownership.
- Assignee.
- Generated AI prompt or prompt-ready context.
- Activity history.

The current codebase already reflects this object model. The web app schema stores marks with workspace, project, title, page, selector, viewport, browser, OS, DOM snapshot, screenshot URL, status, workflow status, priority, assignee, creator, labels, comments, and events. The Chrome extension captures element context locally, syncs marks to the workspace, and preserves screenshots and DOM snapshots when enabled.

## Product Principle

Every feature should make the Mark more useful.

That means improving one of five things:

- Capturing better context.
- Keeping context attached to the live UI.
- Organizing marks into useful work views.
- Turning marks into implementation-ready work.
- Connecting marks to the team's external workflow.

If a feature does not strengthen the Mark, it is probably secondary.

## Current Codebase Foundation

The repository is a pnpm monorepo with two primary product surfaces:

- `apps/web`: a Next.js App Router web app for authentication, workspace management, dashboards, inbox, projects, saved views, account settings, review links, and the extension OAuth bridge.
- `apps/extension`: a Plasmo Chrome extension for page review, element and region capture, in-page badges, capture panel UI, local persistence, Supabase sync, and local-to-workspace migration.

Shared packages support the product model:

- `packages/domain`: shared domain values such as mark statuses and priorities.
- `packages/design-tokens`: shared visual tokens used across web and extension surfaces.
- `packages/i18n`: product copy and translation helpers.

The current product already contains the foundation for several phases:

- Solo capture through the Chrome extension.
- Workspace-backed marks through Supabase and Drizzle.
- Projects, labels, workflow statuses, saved views, inbox, comments, assignees, and mark events.
- Extension authentication through the web app OAuth bridge.
- Public review link infrastructure through workspace review links and review-link API routes.

## Phase 1: Solo Developer MVP

Target users:

- Indie hackers.
- Solo founders.
- AI-assisted developers.

Goal:

Create a visual development companion.

Core workflow:

1. Open a website or web app.
2. Turn on YouIn review mode.
3. Click an element or drag a region.
4. Add a note describing the desired change.
5. Capture selector, URL, screenshot, viewport, and DOM context.
6. Generate a high-context prompt for an AI coding agent.
7. Copy the prompt into Claude Code, Codex, Cursor, or another assistant.
8. Track the mark through Todo, In Progress, and Done.

Key features:

- Chrome extension.
- Element click capture.
- Region screenshot capture.
- Note and description entry.
- Metadata capture.
- Screenshot storage.
- Labels.
- Statuses.
- Views and filters.
- Prompt generation for Claude Code and Codex.
- Copy prompt action.

Main value proposition:

> Click a UI element, describe the change, and instantly generate a high-context prompt for your coding agent.

Success metrics:

- Active users.
- Marks created per user.
- Prompt generations per user.
- Prompt copy rate.
- Marks resolved after prompt generation.

## Phase 2: Collaborative Workspaces

Target users:

- Small product teams.
- Designers, PMs, QA reviewers, and developers.
- Agencies working with internal team members.

Goal:

Move from personal productivity tool to team workflow tool.

Features:

- Shared workspaces.
- Team members.
- Shared projects.
- Shared views.
- Comments.
- Assignments.
- Activity history.
- Inbox notifications.
- Team labels and statuses.

Main value proposition:

> Figma comments, but for live websites and web applications.

Product direction:

YouIn should become the place where teams review live UI work before it becomes a clean external ticket. The mark keeps the page context, conversation, and ownership together.

## Phase 3: Embedded SDK

Target users:

- Product teams.
- SaaS companies.
- Teams doing internal QA, staging reviews, and product reviews.

Goal:

Become infrastructure instead of only a browser extension.

Installation:

```bash
npm install youin
```

The SDK should enable:

- Internal feedback.
- QA reviews.
- Staging reviews.
- Product reviews.
- Auth-aware in-app review surfaces.
- Review mode without requiring a Chrome extension.

Product direction:

The Chrome extension is the fastest way to make any page reviewable. The embedded SDK is the deeper product path because it lets teams install YouIn directly into their own applications, control permissions, and make review part of their development environment.

## Phase 4: Client Feedback System

Target users:

- Agencies.
- Freelancers.
- Client-facing product studios.

Goal:

Let non-technical clients point directly at problems instead of sending screenshots and emails.

Features:

- Public feedback mode.
- Guest review links.
- Visitor mark creation.
- Client-safe review UI.
- Separate internal team, client, and visitor views.
- Clear status visibility for feedback that has been accepted, rejected, in progress, or resolved.

Main value proposition:

> Let clients point directly at problems instead of sending screenshots and emails.

Product direction:

Client feedback should feel professional and low-friction. The client should not need to install an extension or learn a project management tool. They should open a review link, click the page, leave feedback, and trust that the team knows exactly what they meant.

## Phase 5: Workflow Integrations

Target users:

- Growing teams.
- Agencies.
- Product organizations with established delivery systems.

Goal:

Own the feedback workflow from UI observation to implementation and resolution.

Integrations:

- GitHub.
- Linear.
- Jira.
- Slack.
- Notion.

Example workflow:

1. Client leaves feedback.
2. Mark is created in YouIn.
3. Team triages and adds context.
4. Linear issue is generated.
5. Developer implements the change.
6. Status syncs back to YouIn.
7. Mark is closed automatically.

Product direction:

YouIn should not replace every system of record. It should preserve the spatial product context and sync the right work downstream into the tools teams already use.

## AI Workflow

AI is strongest when it receives precise context.

YouIn should generate prompts that include:

- User note.
- Page URL.
- DOM selector.
- Element screenshot.
- DOM snapshot.
- Visible text.
- Browser and viewport metadata.
- Expected outcome.
- Current status and labels.
- Any related comments.

The prompt should help an AI coding agent understand what the user saw, where it happened, and what needs to change.

AI should be a workflow accelerator, not the whole product. The durable value is the Mark: persistent UI memory, team context, and work state attached to the interface.

## Long-Term Moat

The moat is persistent UI memory.

Over time, YouIn can answer questions like:

- Which parts of this interface create the most feedback?
- Which component keeps receiving bugs?
- Which marks became stale after a deployment?
- Which pages have unresolved product polish?
- Which client feedback items are waiting on implementation?
- Which UI work was fixed in a linked pull request or issue?

This moves YouIn from feedback capture to a living map of product work.

## 12-Month Goal

First 3 months:

- Ship the extension.
- Make mark creation reliable.
- Add prompt generation.
- Support useful views and filters.
- Acquire the first 50 active users.

Months 4 to 6:

- Improve prompt quality.
- Polish the UX.
- Improve sharing and review flows.
- Convert first paying users.
- Reach EUR1k MRR.

Months 7 to 12:

- Add stronger workspace collaboration.
- Expand comments, assignments, and activity flows.
- Launch visitor or client feedback paths.
- Start workflow integrations.
- Reach EUR5k to EUR10k MRR.

## Product North Star

YouIn should make UI work impossible to lose.

When someone sees something on a live interface, they should be able to point at it once and create a mark that carries enough context for a developer, teammate, client, or AI agent to act without reconstructing the moment.
