# YouIn — Spatial Backlog Business Plan

YouIn turns a web app into a spatial backlog: every bug, comment, and task is anchored to the real UI element, kept in context across deployments, and synced with the team's development workflow.

> "Your product backlog, pinned to your actual UI."

## The sharper category

YouIn is not "visual feedback for websites." That market is already mature, with tools like Marker.io, BugHerd, Usersnap, Userback, Ruttl, Pastel, MarkUp.io, Atarim, and Feedbucket covering screenshots, pinned comments, browser metadata, and PM integrations.

The stronger category is:

**Spatial backlog for web apps.**

This makes the product feel closer to Linear or Jira mapped onto the live interface, not another client feedback widget. The job is not only to collect comments. The job is to make UI work live where the work exists.

## Core promise

1. **Turn any UI element into a task**
   - Click a button, card, modal, table row, or empty state.
   - Capture URL, selector, viewport, browser metadata, screenshot, and discussion.
   - Create a task without asking the reviewer to write a perfect ticket.
2. **Keep work attached to the product**
   - Tasks remain visible on the live interface.
   - Anchors use selector, viewport, and screenshot fallbacks.
   - Stale or moved annotations become explicit product state, not hidden confusion.
3. **Sync with the dev workflow**
   - Send ready issues to Linear first, then Jira and GitHub as later integrations.
   - Keep status, comments, and resolution connected so developers can stay in their tracker while reviewers stay on the product.

## The problem

1. **UI work is spatial, but backlogs are flat**
   - "Fix the spacing on the pricing CTA" is location-based work forced into prose.
   - Screenshots go stale as soon as the product changes.
2. **Feedback chains lose context**
   - Teams move from app to screenshot to Slack to Linear, then back to the app.
   - Each handoff drops the selected element, viewport, page state, and original intent.
3. **Client and stakeholder feedback is low quality by default**
   - Clients say "this button" because they are looking at the button.
   - Developers receive a detached sentence and have to reconstruct the moment.
4. **Existing tools frame the category as feedback collection**
   - That is useful, but it makes YouIn sound like a BugHerd or Marker.io clone.
   - The wedge is broader and sharper: product work mapped onto the product itself.

## Target market

### Primary wedge: web agencies

Agencies feel the pain financially. Messy client feedback creates meetings, rework, and trust issues. They also pay for tools that make reviews more professional.

- 5-50 person agencies building websites and web apps for clients.
- Need guest review links, client workspaces, status visibility, and predictable pricing.
- Main promise: client feedback without screenshots, Slack chaos, or vague tickets.

### Secondary wedge: small product teams

Small SaaS and product teams manage UI debt, QA, polish, and design feedback across PMs, designers, and developers.

- 3-15 person teams shipping a live web product.
- Need Linear-style workflow, but tied to the actual UI.
- Main promise: Linear for your actual interface.

### Tertiary wedge: solo builders

Solo builders love the concept, but willingness to pay is weaker. Keep the plan affordable and use it as a bottom-up entry point, not the main GTM bet.

- Indie devs and small teams using the npm dev dependency.
- Main promise: a spatial to-do list for your own app.

## MVP

Build the narrow version first.

1. Add script or Chrome extension.
2. Click an element.
3. Add a comment or task title.
4. Store selector, URL, viewport, screenshot, and browser metadata.
5. Show overlay pins on the live UI.
6. Status: open, in progress, resolved.
7. Share workspace with guests.
8. Create a Linear ticket.

Do not start with every integration, advanced AI, complex namespaces, mobile support, white label, or a full permissions matrix. The product must prove that spatial task creation is valuable before becoming a complete PM system.

## Killer feature: persistent UI memory

The long-term moat is not AI ticket generation. The moat is persistent UI memory.

Examples:

- "This button had 4 comments last sprint."
- "This annotation moved because the DOM changed."
- "This component appears on 12 pages."
- "This issue is probably related to the same component."
- "This UI area has recurring bugs."
- "This was fixed in commit X."
- "This annotation is stale because the element no longer exists."

