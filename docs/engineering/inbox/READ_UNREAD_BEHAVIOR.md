# Inbox Read/Unread Behavior

**Status:** Approved and implemented

## Goal

Define how Inbox activities transition between unread and read.

This document describes product behavior. Runtime ownership and implementation details live in:

- `INBOX_READ_ARCHITECTURE.md`
- `INBOX_GROUPING_V2_ARCHITECTURE.md`

## Core Principle

Unread means the activity still requires the user's attention.

Read means the user has viewed the context required by that activity, or explicitly used "Mark all read."

The Inbox should help users discover work. Users should not need to manually manage notification state during normal workflows.

## Activity Identity

Each Inbox activity represents one canonical event.

Activities are immutable once created. Updating a Mark must not replace or mutate previously created Inbox activities.

Examples:

- Assignment creates one activity.
- Mention creates one activity.
- Comment creates one activity.
- Status change creates one activity.
- Priority change creates one activity.

## Required Contexts

Every activity has a required context. The activity becomes read only after that context is viewed.

| Activity | Required context |
| --- | --- |
| Assignment | Related Mark |
| Workflow change | Related Mark |
| Status change | Related Mark |
| Priority change | Related Mark |
| Label change | Related Mark |
| Comment | Related comment |
| Reply | Related comment thread |
| Mention in comment | Mentioned content in the containing comment |
| Mention in Mark description | Mentioned content in the Mark description |
| Review | Related review context |
| Review reply | Related review context |
| Review mention | Mentioned content in the review context |
| Invite | Invitation details |

## Read Rules

### 1. Read State Is Activity-Based

Each activity has its own read state in `inbox_activity_read_states`.

Reading one activity must not automatically read unrelated activities.

### 2. Context Determines Read

An activity becomes read only after its required context has been viewed.

Examples:

- Opening a Mark can acknowledge Mark-context activities for that Mark.
- Scrolling to a comment can acknowledge comment-context activities for that comment.
- Viewing a comment that contains a mention can acknowledge the mention activity after the target comment is visible.

Opening an unrelated page must never mark an activity as read.

### 3. Read Is Automatic During Normal Workflows

The system automatically acknowledges activities after the required context is visible.

The user should not need to manually acknowledge individual Inbox activities.

### 4. "Mark All Read" Is Explicit

"Mark all read" marks every currently unread activity for the current user as read.

This is a convenience action. It is not the primary read path.

### 5. Grouping Does Not Change Read Semantics

Presentation Groups can contain multiple canonical activities.

Unread counts remain activity-based:

- A group with three unread activities contributes `3` to the unread badge.
- A visible card can represent the highest-priority activity while hidden activities remain in the group.
- Acknowledgement candidates must still be validated against the viewed context.

## Exceptions

An activity must remain unread when its required context was not actually viewed.

Examples:

- Opening a Mark without reaching the mentioned content must not acknowledge a description mention.
- Loading a Mark page that fails before rendering must not acknowledge Mark-context activities.
- Navigating away before the target comment becomes visible must not acknowledge comment-context activities.
- Missing or deleted target content must not produce a false read.

## Read Triggers

| Trigger | Description |
| --- | --- |
| Context viewed | The required context becomes visible to the user. |
| Mark all read | The user explicitly marks all current unread activities as read. |

No other action should mutate read state.

## Success Criteria

- Read behavior is predictable for every supported activity family.
- Read state is stored per activity.
- Grouped Inbox cards do not hide unread activity state.
- Opening unrelated pages does not affect Inbox state.
- Repeated acknowledgement is idempotent.
- Realtime and cache updates converge across tabs.
