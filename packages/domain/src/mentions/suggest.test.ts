import assert from "node:assert/strict";
import test from "node:test";

import { suggestMentions } from "./index.ts";
import type { MentionSuggestionMember } from "./index.ts";

const MEMBERS: MentionSuggestionMember[] = [
  {
    userId: "user_3",
    username: "sara",
    displayName: "Sara Saleh",
    avatarUrl: "https://example.com/sara.png",
  },
  {
    userId: "user_1",
    username: "omar",
    displayName: "Omar Amrani",
    avatarUrl: null,
  },
  {
    userId: "user_2",
    username: "nora",
    displayName: "Nora Bell",
  },
  {
    userId: "user_4",
    username: "mariem",
    displayName: "Mariem Haddad",
  },
];

test("empty query returns all workspace members in deterministic username order", () => {
  const suggestions = suggestMentions({ members: MEMBERS, query: "" });

  assert.deepEqual(
    suggestions.map((suggestion) => suggestion.username),
    ["mariem", "nora", "omar", "sara"],
  );
});

test("exact match ranks before longer startsWith matches", () => {
  const suggestions = suggestMentions({
    members: [
      { userId: "user_1", username: "omar_dev", displayName: "Omar Dev" },
      { userId: "user_2", username: "omar", displayName: "Omar" },
    ],
    query: "omar",
  });

  assert.deepEqual(
    suggestions.map((suggestion) => suggestion.username),
    ["omar", "omar_dev"],
  );
});

test("startsWith matches rank before contains matches", () => {
  const suggestions = suggestMentions({
    members: [
      { userId: "user_1", username: "tomas", displayName: "Tomas" },
      { userId: "user_2", username: "omar", displayName: "Omar" },
      { userId: "user_3", username: "nomad", displayName: "Nomad" },
    ],
    query: "om",
  });

  assert.deepEqual(
    suggestions.map((suggestion) => suggestion.username),
    ["omar", "nomad", "tomas"],
  );
});

test("contains matches are returned after startsWith matches", () => {
  const suggestions = suggestMentions({ members: MEMBERS, query: "ar" });

  assert.deepEqual(
    suggestions.map((suggestion) => suggestion.username),
    ["mariem", "omar", "sara"],
  );
});

test("search is case-insensitive", () => {
  const suggestions = suggestMentions({ members: MEMBERS, query: "OM" });

  assert.deepEqual(
    suggestions.map((suggestion) => suggestion.username),
    ["omar"],
  );
});

test("returns no matches when no usernames match the query", () => {
  const suggestions = suggestMentions({ members: MEMBERS, query: "zz" });

  assert.deepEqual(suggestions, []);
});

test("ordering is deterministic for equal usernames and display names", () => {
  const suggestions = suggestMentions({
    members: [
      { userId: "user_b", username: "sam", displayName: "Sam" },
      { userId: "user_a", username: "sam", displayName: "Sam" },
      { userId: "user_c", username: "sam", displayName: "A Sam" },
    ],
    query: "s",
  });

  assert.deepEqual(
    suggestions.map((suggestion) => suggestion.userId),
    ["user_c", "user_a", "user_b"],
  );
});
