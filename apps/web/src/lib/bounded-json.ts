export class RequestBodyTooLargeError extends Error {}

function contentLengthExceeds(request: Request, limit: number): boolean {
  const value = Number.parseInt(
    request.headers.get("content-length") ?? "",
    10,
  );
  return Number.isFinite(value) && value > limit;
}

export async function readBoundedJsonBody<T>(
  request: Request,
  limit: number,
): Promise<T> {
  if (contentLengthExceeds(request, limit)) {
    throw new RequestBodyTooLargeError("Request body is too large.");
  }

  const body = request.body;
  if (!body) throw new SyntaxError("Missing request body.");

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      size += value.byteLength;
      if (size > limit) {
        await reader.cancel().catch(() => {});
        throw new RequestBodyTooLargeError("Request body is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}
