import assert from "node:assert/strict";
import test from "node:test";

import {
  readBoundedJsonBody,
  RequestBodyTooLargeError,
} from "./bounded-json.ts";

test("readBoundedJsonBody parses JSON within the byte limit", async () => {
  const request = new Request("https://youin.test/api", {
    method: "POST",
    body: JSON.stringify({ ok: true }),
  });

  assert.deepEqual(await readBoundedJsonBody(request, 1024), { ok: true });
});

test("readBoundedJsonBody rejects an oversized content-length before reading", async () => {
  const request = new Request("https://youin.test/api", {
    method: "POST",
    headers: { "content-length": "9999" },
    body: "{}",
  });

  await assert.rejects(
    readBoundedJsonBody(request, 10),
    RequestBodyTooLargeError,
  );
});

test("readBoundedJsonBody rejects oversized streamed bodies without content-length", async () => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('{"text":"'));
      controller.enqueue(encoder.encode("x".repeat(32)));
      controller.enqueue(encoder.encode('"}'));
      controller.close();
    },
  });
  const init = {
    method: "POST",
    body: stream,
    duplex: "half",
  } as RequestInit & { duplex: "half" };

  const request = new Request("https://youin.test/api", init);

  await assert.rejects(
    readBoundedJsonBody(request, 16),
    RequestBodyTooLargeError,
  );
});
