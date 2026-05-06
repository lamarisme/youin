"use client";

import { useMemo } from "react";

import type { TeamMember } from "@/lib/collab-types";

import { parseMentions } from "./mention-utils";

interface MentionRenderProps {
  body: string;
  members: TeamMember[];
  className?: string;
}

export function MentionRender({ body, members, className }: MentionRenderProps) {
  const segments = useMemo(() => parseMentions(body, members), [body, members]);

  return (
    <p className={className}>
      {segments.map((seg, i) =>
        seg.type === "text" ? (
          <span key={i}>{seg.value}</span>
        ) : (
          <MentionChip key={i} member={seg.member} />
        ),
      )}
    </p>
  );
}

function MentionChip({ member }: { member: TeamMember }) {
  return (
    <span
      className="inline-flex items-baseline rounded bg-mark-soft px-1 align-baseline font-medium text-mark"
      title={`${member.name}${member.email ? ` · ${member.email}` : ""}`}
    >
      @{member.username}
    </span>
  );
}
