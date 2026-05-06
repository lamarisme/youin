/** Proposes a PER-SPACE uppercase code from a human name (Jira-like). */
export function proposeSpaceCodeFromName(name: string): string {
  const cleaned = name.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const trimmed = cleaned.slice(0, 8);
  if (trimmed.length >= 2) return trimmed;
  return "SP";
}
