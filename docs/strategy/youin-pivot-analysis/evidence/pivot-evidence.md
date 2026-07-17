# Youin pivot evidence

Evidence reviewed on July 17, 2026. Competitor adoption and pricing figures are
self-reported by the named companies and should be treated as category signals,
not audited market-size estimates.

## Product and repository evidence

- The repository describes Youin as a visual feedback layer for the live web,
  pairing a Chrome extension with a web workspace.
- Existing capabilities include element, region, and page capture; selector,
  viewport, screenshot, browser, OS, and DOM context; comments and mentions;
  assignments, priorities, and statuses; project and saved-view organization;
  guest review links; and a “Copy AI prompt” action.
- Aggregate usage queries are saved in `usage-aggregates.sql`.
- The configured database contained 57 marks and 61 comments. Fifty-five marks
  were created in the prior 30 days, but 48 of the 57 marks belonged to one
  workspace. This concentration prevents a retention or market-demand claim.
- Thirty-eight prompt-copy events, 48 status changes, and 44 closed marks show
  that the AI-handoff and completion loop has at least been exercised.
- Seven review links existed, but none had a `last_used_at` value and none were
  active when queried. The client-review side is therefore unvalidated.

## External category evidence

- [BugHerd website feedback](https://bugherd.com/use-case/website-feedback-tool)
  reports 10,000+ companies and 350,000+ users, with plans starting at $42 per
  month. It validates demand for contextual website feedback and task tracking.
- [Atarim](https://atarim.io/atarim-click-comment-collaborate-done/) reports
  51,000+ teams and 1.4 million clients and stakeholders, with premium pricing
  starting at $35 per month. It specifically targets agencies and freelancers.
- [Marker.io pricing](https://marker.io/pricing) starts at $39 per month and
  lists a small-agency plan at $99 per month when billed yearly. Its no-account
  reporter experience makes client friction an established buying criterion.
- [Jam pricing](https://jam.dev/pricing) reports 200,000+ users and 17.4 million
  captures. This validates paid demand for better bug reproduction, but Jam’s
  console, network, replay, and ticketing depth makes general QA a difficult
  head-on segment for Youin.
- [Stack Overflow’s 2025 Developer Survey](https://stackoverflow.blog/2025/12/29/developers-remain-willing-but-reluctant-to-use-ai-the-2025-developer-survey-results-are-here/)
  reports 80% AI-tool use among respondents, while only 29% trust AI accuracy
  and 66% say they spend more time fixing almost-right AI output. This supports
  a human review and verification loop around agent-produced UI work.
- [Duda’s agency AI guidance](https://blog.duda.co/how-to-choose-an-ai-website-builder-for-your-agency)
  says client communication, feedback, and permissions are often the most
  time-consuming part of agency projects and cites 89% of digital agency owners
  expecting AI to help them scale.
- [Lovable’s first-year update](https://lovable.dev/blog/one-year-of-lovable)
  reported $200 million ARR, showing substantial demand for AI-assisted app and
  website creation. It does not prove demand for Youin specifically.
- [BugHerd’s MCP beta](https://updates.bugherd.com/release/OpBuF-your-ai-agent-just-became-a-bug-fixing-machine)
  sends captured feedback to Cursor, VS Code, Claude, and ChatGPT. This validates
  the direction but also proves that “visual feedback plus AI” is not a unique
  position by itself.

## Directional assessment method

Each niche was assessed qualitatively on five decision lenses:

1. Pain frequency and urgency.
2. Demonstrated willingness to pay in adjacent products.
3. Ability for a solo founder to reach the buyer.
4. Fit with Youin’s existing implementation.
5. Competitive pressure and missing capability depth.

The resulting High/Medium/Low labels are structured judgment, not survey output
or a statistical market model. The ranking should be validated with customer
interviews and paid pilots before it drives a long product roadmap.
