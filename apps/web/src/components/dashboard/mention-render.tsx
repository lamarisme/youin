"use client";

import { useMemo } from "react";

import type { DisplayNamePreference, TeamMember } from "@/lib/collab-types";

import { memberPickerLabel } from "@/lib/workspace/member-label";
import { mentionHighlightClass, segmentKnownMentions } from "./mention-rendering";

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
  const segments = useMemo(
    () => segmentKnownMentions(body, members),
    [body, members],
  );

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
      className={mentionHighlightClass}
      title={memberPickerLabel(member, displayNamePreference)}
      data-mention-user-id={member.id}
      data-mention-username={member.username}
      tabIndex={0}
      aria-label={`Mention: ${memberPickerLabel(member, displayNamePreference)}`}
    >
      @{member.username}
    </span>
  );
}
