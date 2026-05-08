"use client";

import { useMemo } from "react";

import type { DisplayNamePreference, TeamMember } from "@/lib/collab-types";

import { parseMentions } from "./mention-utils";
import { memberPickerLabel } from "@/lib/workspace/member-label";

interface MentionRenderProps {
  body: string;
  members: TeamMember[];
  displayNamePreference: DisplayNamePreference;
  className?: string;
}

export function MentionRender({
  body,
  members,
  displayNamePreference,
  className,
}: MentionRenderProps) {
  const segments = useMemo(() => parseMentions(body, members), [body, members]);

  return (
    <p className={className}>
      {segments.map((seg, i) =>
        seg.type === "text" ? (
          <span key={i}>{seg.value}</span>
        ) : (
          <MentionChip key={i} member={seg.member} displayNamePreference={displayNamePreference} />
        ),
      )}
    </p>
  );
}

function MentionChip({
  member,
  displayNamePreference,
}: {
  member: TeamMember;
  displayNamePreference: DisplayNamePreference;
}) {
  return (
    <span
      className="inline-flex items-baseline rounded bg-mark-soft px-1 align-baseline font-medium text-mark"
      title={memberPickerLabel(member, displayNamePreference)}
    >
      @{member.username}
    </span>
  );
}
