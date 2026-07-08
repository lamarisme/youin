import assert from "node:assert/strict";
import test from "node:test";

import {
  filterUnreadActivityIds,
  uniqueInboxActivityIds,
  validateContextViewedActivities,
} from "./inbox-read-state.ts";

const firstActivityId = "11111111-1111-4111-8111-111111111111";
const secondActivityId = "22222222-2222-4222-8222-222222222222";
const markId = "33333333-3333-4333-8333-333333333333";
const commentId = "44444444-4444-4444-8444-444444444444";

test("uniqueInboxActivityIds removes blanks and duplicate ids", () => {
  assert.deepEqual(
    uniqueInboxActivityIds([firstActivityId, " ", secondActivityId, firstActivityId]),
    [firstActivityId, secondActivityId],
  );
});

test("filterUnreadActivityIds keeps only activities without read state", () => {
  assert.deepEqual(
    filterUnreadActivityIds({
      activityIds: [firstActivityId, secondActivityId],
      readActivityIds: [firstActivityId],
    }),
    [secondActivityId],
  );
});

test("validateContextViewedActivities accepts matching recipient activities", () => {
  assert.doesNotThrow(() =>
    validateContextViewedActivities({
      requestedActivityIds: [firstActivityId],
      activities: [{
        id: firstActivityId,
        requiredContextType: "mark",
        requiredContextId: markId,
      }],
      requiredContextType: "mark",
      requiredContextId: markId,
    }),
  );
});

test("validateContextViewedActivities accepts multiple activities for one viewed context", () => {
  assert.doesNotThrow(() =>
    validateContextViewedActivities({
      requestedActivityIds: [firstActivityId, secondActivityId],
      activities: [
        {
          id: firstActivityId,
          requiredContextType: "mark",
          requiredContextId: markId,
        },
        {
          id: secondActivityId,
          requiredContextType: "mark",
          requiredContextId: markId,
        },
      ],
      requiredContextType: "mark",
      requiredContextId: markId,
    }),
  );
});

test("validateContextViewedActivities rejects missing or mismatched contexts", () => {
  assert.throws(
    () =>
      validateContextViewedActivities({
        requestedActivityIds: [firstActivityId, secondActivityId],
        activities: [{
          id: firstActivityId,
          requiredContextType: "comment",
          requiredContextId: commentId,
        }],
        requiredContextType: "comment",
        requiredContextId: commentId,
      }),
    /not found/,
  );

  assert.throws(
    () =>
      validateContextViewedActivities({
        requestedActivityIds: [firstActivityId],
        activities: [{
          id: firstActivityId,
          requiredContextType: "comment",
          requiredContextId: commentId,
        }],
        requiredContextType: "mark",
        requiredContextId: markId,
      }),
    /did not match/,
  );
});
