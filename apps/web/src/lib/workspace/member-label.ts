import type { TeamMember } from "@/lib/collab-types";

/** Short label for selects and lists: `username · display name`. */
export function memberPickerLabel(m: TeamMember): string {
  return `${m.username} · ${m.name}`;
}
