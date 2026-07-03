# Inbox QA Report

| | |
|---|---|
| **Project** | YouIn |
| **Feature** | Inbox |
| **QA Engineer** | Abdelilah Wajid |
| **Test Type** | Manual QA + Exploratory Testing + Product Investigation |
| **Status** | 🟢 PASSED (with Product / UX observations) |

---

## Objective

Validate the Inbox feature end-to-end from a real product perspective.

The goal was not only to verify that the feature works, but also to understand:

- Notification generation
- Read / Unread behavior
- Activity aggregation
- Multi-user collaboration
- Synchronization
- Persistence
- Product consistency
- UX clarity

Testing was performed using real user workflows instead of isolated component testing.

---

## Test Environment

**Workspace**
- Acme Workspace

**Accounts**

| Role | Account |
|---|---|
| Owner | owner.test@youin.click |
| Member | member.test@youin.click |
| Member 2 | member2.test@youin.click |

**Browsers**
- Chrome
- Multiple browser sessions
- Multiple logged-in users simultaneously

---

## Test Coverage

### Test 1 — Inbox Visibility
**Status:** ✅ Passed

**Goal:** Verify that important activities appear inside Inbox.

**Validated:**
- Mark assignment
- Notification creation
- Correct author
- Correct target mark
- Navigation from Inbox to Mark

---

### Test 2 — Read / Unread Behavior
**Status:** ✅ Passed

**Goal:** Understand how Inbox manages Read and Unread state.

**Validated:**
- Read state persistence
- Counter updates
- Activity behavior

**Important discovery:** Read behavior was initially unclear. A deeper investigation showed different behaviors depending on activity type. Additional investigation was performed before continuing testing.

---

### Test 3 — Mark All Read
**Status:** ✅ Passed

**Goal:** Validate global read action.

**Validated:**
- Mark all read
- Counter reset
- Refresh persistence
- New notifications after reset

---

### Test 4 — Comment Activity
**Status:** ✅ Passed

**Validated:**
- New comments
- Replies
- Navigation
- Author information
- Comment notifications

---

### Test 5 — Assignment Activity
**Status:** ✅ Passed

**Validated:**
- Assign member
- Reassign member
- Unassign
- Notification generation
- Navigation

---

### Test 6 — Mention Activity
**Status:** ✅ Passed

**Validated:**
- Mention notification
- Multiple mentions
- Mention navigation
- Mention inside comments

**Additional investigation:**
- Comment deletion behavior
- Mention notification cleanup
- Notification consistency

---

### Test 7 — Invite Activity
**Status:** ✅ Passed

**Validated:**
- Invitation received
- Accept invitation
- Team updated
- Membership created

---

### Test 8 — Multi-user Activity
**Status:** ✅ Passed

**Users:** Owner, Member, Member 2

**Validated:**
- Multiple users interacting on same Mark
- Simultaneous comments
- Simultaneous mentions
- Timeline ordering
- Notification routing

---

### Test 9 — Refresh & Persistence
**Status:** ✅ Passed

**Validated:**
- Refresh
- Navigation
- Persistence
- Activity grouping
- History integrity

---

## Overall Result

**Feature Status:** 🟢 PASSED

Core functionality is stable. No critical functional blocker was discovered.

---

## Product Discoveries

During testing, several behaviors required deeper investigation. These are intentionally **not** classified as bugs.

### Observation 1 — Read / Unread UX
**Classification:** Product UX

The current MVP exposes only "Mark all read." There is no obvious indication explaining when a single notification becomes Read. Users may assume opening a notification marks it as Read. This behavior is not immediately discoverable.

### Observation 2 — Comment Notification Direction
**Classification:** Product Rule Investigation

Observed behavior:
- **Member → Owner:** Comment without mention → Owner receives Inbox notification.
- **Owner → Member:** Comment without mention → Member does not always receive Inbox notification.

Needs Product clarification. Unknown whether this is intentional.

### Observation 3 — Comment Deletion Cleanup
**Classification:** Possible Product Rule / Possible Bug

Deleting a comment removes some generated notifications. However, cleanup behavior is not always symmetrical between Owner and Member scenarios. Requires product validation.

### Observation 4 — Invitation Acceptance Feedback
**Classification:** UX Improvement

Owner sends an invitation and the Member accepts, but the Owner receives no Inbox notification. The Owner only discovers the acceptance by navigating to Account → Team.

**Potential improvement:** Generate an Inbox activity such as "John accepted your invitation."

### Observation 5 — Inbox Counter vs Grouped Activities
**Classification:** Product Discussion

Inbox currently groups activities by Mark (e.g., "YIN-3 — Member commented — +12 more updates"), but the Inbox badge counts unread updates rather than unread cards (e.g., badge shows "7 New" while only 1 card is visible).

**Open question:** Should the Inbox badge count:
- **(A)** Unread events, or
- **(B)** Unread conversations (cards)?

The current implementation appears to count events while the UI groups conversations.

---

## Technical Discoveries

**Activity Aggregation**
Inbox does not create one notification per event. Instead, activities are grouped by Mark. Confirmed during testing.

**Timeline Integrity**
History remained correct. No missing events discovered.

**Navigation**
All tested Inbox activities opened the correct Mark. No incorrect routing discovered.

**Synchronization**
Multi-user synchronization behaved correctly. No data corruption observed.

**Persistence**
Refresh, browser navigation, and reopening pages maintained Inbox state correctly.

---

## Proposed Product Marks

The following observations deserve dedicated YouIn Marks.

### Mark 1 — Inbox read state is not intuitive
| | |
|---|---|
| **Priority** | Medium |
| **Labels** | UX, Inbox |

Current Inbox only exposes "Mark all read." Users cannot easily understand when a notification becomes Read. Consider improving discoverability of Read state.

### Mark 2 — Owner is not notified when invitation is accepted
| | |
|---|---|
| **Priority** | Medium |
| **Labels** | Inbox, Invitations, UX |

Workspace owners currently receive no Inbox activity after an invitation is accepted. Acceptance is only visible by manually visiting the Team page.

### Mark 3 — Investigate comment notification rules
| | |
|---|---|
| **Priority** | Medium |
| **Labels** | Inbox, Comments, Investigation |

Comment notifications appear asymmetrical between Owner and Member. Verify intended notification rules for comments without mentions.

### Mark 4 — Investigate Inbox cleanup after comment deletion
| | |
|---|---|
| **Priority** | Medium |
| **Labels** | Inbox, Comments, Investigation |

Deleting comments does not always clean generated Inbox notifications consistently. Verify intended behavior.

### Mark 5 — Review Inbox badge counting strategy
| | |
|---|---|
| **Priority** | Low |
| **Labels** | Inbox, UX, Discussion |

Inbox badge currently counts unread events while the UI groups events into conversation cards. Evaluate whether the badge should count grouped conversations instead.

---

## Bugs Found

No confirmed critical bugs. Some behaviors require product clarification before being classified as bugs.

---

## QA Conclusion

The Inbox feature is production-ready from a functional perspective. Core workflows behaved correctly during testing:

- Notification generation
- Assignment
- Mentions
- Comments
- Invitations
- Multi-user collaboration
- Persistence
- Synchronization

The remaining observations are primarily Product and UX decisions rather than confirmed implementation defects.

**Overall Assessment:** 🟢 Inbox feature successfully validated.
