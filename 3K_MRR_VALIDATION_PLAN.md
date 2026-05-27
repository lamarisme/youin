# YouIn 3k MRR Validation Plan

Goal: make YouIn capable of reaching 3k MRR by selling a narrow, painful workflow to a reachable buyer before overbuilding the product.

## Revenue Math

3k MRR does not require a massive audience. It requires a small number of paying teams.

| Plan | Price | Customers needed for 3k MRR |
| --- | ---: | ---: |
| Studio | EUR49/mo | 62 |
| Team | EUR99/mo | 31 |
| Agency | EUR199/mo | 16 |
| Blended target | EUR149/mo average | 21 |

The plan should optimize for 16-31 paying agencies or product teams, not hundreds of solo users.

## Sharpest Wedge

Primary buyer: web agencies with 5-30 people that build websites or web apps for clients.

Why this buyer:

- Feedback chaos costs them billable time.
- Clients are bad at writing tickets.
- Screenshots, WhatsApp, Slack, and email threads create rework.
- Agencies already pay for tools when those tools make the client process feel professional.
- A EUR99-EUR199 monthly price is plausible if YouIn saves even 2-4 hours per month.

Do not lead with solo developers. Solo builders can be useful early users, but they are not the fastest route to 3k MRR.

## Positioning

Main line:

> Client feedback and UI tasks, pinned directly to the live website.

Founder explanation:

> YouIn turns a live website into a spatial backlog. Clients, PMs, and designers can click the exact part of the UI they mean, leave feedback, and hand developers a task with the URL, selector, screenshot, viewport, browser context, and discussion attached.

Avoid:

- "Visual feedback tool"
- "Annotation widget"
- "Bug tracker"
- "Project management platform"

Those phrases put YouIn in a crowded replacement category. The goal is to own a narrower outcome: stop losing UI work between the website and the backlog.

## Current Category Signal

The market already spends money here:

- Marker.io publicly positions around website feedback, bug reporting, UAT, screenshots, metadata, collaboration, and integrations. Its current public pricing shows paid plans from about USD39/mo to USD149/mo, plus an agency plan.
- BugHerd publicly positions around clients pointing, clicking, and commenting on live websites, with screenshots and technical details captured for teams.
- Usersnap and Ruttl also sell adjacent visual feedback, bug reporting, and client review workflows.
- Recent agency discussions still mention the same bottleneck: client adoption works only when feedback is easier than email, screenshots, or a call.

Conclusion: demand exists, but differentiation must be strong. YouIn should not be cheaper BugHerd. It should be the spatial backlog for UI work.

## Sellable MVP

The sellable MVP is not a full product management suite. It is the smallest loop an agency can use with a real client.

Must have:

1. Reviewer opens a client site and can click an element.
2. Reviewer leaves a short comment or task title.
3. YouIn captures URL, selector, viewport, screenshot, browser metadata, and timestamp.
4. Pins appear on the reviewed page for open items.
5. Agency sees a dashboard grouped by project/client, status, assignee, and priority.
6. Status can move through open, in progress, resolved.
7. Reviewer can see what was resolved.
8. Agency can export or create a Linear issue from a mark.
9. Guest review path works without requiring the client to install a Chrome extension.

Nice later:

- Jira and GitHub sync.
- Bidirectional sync.
- White label.
- AI ticket rewriting.
- Video recording.
- Advanced permissions.
- Stale selector repair.
- Cross-page component intelligence.

The Chrome extension is valuable for internal teams. The no-install guest path is what makes agencies sellable.

## Product Gap Priorities

Based on the current repo docs, YouIn already has a web app, workspaces, marks, spaces, dashboard surfaces, inbox/views, auth, and a Chrome extension with review mode, capture, badges, sync, and Supabase-backed auth.

For the 3k MRR path, prioritize gaps in this order:

1. No-install guest review links.
2. End-to-end mark creation from live page to dashboard.
3. Reliable anchor fallback states when selector placement fails.
4. One-click Linear issue creation.
5. Agency-ready project/client organization.
6. Simple billing or paid pilot flow.
7. Onboarding that gets an agency reviewing one client site in under 10 minutes.

Anything that does not help a buyer complete a real client review can wait.

## Pricing Experiment

Start with paid pilots instead of a free beta.

Offer:

- EUR99/mo paid pilot for one agency workspace and up to 3 active client projects.
- EUR199/mo agency plan for up to 10 active client projects.
- 14-day setup guarantee: if they cannot use it on a real review, they do not pay.

Do not charge per feedback item. Agencies need predictable pricing.

Avoid very low pricing. A EUR19 plan can exist later, but it should not drive roadmap decisions.

## Validation Targets

