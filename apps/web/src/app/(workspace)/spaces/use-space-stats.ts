"use client";

import { useMemo } from "react";

import type { Workspace } from "@/lib/collab-types";

export interface SpaceStats {
  total: number;
  open: number;
  closed: number;
  comments: number;
  lastActivity: string | null;
  labelBreakdown: Map<string, number>;
}

export function useSpaceStats(workspace: Workspace): Map<string, SpaceStats> {
  return useMemo(() => {
    const map = new Map<string, SpaceStats>();
    for (const space of workspace.spaces) {
      map.set(space.id, {
        total: 0,
        open: 0,
        closed: 0,
        comments: 0,
        lastActivity: null,
        labelBreakdown: new Map(),
      });
    }
    for (const mark of workspace.marks) {
      const stats = map.get(mark.spaceId);
      if (!stats) continue;
      stats.total += 1;
      if (mark.status === "open") stats.open += 1;
      else stats.closed += 1;
      for (const lid of mark.labelIds) {
        stats.labelBreakdown.set(lid, (stats.labelBreakdown.get(lid) ?? 0) + 1);
      }
    }
    for (const comment of workspace.comments) {
      const mark = workspace.marks.find((p) => p.id === comment.markId);
      if (!mark) continue;
      const stats = map.get(mark.spaceId);
      if (!stats) continue;
      stats.comments += 1;
      if (!stats.lastActivity || comment.createdAt > stats.lastActivity) {
        stats.lastActivity = comment.createdAt;
      }
    }
    for (const mark of workspace.marks) {
      const stats = map.get(mark.spaceId);
      if (!stats) continue;
      const cap = mark.capture?.capturedAt;
      if (cap && (!stats.lastActivity || cap > stats.lastActivity)) {
        stats.lastActivity = cap;
      }
    }
    return map;
  }, [workspace]);
}
