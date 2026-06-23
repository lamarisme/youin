import assert from "node:assert/strict";
import test from "node:test";

import { formatDateTimeFull } from "./dates.ts";

test("formatDateTimeFull includes the complete timestamp", () => {
  assert.equal(
    formatDateTimeFull(new Date(2026, 4, 8, 14, 30)),
    "May 8, 2026, 14:30",
  );
});
