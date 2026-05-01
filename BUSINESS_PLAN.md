# Pin — Business Plan Reference

A visual feedback layer for the live web. Click any element, leave a comment, ship a ticket — without leaving the browser.

Score: **8.5/10**

## The problem

1. **Feedback lives in the wrong place**
   - Designers and PMs screenshot, annotate in Figma or Cleanshot, paste into Slack, write context a dev still misunderstands.
   - 5-step chain for a 5-second observation.
2. **Bug tools are built for QA, not design review**
   - Jam.dev is excellent for "something is broken."
   - It is overkill and wrong-format for "this spacing feels off" or "this copy changed."
3. **Nothing owns the live UI feedback layer**
   - Figma owns design files. Jam owns bug videos.
   - The moment someone looks at the live site and reacts, that space is empty.

## Core product — 3 features, 1 loop

1. **DOM-pinned comments**
   - Click any element on any live site.
   - A comment pins to that exact CSS selector and persists across page loads.
   - Not a screenshot: a spatial annotation that lives on the UI itself.
2. **Auto-context capture**
   - Every comment automatically attaches:
     - console state
     - viewport size
     - browser version
     - element selector
     - screenshot
   - Zero effort from the reporter.
3. **One-click ticket**
   - AI reads comment + context and writes the GitHub / Linear / Jira issue.
   - Includes title, reproduction steps, environment, expected vs actual.
4. **Workspaces (namespacing)**
   - Named contexts like "Homepage - Sprint 4" or "Client review - Acme".
   - Activating a workspace shows only its pins.
   - Archive when done.
   - Free tier: 1 active workspace.
   - Paid: unlimited workspaces (pricing gate).

## Target market

- **Primary buyer:** Web agencies
  - 5-50 person teams, multiple client projects, high feedback volume.
- **Secondary buyer:** Indie dev teams
  - PMs + designers working with 1-3 developers.
- **Ideal user:** The non-dev reviewer
  - Designer, PM, or client who cannot read a console.
- **GDPR angle:** EU agencies
  - Self-host option removes data sovereignty friction.

## Pricing

### Free

- EUR0 / month
- 1 active workspace
- Unlimited pins
- Auto-context capture
- 3 AI tickets / month

### Team (Most popular)

- EUR29 / month
- Unlimited workspaces
- Up to 10 members
- Unlimited AI tickets
- Linear / Jira / GitHub sync
- Workspace archiving

### Agency

- EUR79 / month
- Unlimited members
- Client guest links
- Self-host option
- Priority support
- Custom AI model (local)

## Path to EUR1k MRR

- 35 Team plan customers
- EUR29 average revenue
- EUR1,015 MRR at target
- ~90 days realistic

## Go-to-market

1. **Chrome Web Store + Product Hunt launch**
   - Free tier drives installs.
   - One viral "look what this does" Twitter/X post showing full loop (click, comment, auto-ticket) is the month 1 acquisition strategy.
2. **Agency cold outreach**
   - LinkedIn DMs to heads of product at 5-30 person web agencies.
   - Opener: "How do you handle client feedback on live sites?"
   - No pitch deck needed, just a screen share demo.
3. **Figma community + developer Twitter**
   - Audience lives in design Twitter and Figma community forums.
   - Positioning: "Figma comments, but on your live site."
4. **Viral loop via guest links**
   - Agency plan includes shareable workspace links for clients.
   - Every client reviewer is a potential future buyer.

## Build roadmap

### Phase 1 (Weeks 1-4) — The core loop

- Chrome extension scaffold
- DOM picker + pin placement
- Comment UI
- Auto-context capture (console, viewport, selector, screenshot)
- Firebase backend
- Basic workspace switcher

### Phase 2 (Weeks 5-8) — AI + integrations

- AI ticket generation (Claude API)
- GitHub Issues integration
- Linear integration
- Jira integration
- Workspace archiving
- Invite links for team members

### Phase 3 (Weeks 9-12) — Growth + Agency tier

- Guest/client workspace links
- Self-host Docker image
- Stripe billing + gating
- Product Hunt launch
- Local AI model support (Ollama)

## Competitive moat

- **vs Jam.dev**
  - Different buyer (designer/PM vs QA), format (spatial pin vs video), and workflow (design review vs bug report).
  - Not direct competition.
- **vs Vercel Comments**
  - Vercel comments only works on Vercel-hosted sites.
  - Pin works on any live URL (competitor sites, staging, production, client sites).
- **vs Figma**
  - Figma comments live on design files.
  - Once design ships, Figma becomes the wrong tool.
  - Pin picks up there.
- **Open-source self-host**
  - EU agencies can self-host and keep annotation data on their own infrastructure.
  - No closed-source competitor offers this.

## Risks

1. **DOM selector drift** (High)
   - Site deploys can break pin anchoring if selectors change.
   - Need a fuzzy matching fallback.
2. **Chrome extension install friction** (Medium)
   - Requires team install before value is felt.
   - Onboarding must be under 60 seconds.
3. **Jam adds spatial comments** (Medium)
   - If Jam ships DOM pinning, overlap increases.
   - But their brand is still QA, not design review.
4. **Pricing resistance** (Low)
   - Agencies may resist per-workspace limits.
   - May need per-seat pricing if needed.
