import assert from "node:assert/strict";
import test from "node:test";

import {
  isClosedMarkStatus,
  isMarkPriority,
  isMarkStatus,
  normalizeMarkPriority,
  normalizeMarkStatus,
} from "./index.ts";

test("normalizes legacy extension status values to canonical mark statuses", () => {
  assert.equal(normalizeMarkStatus("open"), "open");
  assert.equal(normalizeMarkStatus("closed"), "closed");
  assert.equal(normalizeMarkStatus("resolved"), "closed");
  assert.equal(normalizeMarkStatus("unknown"), "open");
});

test("checks closed state through the canonical mapping", () => {
  assert.equal(isClosedMarkStatus("closed"), true);
  assert.equal(isClosedMarkStatus("resolved"), true);
  assert.equal(isClosedMarkStatus("open"), false);
});

test("normalizes mark priorities without losing critical severity", () => {
  assert.equal(normalizeMarkPriority("low"), "low");
  assert.equal(normalizeMarkPriority("medium"), "medium");
  assert.equal(normalizeMarkPriority("high"), "high");
  assert.equal(normalizeMarkPriority("critical"), "critical");
  assert.equal(normalizeMarkPriority("urgent"), "medium");
});

test("recognizes only canonical remote enum values", () => {
  assert.equal(isMarkStatus("open"), true);
  assert.equal(isMarkStatus("closed"), true);
  assert.equal(isMarkStatus("resolved"), false);
  assert.equal(isMarkPriority("critical"), true);
  assert.equal(isMarkPriority("urgent"), false);
});