Continue building if all are true:

- 30 agency conversations completed.
- 10 agencies agree the problem is painful and current tools/workarounds are annoying.
- 5 agencies try YouIn on a real client project.
- 3 agencies pay or commit to pay EUR99-EUR199/mo.
- At least 1 agency says the client review loop is now faster or less confusing.

Pause or reposition if any are true:

- Agencies describe it only as "BugHerd but smaller."
- Users like the idea but refuse to use it with a real client.
- Clients still send screenshots or emails after trying it.
- Reviewers cannot complete feedback without hand-holding.
- Anchors are unreliable enough that trust breaks after a deploy.

## 30-Day Execution Plan

### Week 1: Buyer Discovery

Goal: learn how agencies currently collect feedback and whether the pain is expensive.

Actions:

- Build a list of 50 agencies with 5-30 employees.
- Contact founders, PMs, account managers, and lead developers.
- Book 15 calls.
- Do not pitch first. Ask about their last messy feedback cycle.
- Ask for current tool stack, number of client review rounds, and where feedback gets lost.

Success gate:

- At least 8 of 15 calls describe the same repeated pain in their own words.

### Week 2: Concierge Demo

Goal: show the actual workflow and ask for a real project.

Actions:

- Demo a 3-minute loop: click element, leave task, see dashboard, create Linear issue.
- Ask for one staging or live client site to test on.
- Offer to set it up personally.
- Ask whether they would pay EUR99/mo if it works on the next review.

Success gate:

- 5 agencies agree to try it on a real review.

### Week 3: Real Project Pilots

Goal: watch where adoption breaks.

Actions:

- Join or observe the first review session.
- Track time from invite to first mark.
- Track number of clarification messages avoided.
- Record where clients hesitate.
- Fix only adoption blockers and anchor reliability issues.

Success gate:

- 3 agencies complete a review with 10+ real marks.

### Week 4: Paid Conversion

Goal: convert pilots into MRR or learn why not.

Actions:

- Ask for EUR99-EUR199/mo based on project count.
- Offer monthly cancel-anytime terms.
- Collect objections directly.
- If price is the objection, ask what result would make the price obvious.
- If product risk is the objection, turn it into the next product requirement.

Success gate:

- 3 paid or payment-committed customers.

## Outreach Script

Short email:

```text
Subject: Quick question about client website feedback

Hey {{name}},

I am building YouIn, a tool for agencies that lets clients click directly on a live website and leave feedback pinned to the exact UI element, instead of sending screenshots, Slack notes, or vague emails.

Quick question: how does your team currently collect client feedback during website review rounds?

If that process is already smooth, no worries. If it is messy, I would love to show you the 3-minute version and see whether it fits an upcoming client review.

Lamar
```

Follow-up:

```text
Subject: Re: client website feedback

The specific thing I am trying to fix is the "which button did they mean?" problem.

YouIn captures the selected element, URL, screenshot, viewport, browser details, and discussion, then turns it into a task your team can resolve or send to Linear.

Worth a quick look for one upcoming review?
```

## Discovery Call Questions

Use these before pitching:

1. How do clients currently give feedback on websites or web apps?
2. What happened during the last frustrating review round?
3. Where does feedback live after the client sends it?
4. Who has to translate client feedback into developer tasks?
5. How often do developers ask for clarification?
6. Do clients need to log in to anything today?
7. What tool have you tried that did not stick?
8. What would make a feedback tool worth EUR99/mo?
9. Would you use this on a real client project next week?

## Metrics To Track

Activation:

- Time from invite to first mark.
- Percent of invited reviewers who leave at least one mark.
- Marks created per review session.

Value:

- Clarification messages avoided.
- Review rounds shortened.
- Time from feedback to developer-ready task.
- Percent of marks resolved inside YouIn.

Revenue:

- Calls booked.
- Demos completed.
- Pilots started.
- Pilots completed.
- Paid conversions.
- MRR.
- Churn reasons.

## 3k MRR Milestone Path

Milestone 1:

- 3 paying agencies at EUR99/mo.
- MRR: EUR297.
- Proof: someone pays for the workflow.

Milestone 2:

- 10 paying agencies at EUR99-EUR199/mo.
- MRR: about EUR1k-EUR1.5k.
- Proof: repeatable buyer and onboarding.

Milestone 3:

- 21 customers at EUR149 average.
- MRR: about EUR3.1k.
- Proof: the product can sustain a small SaaS business.

## Founder Rule

Until YouIn reaches 3 paying agencies, every product decision should answer one question:

> Does this help an agency run a real client review with less confusion than screenshots, Slack, email, or BugHerd?

If the answer is no, defer it.
