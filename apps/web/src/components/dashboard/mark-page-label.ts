export function formatMarkPageLabel(page: string): string {
  const trimmed = page.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    const path = `${url.pathname}${url.search}`.replace(/\/$/, "") || "/";
    return `${url.hostname}${path}`;
  } catch {
    return trimmed;
  }
}

export function formatMarkPageOrigin(page: string): string {
  const trimmed = page.trim();
  if (!trimmed) return "";

  try {
    return new URL(trimmed).origin;
  } catch {
    return "";
  }
}
