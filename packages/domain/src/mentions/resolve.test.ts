import assert from "node:assert/strict";
import test from "node:test";

import type { MentionableMember, PreviousResolvedMention } from "./index.ts";
import { resolveMentions } from "./index.ts";

const MEMBERS: MentionableMember[] = [
  { userId: "user_omar", username: "omar" },
  { userId: "user_sara", username: "sara" },
  { userId: "user_nora", username: "nora" },
];

test("resolves valid mentions against provided members", () => {
  const plan = resolveMentions({
    text: "Hello @omar and @sara",
    members: MEMBERS,
  });

  assert.deepEqual(plan.resolvedMentions, [
    { userId: "user_omar", username: "omar", start: 6, end: 11 },
    { userId: "user_sara", username: "sara", start: 16, end: 21 },
  ]);
  assert.deepEqual(plan.mentionsToCreate, plan.resolvedMentions);
  assert.deepEqual(plan.mentionsToDelete, []);
  assert.deepEqual(plan.notificationTargets, ["user_omar", "user_sara"]);
  assert.deepEqual(plan.ignoredMentions, []);
});

test("deduplicates duplicate mentions and keeps the first occurrence", () => {
  const plan = resolveMentions({
    text: "@omar ping @omar again",
    members: MEMBERS,
  });

  assert.deepEqual(plan.resolvedMentions, [
    { userId: "user_omar", username: "omar", start: 0, end: 5 },
  ]);
  assert.deepEqual(plan.ignoredMentions, [
    { username: "omar", start: 11, end: 16, reason: "duplicate_mention" },
  ]);
  assert.deepEqual(plan.notificationTargets, ["user_omar"]);
});

test("ignores unknown usernames", () => {
  const plan = resolveMentions({
    text: "Can @ghost review with @sara?",
    members: MEMBERS,
  });

  assert.deepEqual(plan.resolvedMentions, [
    { userId: "user_sara", username: "sara", start: 23, end: 28 },
  ]);
  assert.deepEqual(plan.ignoredMentions, [
    { username: "ghost", start: 4, end: 10, reason: "unknown_username" },
  ]);
});

test("ignores self mentions", () => {
  const plan = resolveMentions({
    text: "@omar please ask @sara",
    members: MEMBERS,
    currentUserId: "user_omar",
  });

  assert.deepEqual(plan.resolvedMentions, [
    { userId: "user_sara", username: "sara", start: 17, end: 22 },
  ]);
  assert.deepEqual(plan.ignoredMentions, [
    { username: "omar", start: 0, end: 5, reason: "self_mention" },
  ]);
  assert.deepEqual(plan.notificationTargets, ["user_sara"]);
});

test("does not create or notify unchanged previous mentions", () => {
  const previousMentions: PreviousResolvedMention[] = [
    { userId: "user_omar", username: "omar", start: 6, end: 11 },
  ];
  const plan = resolveMentions({
    text: "Hello @omar",
    members: MEMBERS,
    previousMentions,
  });

  assert.deepEqual(plan.resolvedMentions, [
    { userId: "user_omar", username: "omar", start: 6, end: 11 },
  ]);
  assert.deepEqual(plan.mentionsToCreate, []);
  assert.deepEqual(plan.mentionsToDelete, []);
  assert.deepEqual(plan.notificationTargets, []);
});

test("detects mention addition during an edit", () => {
  const previousMentions: PreviousResolvedMention[] = [
    { userId: "user_omar", username: "omar", start: 6, end: 11 },
  ];
  const plan = resolveMentions({
    text: "Hello @omar and @sara",
    members: MEMBERS,
    previousMentions,
  });

  assert.deepEqual(plan.mentionsToCreate, [
    { userId: "user_sara", username: "sara", start: 16, end: 21 },
  ]);
  assert.deepEqual(plan.mentionsToDelete, []);
  assert.deepEqual(plan.notificationTargets, ["user_sara"]);
});

test("detects mention removal during an edit", () => {
  const removed: PreviousResolvedMention = {
    userId: "user_sara",
    username: "sara",
    start: 16,
    end: 21,
  };
  const plan = resolveMentions({
    text: "Hello @omar",
    members: MEMBERS,
    previousMentions: [
      { userId: "user_omar", username: "omar", start: 6, end: 11 },
      removed,
    ],
  });

  assert.deepEqual(plan.mentionsToCreate, []);
  assert.deepEqual(plan.mentionsToDelete, [removed]);
  assert.deepEqual(plan.notificationTargets, []);
});

test("treats changed offsets as the same logical mention", () => {
  const previous: PreviousResolvedMention = {
    userId: "user_omar",
    username: "omar",
    start: 0,
    end: 5,
  };
  const plan = resolveMentions({
    text: "Hey @omar",
    members: MEMBERS,
    previousMentions: [previous],
  });

  assert.deepEqual(plan.mentionsToCreate, []);
  assert.deepEqual(plan.mentionsToDelete, []);
  assert.deepEqual(plan.notificationTargets, []);
});

test("treats changed mention targets as a new logical mention", () => {
  const previous: PreviousResolvedMention = {
    userId: "user_omar",
    username: "omar",
    start: 6,
    end: 11,
  };
  const plan = resolveMentions({
    text: "Hello @sara",
    members: MEMBERS,
    previousMentions: [previous],
  });

  assert.deepEqual(plan.mentionsToCreate, [
    { userId: "user_sara", username: "sara", start: 6, end: 11 },
  ]);
  assert.deepEqual(plan.mentionsToDelete, [previous]);
  assert.deepEqual(plan.notificationTargets, ["user_sara"]);
});

test("empty text removes previous mentions", () => {
  const previous: PreviousResolvedMention = {
    userId: "user_omar",
    username: "omar",
    start: 0,
    end: 5,
  };
  const plan = resolveMentions({
    text: "",
    members: MEMBERS,
    previousMentions: [previous],
  });

  assert.deepEqual(plan.parsedMentions, []);
  assert.deepEqual(plan.resolvedMentions, []);
  assert.deepEqual(plan.mentionsToCreate, []);
  assert.deepEqual(plan.mentionsToDelete, [previous]);
  assert.deepEqual(plan.notificationTargets, []);
});

test("empty member list treats parsed mentions as unknown", () => {
  const plan = resolveMentions({
    text: "@omar and @sara",
    members: [],
  });

  assert.deepEqual(plan.resolvedMentions, []);
  assert.deepEqual(plan.mentionsToCreate, []);
  assert.deepEqual(plan.notificationTargets, []);
  assert.deepEqual(plan.ignoredMentions, [
    { username: "omar", start: 0, end: 5, reason: "unknown_username" },
    { username: "sara", start: 10, end: 15, reason: "unknown_username" },
  ]);
});

