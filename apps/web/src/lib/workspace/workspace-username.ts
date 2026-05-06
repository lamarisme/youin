const USERNAME_RE = /^[a-z][a-z0-9_]{1,31}$/;

/** Lowercase trimmed handle; does not validate. */
export function normalizeWorkspaceUsernameInput(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Validates workspace-scoped username: 2–32 chars, lowercase `a-z`, digits, underscores; starts with a letter.
 * @throws Error with user-facing message if invalid.
 */
export function assertValidWorkspaceUsername(raw: string): string {
  const s = normalizeWorkspaceUsernameInput(raw);
  if (!USERNAME_RE.test(s)) {
    throw new Error(
      "Username must be 2–32 characters: start with a letter, then lowercase letters, numbers, or underscores.",
    );
  }
  return s;
}
