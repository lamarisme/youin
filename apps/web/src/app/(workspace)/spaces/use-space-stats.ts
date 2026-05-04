"use client";

import { useMemo } from "react";

import type { Workspace } from "@/lib/collab-types";

export interface SpaceStats {
  total: number;
  open: number;
  closed: number;
  comments: number;
  lastActivity: string | null;
  tagBreakdown: Map<string, number>;
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
        tagBreakdown: new Map(),
      });
    }
    for (const pin of workspace.pins) {
      const stats = map.get(pin.spaceId);
      if (!stats) continue;
      stats.total += 1;
      if (pin.status === "open") stats.open += 1;
      else stats.closed += 1;
      for (const tid of pin.tagIds) {
        stats.tagBreakdown.set(tid, (stats.tagBreakdown.get(tid) ?? 0) + 1);
      }
    }
    for (const comment of workspace.comments) {
      const pin = workspace.pins.find((p) => p.id === comment.pinId);
      if (!pin) continue;
      const stats = map.get(pin.spaceId);
      if (!stats) continue;
      stats.comments += 1;
      if (!stats.lastActivity || comment.createdAt > stats.lastActivity) {
        stats.lastActivity = comment.createdAt;
      }
    }
    for (const pin of workspace.pins) {
      const stats = map.get(pin.spaceId);
      if (!stats) continue;
      const cap = pin.capture?.capturedAt;
      if (cap && (!stats.lastActivity || cap > stats.lastActivity)) {
        stats.lastActivity = cap;
      }
    }
    return map;
  }, [workspace]);
}
