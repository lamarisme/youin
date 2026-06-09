import assert from "node:assert/strict";
import test from "node:test";

import { effectiveInviteStatus } from "./invite-state";

test("keeps an unexpired pending invitation pending", () => {
  assert.equal(
    effectiveInviteStatus(
      { status: "pending", expiresAt: "2026-06-20T00:00:00.000Z" },
      Date.parse("2026-06-10T00:00:00.000Z"),
    ),
    "pending",
  );
});

test("presents stale pending invitations as expired", () => {
  assert.equal(
    effectiveInviteStatus(
      { status: "pending", expiresAt: "2026-06-01T00:00:00.000Z" },
      Date.parse("2026-06-10T00:00:00.000Z"),
    ),
    "expired",
  );
});

test("preserves terminal invitation statuses", () => {
  assert.equal(
    effectiveInviteStatus(
      { status: "accepted", expiresAt: "2026-06-01T00:00:00.000Z" },
      Date.parse("2026-06-10T00:00:00.000Z"),
    ),
    "accepted",
  );
  assert.equal(
    effectiveInviteStatus(
      { status: "revoked", expiresAt: "2026-06-20T00:00:00.000Z" },
      Date.parse("2026-06-10T00:00:00.000Z"),
    ),
    "revoked",
  );
});
