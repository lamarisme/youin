import assert from "node:assert/strict";
import test from "node:test";

import {
  MENTION_USERNAME_MAX_LENGTH,
  isMentionUsername,
  parseMentions,
} from "./index.ts";

test("extracts multiple mentions with source offsets", () => {
  assert.deepEqual(parseMentions("Hello @omar please review this with @sara"), [
    { username: "omar", start: 6, end: 11 },
    { username: "sara", start: 36, end: 41 },
  ]);
});

test("keeps duplicate mentions as separate occurrences", () => {
  assert.deepEqual(parseMentions("@omar ping @omar again"), [
    { username: "omar", start: 0, end: 5 },
    { username: "omar", start: 11, end: 16 },
  ]);
});

test("accepts mentions next to common punctuation", () => {
  assert.deepEqual(parseMentions("Thanks, @omar. Loop in (@sara)!"), [
    { username: "omar", start: 8, end: 13 },
    { username: "sara", start: 24, end: 29 },
  ]);
});

test("ignores invalid usernames", () => {
  assert.deepEqual(
    parseMentions("@a @1omar @_omar @Omar @om-ar @toolongusernamevaluebeyondthelimit"),
    [],
  );
});

test("returns an empty list when no mentions exist", () => {
  assert.deepEqual(parseMentions("No teammate references here."), []);
});

test("extracts mentions at the beginning and end of text", () => {
  assert.deepEqual(parseMentions("@omar can you check with @sara"), [
    { username: "omar", start: 0, end: 5 },
    { username: "sara", start: 25, end: 30 },
  ]);
});

test("does not parse email addresses or repeated at-sign prefixes", () => {
  assert.deepEqual(parseMentions("Send to test@omar.com and not @@sara"), []);
});

test("validates the exported username shape", () => {
  assert.equal(isMentionUsername("om"), true);
  assert.equal(isMentionUsername("omar_2"), true);
  assert.equal(isMentionUsername("o"), false);
  assert.equal(isMentionUsername("Omar"), false);
  assert.equal(isMentionUsername(`a${"b".repeat(MENTION_USERNAME_MAX_LENGTH)}`), false);
});

