# YouIn — Business Plan Reference

A visual annotation and project management layer that lives directly on your web app. Click any element, write what needs to change, ship it.

> "Your to-do list lives on your app, not in a spreadsheet."

## The problem

1. **Spatial todos live in flat lists**
   - The work happens on the UI. The todos live in Notion, Linear, or Jira — abstracted into rows and tags.
   - "Fix the spacing on the pricing card" is spatial information forced into prose.
2. **Feedback chains lose context**
   - Designers and PMs screenshot, annotate in Figma or Cleanshot, paste into Slack, write context a dev still misunderstands.
   - 5-step chain for a 5-second observation.
3. **Bug tools are built for QA, not design review or self-iteration**
   - Jam.dev is excellent for "something is broken." Wrong format for "this spacing feels off" or "the empty state needs a second pass."
4. **Nothing owns the live UI annotation layer**
   - Figma owns design files. Jam owns bug videos. Linear owns task lists.
   - The moment someone looks at the live app and reacts, that space is empty.

## Core product — annotate where the work lives

1. **Two ways in**
   - **Chrome extension** for client review, designer/PM workflow, and any-URL annotation.
   - **npm dev dependency** for the developer's own dev/staging environment — no extension required, the inspect mode runs in the app itself.
2. **DOM-anchored annotations**
   - Click any element, leave an annotation with what needs changing and why.
   - Three-anchor resilience system so annotations survive deploys:
     1. CSS selector
     2. Viewport position fallback
     3. html2canvas screenshot as last resort
3. **Namespaces**
   - Group annotations by context: "Sprint 1," "Bugs," "Redesign," "Client review — Acme."
   - Activate a namespace, see only its annotations overlaid on the page.
   - Archive when done.
4. **Auto-context capture**
   - Every annotation attaches: console state, viewport size, browser version, element selector, screenshot.
5. **One-click ticket**
   - AI reads annotation + context, writes the GitHub / Linear / Jira issue.
   - Title, repro steps, environment, expected vs actual.
6. **Resolve in place**
   - Mark resolved when the annotated element is fixed. Track progress on the page itself.

## Target market

- **Primary:** Solo devs and indie product teams who think spatially about their app
  - Use the npm dev dep on their own staging. Annotation = todo list with location.
- **Primary:** Product teams replacing scattered Slack/Linear feedback loops
  - 3–15 person teams shipping a web product. Designers, PMs, and devs all annotate the same surface.
- **Secondary:** Agencies collecting client feedback
  - 5–50 person teams, multiple client projects. Chrome extension + guest links.
- **Ideal user:** Anyone who can see something is off but shouldn't have to write a ticket about it
  - Designer, PM, client, or the dev themselves at 11pm before sleep.

## Pricing

Paid from day one. No free tier — the product earns its keep or it doesn't.

### Solo

- **EUR29 / month**
- 1 seat
- Unlimited namespaces and annotations
- Chrome extension + npm dev dep
- 50 AI tickets / month
- Linear / Jira / GitHub sync

### Team (Most popular)

- **EUR79 / month**
- Up to 10 seats
- Everything in Solo
- Unlimited AI tickets
- Namespace archiving
- Team invites

### Agency

- **EUR149 / month**
- Unlimited seats
- Everything in Team
- Client guest links (no account required)
- White-label widget
- Priority support
- Custom AI model (local)

## Path to EUR1k MRR

Realistic mix at month 3:

- 15 Solo @ EUR29 = EUR435
- 6 Team @ EUR79 = EUR474
- 1 Agency @ EUR149 = EUR149
- **= EUR1,058 MRR** (~22 paying customers, ~90 days)

## Go-to-market

1. **Product Hunt launch + Chrome Web Store**
   - One viral "look what this does" demo: click element → annotate → AI ticket. Month 1 acquisition.
2. **Developer Twitter + the npm angle**
   - The npm dev dep is the differentiator. "Visual todos for your own app, installed as a dev dependency."
   - Audience: indie devs, hackers, weekend builders. Show the DX.
3. **Agency cold outreach**
   - LinkedIn DMs to heads of product at 5–30 person agencies.
   - Opener: "How do you handle client feedback on live sites?"
4. **Designer + Figma community**
   - Positioning: "Figma comments, but on your shipped app."
5. **Viral loop via guest links**
   - Agency tier guest links — every client reviewer is a future buyer.

## Build roadmap

### Phase 1 (Weeks 1-4) — The core loop, paid from day one

- Chrome extension scaffold
- npm dev dep scaffold (parallel distribution from day one)
- DOM picker + three-anchor system (CSS selector, viewport fallback, html2canvas)
- Annotation UI + namespace switcher
- Auto-context capture (console, viewport, selector, screenshot)
- Supabase backend
- Stripe billing — Solo + Team tiers live

### Phase 2 (Weeks 5-8) — AI + integrations

- AI ticket generation (Claude API)
- GitHub / Linear / Jira sync
- Namespace archiving
- Team invites

### Phase 3 (Weeks 9-12) — Growth + Agency tier

- Client guest links (no account required)
- White-label widget
- Local AI model support (Ollama)
- Product Hunt launch

## Competitive moat

- **vs Marker.io / BugHerd / Pastel**
  - Those are agency feedback tools. YouIn is a dev-native PM layer that includes feedback as one use case.
  - The npm dev dep is unique — no competitor lets a developer install annotation-as-a-package into their own staging.
- **vs Linear / Jira / Notion**
  - Spreadsheet-style task lists, divorced from the UI.
  - YouIn lives on the UI itself. The annotation IS the todo IS the location.
- **vs Jam.dev**
  - Different buyer (designer/PM/dev vs QA), format (spatial annotation vs video), workflow (continuous iteration vs incident report).
- **vs Vercel Comments**
  - Vercel Comments only works on Vercel preview deployments.
  - YouIn works on any URL — production, staging, client sites, competitor sites.
- **vs Figma**
  - Figma comments live on design files. Once design ships, Figma becomes the wrong tool.
  - YouIn picks up there.

## Risks

1. **DOM selector drift** (High → Medium)
   - Mitigated by the three-anchor system (selector → viewport → screenshot).
   - Still needs real-world testing across deploys before scoring it lower.
2. **Paid-from-day-one acquisition** (Medium)
   - No free tier means slower top-of-funnel growth. Each install is a paying decision.
   - Validate willingness-to-pay early; consider a 14-day trial without freemium.
3. **Scope creep — annotation + PM is broader than feedback** (Medium)
   - Risk of being mediocre at both rather than excellent at one.
   - Hold the line: YouIn is a spatial annotation layer. The PM functions are the natural consequence, not the headline.
4. **Chrome extension install friction** (Reduced)
   - npm dev dep removes this for solo devs and product teams entirely.
   - Still applies to client guest reviewers — handled by no-install guest links on Agency tier.
5. **Jam ships spatial comments** (Medium)
   - Their brand is still QA, not design review or self-iteration. Wedge holds.
6. **Pricing resistance at Agency tier** (Low)
   - EUR149 is competitive vs Marker.io ($499 top tier) and BugHerd ($189 Deluxe). Room to move up.
