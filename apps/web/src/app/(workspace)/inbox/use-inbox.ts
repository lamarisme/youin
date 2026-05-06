"use client";

import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";

import type { MarkEventType, Workspace } from "@/lib/collab-types";

const READ_PREFIX = "youin:inbox-read:";
const localSubscribers = new Set<() => void>();

function readKey(workspaceId: string, userId: string): string {
  return `${READ_PREFIX}${workspaceId}:${userId}`;
}

function readLastReadAt(workspaceId: string, userId: string): string {
  if (typeof window === "undefined" || !workspaceId || !userId) return "";
  try {
    return window.localStorage.getItem(readKey(workspaceId, userId)) ?? "";
  } catch {
    return "";
  }
}

function writeLastReadAt(workspaceId: string, userId: string, value: string): void {
  if (typeof window === "undefined" || !workspaceId || !userId) return;
  try {
    window.localStorage.setItem(readKey(workspaceId, userId), value);
  } catch {
    // ignore
  }
  for (const cb of localSubscribers) cb();
}

export interface InboxEvent {
  id: string;
  pinId: string;
  pinTitle: string;
  spaceId: string;
  actorId: string;
  actorName: string;
  actorUsername: string;
  actorInitials: string;
  type: MarkEventType;
  fromValue?: string;
  toValue?: string;
  createdAt: string;
  unread: boolean;
}

export interface InboxGroup {
  pinId: string;
  pinDisplayKey: string;
  pinTitle: string;
  spaceId: string;
  events: InboxEvent[];
  latestAt: string;
  unreadCount: number;
}

export interface InboxData {
  groups: InboxGroup[];
  totalEvents: number;
  unreadCount: number;
  lastReadAt: string;
  markAllRead: () => void;
}

function useLastReadAt(workspaceId: string, userId: string): string {
  const cacheRef = useRef<string>("");

  const subscribe = useCallback((cb: () => void) => {
    if (typeof window === "undefined") return () => {};
    const onStorage = (e: StorageEvent) => {
      if (!workspaceId || !userId) return;
      if (e.key === readKey(workspaceId, userId) || e.key === null) cb();
    };
    window.addEventListener("storage", onStorage);
    localSubscribers.add(cb);
    return () => {
      window.removeEventListener("storage", onStorage);
      localSubscribers.delete(cb);
    };
  }, [workspaceId, userId]);

  const getSnapshot = useCallback(() => {
    const next = readLastReadAt(workspaceId, userId);
    if (next !== cacheRef.current) cacheRef.current = next;
    return cacheRef.current;
  }, [workspaceId, userId]);

  const getServerSnapshot = useCallback(() => "", []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useInbox(
  workspace: Workspace,
  workspaceId: string,
  userId: string,
): InboxData {
  const lastReadAt = useLastReadAt(workspaceId, userId);

  const data = useMemo<Omit<InboxData, "markAllRead">>(() => {
    if (!userId) {
      return { groups: [], totalEvents: 0, unreadCount: 0, lastReadAt };
    }

    const memberMap = new Map(workspace.members.map((m) => [m.id, m]));
    const pinMap = new Map(workspace.pins.map((p) => [p.id, p]));

    const relevantPinIds = new Set<string>();
    for (const pin of workspace.pins) {
      if (pin.assigneeId === userId) relevantPinIds.add(pin.id);
    }
    for (const c of workspace.comments) {
      if (c.authorId === userId) relevantPinIds.add(c.pinId);
    }

    const events: InboxEvent[] = [];
    for (const e of workspace.markEvents) {
      if (e.actorId === userId) continue;
      if (!relevantPinIds.has(e.pinId)) continue;
      const pin = pinMap.get(e.pinId);
      if (!pin) continue;
      const actor = memberMap.get(e.actorId);
      events.push({
        id: e.id,
        pinId: e.pinId,
        pinTitle: pin.title || "(untitled)",
        spaceId: pin.spaceId,
        actorId: e.actorId,
        actorName: actor?.name ?? "Unknown",
        actorUsername: actor?.username ?? "",
        actorInitials: actor?.initials ?? "?",
        type: e.type,
        fromValue: e.fromValue,
        toValue: e.toValue,
        createdAt: e.createdAt,
        unread: lastReadAt === "" ? true : e.createdAt > lastReadAt,
      });
    }

    events.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    const groupMap = new Map<string, InboxGroup>();
    for (const ev of events) {
      const existing = groupMap.get(ev.pinId);
      if (existing) {
        existing.events.push(ev);
        if (ev.createdAt > existing.latestAt) existing.latestAt = ev.createdAt;
        if (ev.unread) existing.unreadCount += 1;
      } else {
        const pin = pinMap.get(ev.pinId);
        groupMap.set(ev.pinId, {
          pinId: ev.pinId,
          pinDisplayKey: pin?.displayKey ?? ev.pinId,
          pinTitle: ev.pinTitle,
          spaceId: ev.spaceId,
          events: [ev],
          latestAt: ev.createdAt,
          unreadCount: ev.unread ? 1 : 0,
        });
      }
    }

    const groups = Array.from(groupMap.values()).sort((a, b) =>
      a.latestAt < b.latestAt ? 1 : -1,
    );
    const unreadCount = events.reduce((acc, e) => acc + (e.unread ? 1 : 0), 0);

    return { groups, totalEvents: events.length, unreadCount, lastReadAt };
  }, [workspace, userId, lastReadAt]);

  const markAllRead = useCallback(() => {
    if (!workspaceId || !userId) return;
    writeLastReadAt(workspaceId, userId, new Date().toISOString());
  }, [workspaceId, userId]);

  return { ...data, markAllRead };
}

export function describeEvent(
  event: InboxEvent,
  members: Map<string, { name: string; username: string }>,
): string {
  switch (event.type) {
    case "created":
      return "created this mark";
    case "status_changed":
      return event.toValue === "closed" ? "closed this mark" : "reopened this mark";
    case "priority_changed":
      return `set priority to ${event.toValue ?? "—"}`;
    case "pinned_changed":
      return event.toValue === "true" ? "pinned this mark" : "unpinned this mark";
    case "linear_link_updated":
      return event.toValue ? "linked this to Linear" : "removed the Linear link";
    case "comment_added":
      return "commented on this mark";
    case "assignee_changed":
      if (!event.toValue) return "unassigned this mark";
      {
        const m = members.get(event.toValue);
        if (m?.username) return `assigned to @${m.username}`;
        if (m?.name) return `assigned to ${m.name}`;
        return "assigned to a teammate";
      }
    case "tag_changed":
      return "updated tags";
    default:
      return "updated this mark";
  }
}
