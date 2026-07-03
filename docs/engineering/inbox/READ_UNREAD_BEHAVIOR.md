# Inbox Read Behavior

**Status:** Draft

## Goal

Define how Inbox activities transition between **Unread** and **Read**.

This document describes the expected product behavior independently of the implementation.

---

# Core Principle

Unread means:

> This activity still requires the user's attention.

Read means:

> The user has successfully viewed the context related to this activity.

The Inbox should help users discover work, not manage notification state manually.

"Mark all read" is a convenience action, not the primary workflow.

---

# Activity Identity

Each Inbox activity represents a single event.

A new event creates a new Inbox activity.

Activities are immutable once created.

Updating a Mark must never replace or modify previously created Inbox activities.

Examples:

- Assignment → creates one activity.
- Mention → creates one activity.
- Comment → creates one activity.
- Status Change → creates one activity.

---

# Activity Rules

| Activity        | Required Context       |
| --------------- | ---------------------- |
| Assignment      | The related Mark       |
| Mention         | The mentioned content  |
| Comment         | The related comment    |
| Workflow Change | The related Mark       |
| Status Change   | The related Mark       |
| Priority Change | The related Mark       |
| Label Change    | The related Mark       |
| Review Link     | The related Review     |
| Invite          | The invitation details |

---

# Read Rules

## Rule 1 — Read is activity-based

Each Inbox activity maintains its own Read state.

Reading one activity must never automatically mark other activities as Read.

---

## Rule 2 — Context determines Read

An activity becomes Read only after the user has successfully viewed the context required for that activity.

The required context depends on the activity type.

Examples:

- Assignment → opening the related Mark.
- Mention → reaching the mentioned content.
- Comment → reaching the related comment.

Opening an unrelated page must never mark an activity as Read.

---

## Rule 3 — Read is automatic

The system should automatically mark an activity as Read after its required context has been viewed.

Users should not be required to manually acknowledge notifications during normal workflows.

---

## Rule 4 — Manual actions

"Mark all read" marks every currently unread activity as Read.

This action exists only as a convenience feature.

It must never be required for normal Inbox usage.

---

# Exceptions

An activity must remain Unread if the required context has not actually been viewed.

Examples:

- Opening a Mark without reaching the mentioned content must not mark a Mention as Read.
- Opening a page before its content has finished loading must not mark an activity as Read.
- Leaving the page before the required context becomes visible must not mark an activity as Read.

---

# Read Triggers

An activity may become Read only after one of the following events occurs.

| Trigger        | Description                                             |
| -------------- | ------------------------------------------------------- |
| Context Viewed | The required context becomes visible to the user.       |
| Mark All Read  | The user explicitly marks all Inbox activities as Read. |

No other action should change an activity's Read state.

---

# Open Questions

The following questions require Product and Engineering decisions before implementation.

1. Should Read state be stored per activity or derived from a global timestamp?

2. Should opening a Mark from outside the Inbox also mark related activities as Read?

3. How should the system determine that a user has actually viewed a Mention or Comment?

4. Should users be able to manually mark activities as Unread?

5. Should Read state synchronize across all user devices and browser sessions?

6. How long should Read activities remain visible in the Inbox?

7. Should the Inbox provide filters for:
   - Unread
   - Read
   - Mentions
   - Assignments
   - Comments
   - Workflow updates

---

# Success Criteria

A successful Inbox experience should satisfy the following:

- Users never need to manually manage Read state during normal workflows.
- Every activity has a predictable Read behavior.
- Read behavior is consistent across all activity types.
- Opening unrelated pages never affects Inbox state.
- Multiple activities on the same Mark remain independent.
- The Inbox always reflects the user's actual attention, not simply navigation history.
