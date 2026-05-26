import assert from "node:assert/strict";
import test from "node:test";

import { cn } from "./utils.ts";

test("keeps custom text size and text color utilities together", () => {
  const className = cn(
    "bg-mark text-paper",
    "text-ui-sm",
    "hover:bg-mark-bright",
  );

  assert.match(className, /\btext-paper\b/);
  assert.match(className, /\btext-ui-sm\b/);
});
