import assert from "node:assert/strict";
import test from "node:test";

import { workspaceInviteAcceptanceFeedback } from "./invite-acceptance-feedback.ts";
import { WORKSPACE_INVITE_ACCEPTANCE_STATUSES } from "./invitations.ts";

test("defines predictable feedback for every invitation acceptance status", () => {
  for (const status of WORKSPACE_INVITE_ACCEPTANCE_STATUSES) {
    const feedback = workspaceInviteAcceptanceFeedback(status, "Kanata workspace");

    assert.ok(feedback.title.length > 0);
    assert.ok(feedback.body.length > 0);
  }
});

test("treats accepted and already-member outcomes as success", () => {
  assert.equal(
    workspaceInviteAcceptanceFeedback("accepted", "Kanata workspace").success,
    true,
  );
  assert.equal(
    workspaceInviteAcceptanceFeedback("already_member", "Kanata workspace").success,
    true,
  );
});

test("treats terminal and identity outcomes as failures", () => {
  for (const status of [
    "already_accepted",
    "email_mismatch",
    "expired",
    "invalid_request",
    "not_found",
    "revoked",
  ] as const) {
    const feedback = workspaceInviteAcceptanceFeedback(status, "Kanata workspace");
    assert.equal(feedback.success, false);
    assert.equal(feedback.tone, "danger");
  }
});
