export function normalizeReviewLinkTargetOrigin(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Enter the site origin for this review link.");
  if (/\s/.test(trimmed)) {
    throw new Error("Enter a valid site URL, like https://staging.example.com.");
  }

  const hasExplicitScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);
  if (hasExplicitScheme && !/^https?:\/\//i.test(trimmed)) {
    throw new Error("Review links only support http and https sites.");
  }

  const withProtocol = hasExplicitScheme ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    throw new Error("Enter a valid site URL, like https://staging.example.com.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Review links only support http and https sites.");
  }
  return url.origin;
}

export function reviewLinkTargetOriginError(raw: string): string | null {
  try {
    normalizeReviewLinkTargetOrigin(raw);
    return null;
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "Enter a valid site URL, like https://staging.example.com.";
  }
}
