import type { DisplayNamePreference, TeamMember } from "@/lib/collab-types";

/** Single-line label for selects, tooltips, and pickers — respects viewer preference. */
export function memberPickerLabel(m: TeamMember, pref: DisplayNamePreference): string {
  return memberDisplayParts(m, pref).primary;
}

export function normalizeDisplayNamePreference(
  raw: string | null | undefined,
): DisplayNamePreference {
  return raw === "username" ? "username" : "full_name";
}

/**
 * Single visible label for inline UI (chips, bylines). Respects the viewer's
 * {@link DisplayNamePreference} — shows either full name or @username, not both.
 * @mentions in comment bodies always render as `@username`.
 */
export function memberDisplayParts(
  m: TeamMember,
  pref: DisplayNamePreference,
): { primary: string; secondary: null } {
  const uname = m.username.trim();
  const display = m.name.trim();
  const at = uname ? `@${uname}` : "";

  if (pref === "username") {
    return { primary: at || display || "Member", secondary: null };
  }

  return { primary: display || at || "Member", secondary: null };
}

/** Name + username strings without a full {@link TeamMember}. */
export function rosterDisplayParts(
  name: string,
  username: string,
  pref: DisplayNamePreference,
): { primary: string; secondary: null } {
  const m: TeamMember = {
    id: "",
    username,
    name,
    initials: "",
    email: "",
    role: "member",
  };
  return memberDisplayParts(m, pref);
}