That turns YouIn from a feedback tool into a spatial product management system. The app becomes a map of work.

## Product strategy

1. **Lead with spatial backlog**
   - Homepage language should say "backlog," "task," "Linear," "actual UI," and "context."
   - Avoid leading with "visual feedback," "website annotation," or "client comments."
2. **Linear first**
   - Linear is the best early integration for small product teams and modern agencies.
   - Jira and GitHub can follow, but they should not dilute the initial product shape.
3. **Guest links matter**
   - Extension install friction is real.
   - Agencies need a no-install client review path.
   - The extension should be a power-user path, not the only path.
4. **Anchor reliability is product quality**
   - Selector drift is not an implementation detail.
   - It is the difference between a delightful spatial backlog and stale screenshots with red dots.

## Pricing

Charge by active project or client workspace, not feedback count. Agencies hate unpredictable usage pricing.

### Solo

- **EUR19 / month**
- 1 active project
- Chrome extension + npm dev dependency
- Unlimited marks
- Linear export
- Spatial task history

### Studio

- **EUR49 / month**
- 3 active projects
- Guest review links
- Shared task threads
- Selector + viewport fallback
- Linear and Jira export

### Team

- **EUR99 / month**
- 10 active projects
- Everything in Studio
- Bidirectional status sync
- Team labels and saved views
- Priority workspace support

### Agency

- **EUR199 / month**
- Unlimited active projects
- Everything in Team
- Client workspaces
- White-label guest review
- Agency reporting

## Validation target

Do not spend six months building quietly.

Build a polished MVP in 3-4 weeks, then sell manually to 10 agencies or small SaaS teams. The signal to keep going:

- 10 teams use it on a real project.
- 3 teams agree to pay EUR49-EUR99/month after the trial.
- At least 1 team says the spatial pins are now part of their review habit.

## Go-to-market

1. **Agency founder-led sales**
   - Reach out to agency leads and ask how client feedback currently arrives.
   - Demo the loop: click element, create task, send to Linear.
2. **Product team demo content**
   - Show "Linear for your actual interface."
   - Compare a vague screenshot ticket with a YouIn spatial task.
3. **Comparison pages**
   - Be honest: YouIn vs BugHerd, Marker.io, Jam.dev, and Slack screenshots.
   - The point is not "they are bad." The point is "they collect feedback, YouIn maps product work."
4. **Guest review loop**
   - Every agency client review should expose YouIn as the layer that made the review painless.

## Competitive positioning

- **vs Marker.io / BugHerd / Usersnap**
  - They are primarily website feedback and bug-reporting tools.
  - YouIn is a spatial backlog: tasks, state, and product memory attached to the live UI.
- **vs Linear / Jira / Notion**
  - They track work, but the work is detached from the interface.
  - YouIn keeps the task where the issue exists and syncs downstream.
- **vs Jam.dev**
  - Jam is excellent for bug reports and repro capture.
  - YouIn is built for UI work, product polish, stakeholder comments, and spatial task management.
- **vs Figma comments**
  - Figma comments live on design files.
  - YouIn starts where Figma stops: the shipped product.

## Risks

1. **Category confusion**
   - Biggest risk. If people think "like BugHerd," YouIn becomes a cheaper clone.
   - Mitigation: own "spatial backlog" consistently.
2. **Selector drift**
   - High technical risk.
   - Mitigation: selector + viewport + screenshot fallback, plus explicit stale-anchor states.
3. **Chrome extension friction**
   - High adoption risk for clients.
   - Mitigation: no-install guest review links.
4. **Solo dev willingness to pay**
   - Medium revenue risk.
   - Mitigation: keep Solo as entry-level, sell agencies and teams first.
5. **AI as fake differentiation**
   - Medium positioning risk.
   - Mitigation: use AI to improve ticket quality, but do not make it the headline.

## One-liner

YouIn turns your web app into a spatial backlog, so every bug, comment, and task lives exactly where it belongs.
