export type ReviewOriginRequest = {
  headers: {
    get(name: string): string | null;
  };
};

export function normalizeReviewToken(value: string): string {
  return value.trim().replace(/[^a-f0-9-]/gi, "").slice(0, 96);
}

export function originFromUrl(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function requestOrigin(request: ReviewOriginRequest): string | null {
  const origin = request.headers.get("origin");
  if (origin) return origin;
  const referer = request.headers.get("referer");
  return referer ? originFromUrl(referer) : null;
}

export function reviewOriginAllowed(
  link: { targetOrigin: string },
  request: ReviewOriginRequest,
  page: string,
): boolean {
  const pageOrigin = originFromUrl(page);
  const headerOrigin = requestOrigin(request);
  return (
    pageOrigin === link.targetOrigin &&
    (!headerOrigin || headerOrigin === link.targetOrigin)
  );
}
