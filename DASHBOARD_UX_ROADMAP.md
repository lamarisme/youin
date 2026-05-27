# Dashboard UX Roadmap

## Intent

Make `/dashboard` feel like a world-class triage cockpit: quiet, dense, fast, and calm. Filters should stay available without becoming the page. The main job is resolving existing marks with as little context switching as possible.

Product register: authenticated product UI.

Scene: a designer, PM, agency lead, or developer is moving through live-site feedback in a focused work session, often with a client or teammate context in mind. The interface should feel like Linear, Raycast, and Figma Inspect in spirit: predictable, low-noise, keyboard-friendly, and exact.

## Current Baseline

Shipped in the cockpit pass:

- Desktop split view with list on the left and selected mark detail on the right.
- `/dashboard/[mark]` remains the shareable selected-mark URL.
- Desktop `/dashboard` auto-selects the first visible mark.
- Mobile keeps list-first dashboard behavior and full-screen mark detail.
- Quiet workspace view rail above the list.
- Attention strip for open, critical, mine, and unassigned queues.
- Active row styling independent from bulk checkboxes.
- Pane-optimized mark detail with capture, notes, labels, discussion, and collapsed history.
- Shortcut help dialog is mounted from the detail view.

## Prioritized Changes

### 1. Triage Command Bar

Status: planned.

Add a compact command surface for high-frequency actions:

- Jump to mark.
- Change status, assignee, priority, labels, and space.
- Create a saved view from current filters.
- Apply queue presets.

Acceptance:

- Opens from a keyboard shortcut and a quiet toolbar affordance.
- Uses existing mutations and routes.
- Does not introduce a new route or database shape.

### 2. Quiet Row Quick Actions

Status: shipped.

Rows should support common triage without forcing the detail pane open:

- Resolve or reopen.
- Open source page.
- Show comment count.
- Keep actions hidden until hover or keyboard focus on desktop.
- Keep actions visible enough for touch on mobile.

Acceptance:

- Bulk selection and active mark selection stay independent.
- Row actions never sit inside another button.
- Keyboard focus reveals row actions.

### 3. List-Level Keyboard Navigation

Status: shipped.

Make the left pane operable like an inbox:

- `j` or ArrowDown moves to the next visible mark.
- `k` or ArrowUp moves to the previous visible mark.
- `x` toggles the selected mark status.
- `?` opens the shortcut help already mounted in detail.

Acceptance:

- Shortcuts are disabled while typing, editing, creating, or confirming destructive actions.
- Existing detail shortcuts do not double-fire.
- Navigation preserves current URL filters.

### 4. Capture Inspection Upgrade

Status: planned.

Turn the capture area into the fastest way to understand the mark:

- Larger hero capture in pane mode.
- Open page and inspect context from the capture region.
- Empty capture states explain how to recover context.
- Future pass: zoom, pan, and compare capture with current live page.

Acceptance:

- Capture stays above notes in pane mode.
- Empty capture state is useful and compact.
- No decorative image treatment.

### 5. Stale, Blocked, and Needs-Reply Signals

Status: planned.

Add derived urgency signals without adding schema:

- Stale: open and untouched beyond a threshold.
- Needs reply: comments after the current assignee or owner activity.
- Blocked: derived from labels or workflow status names when present.

Acceptance:

- Signals are quiet chips, not new filter noise.
- Counts can feed future attention queues.
- Logic lives in pure helpers with tests.

### 6. Review-Thread Quality Comments

Status: planned.

Make discussion feel closer to resolving UI work:

- Comment composer stays visually close to the selected mark context.
- Latest activity is easier to scan.
- Reply and resolve cues are clearer.

Acceptance:

- No nested cards.
- Thread remains readable in narrow pane mode.
- Comments do not push core mark metadata out of reach.

### 7. Bulk Triage Presets

Status: planned.

Bulk mode should feel powerful but calm:

- Resolve selected.
- Reopen selected.
- Set priority.
- Assign to me.
- Move to triage or backlog status when workflow statuses exist.

Acceptance:

- Bulk bar stays docked and compact.
- Presets use existing mutations.
- Failed mutations report clearly.

### 8. Workspace Views As First-Class Cockpit Objects

Status: planned.

The view rail should become more useful over time:

- Active view affordance.
- Create view from current filters.
- Rename, manage, or pin favorite views.
- Clear difference between dashboard queues and saved views.

Acceptance:

- `/views/[id]` remains the saved-view route.
- Dashboard does not duplicate saved-view state locally.
- Rail keeps horizontal overflow on small widths.

### 9. Better Empty And Filtered States

Status: planned.

Empty states should explain what changed and what to do next:

- No marks in workspace.
- No marks in current project or space.
- No matches for filters.
- Selected mark hidden by current filters.

Acceptance:

- Each state has one primary recovery action.
- Copy is short and specific.
- Filter reset preserves project or space when appropriate.

### 10. Lightweight Dashboard Health Header

Status: planned.

Add a restrained health readout only if it helps weekly team review:

- Open marks.
- Critical marks.
- Unassigned marks.
- Resolved this week.

Acceptance:

- Header does not compete with the attention strip.
- No hero metric template.
- Numbers support action rather than decoration.

## Implementation Order

1. Ship row quick actions and list keyboard navigation.
2. Tighten empty and filtered states.
3. Add bulk triage presets.
4. Promote saved-view creation from current filters.
5. Add derived urgency helpers with tests.
6. Revisit command bar after the repeated actions are proven in the UI.

## Design Rules For This Surface

- Keep filters quiet and progressive. The list and selected mark are the product.
- Prefer rows, panes, and dividers over cards.
- Red is for marks, active context, focus, urgent work, and decisive actions.
- Use system typography and the existing fixed UI type scale.
- Do not add decorative motion, gradient accents, or marketing-style sections.
- Touch targets must remain usable on mobile.
- Keyboard interaction must preserve shareable URLs.
