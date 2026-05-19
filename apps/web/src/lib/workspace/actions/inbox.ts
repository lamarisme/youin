"use server";

import { and, desc, eq, inArray, ne } from "drizzle-orm";

import {
  inboxReadStates,
  markComments,
  markEvents,
  marks,
  profiles,
  spaces,
  workspaceMembers,
} from "@/db/schema";
import type { MarkEventType } from "@/lib/collab-types";
import { formatPinDisplayKey } from "@/lib/workspace/mark-display-id";
import { initialsFromFullName } from "@/lib/workspace/profile-utils";
import { requireWorkspaceContext } from "./session";

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

export interface InboxSnapshot {
  groups: InboxGroup[];
  totalEvents: number;
  unreadCount: number;
  lastReadAt: string;
}

type PinRow = {
  id: string;
  title: string | null;
  spaceId: string;
  seq: number | null;
};

type EventRow = {
  id: string;
  markId: string;
  actorUserId: string;
  type: MarkEventType;
  fromValue: string | null;
  toValue: string | null;
  createdAt: string;
};

type MemberRow = {
  userId: string;
  username: string | null;
};

type ProfileRow = {
  id: string;
  fullName: string | null;
  email: string | null;
};

type SpaceRow = {
  id: string;
  code: string | null;
};

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function emptyInbox(lastReadAt = ""): InboxSnapshot {
  return { groups: [], totalEvents: 0, unreadCount: 0, lastReadAt };
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

export async function getInboxAction(): Promise<InboxSnapshot> {
  const { db, userId, workspaceId } = await requireWorkspaceContext();

  const [readStates, assignedMarks, touchedComments] =
    await Promise.all([
      db
        .select({ lastReadAt: inboxReadStates.lastReadAt })
        .from(inboxReadStates)
        .where(
          and(
            eq(inboxReadStates.workspaceId, workspaceId),
            eq(inboxReadStates.userId, userId),
          ),
        )
        .limit(1),
      db
        .select({
          id: marks.id,
          title: marks.title,
          spaceId: marks.spaceId,
          seq: marks.seq,
        })
        .from(marks)
        .where(
          and(eq(marks.workspaceId, workspaceId), eq(marks.assigneeUserId, userId)),
        ),
      db
        .select({ markId: markComments.markId })
        .from(markComments)
        .innerJoin(marks, eq(marks.id, markComments.markId))
        .where(
          and(
            eq(marks.workspaceId, workspaceId),
            eq(markComments.authorUserId, userId),
          ),
        ),
    ]);

  const lastReadAt = readStates[0]?.lastReadAt
    ? toIso(readStates[0].lastReadAt)
    : "";
  const markIds = unique([
    ...assignedMarks.map((m) => m.id),
    ...touchedComments.map((c) => c.markId),
  ]);

  if (markIds.length === 0) return emptyInbox(lastReadAt);

  const marksForInbox = await db
    .select({
      id: marks.id,
      title: marks.title,
      spaceId: marks.spaceId,
      seq: marks.seq,
    })
    .from(marks)
    .where(and(eq(marks.workspaceId, workspaceId), inArray(marks.id, markIds)));

  const pinRows = marksForInbox as PinRow[];
  const validPinIds = unique(pinRows.map((m) => m.id));
  if (validPinIds.length === 0) return emptyInbox(lastReadAt);

  const spaceIds = unique(pinRows.map((m) => m.spaceId));
  const [events, spaceRows] = await Promise.all([
    db
      .select({
        id: markEvents.id,
        markId: markEvents.markId,
        actorUserId: markEvents.actorUserId,
        type: markEvents.type,
        fromValue: markEvents.fromValue,
        toValue: markEvents.toValue,
        createdAt: markEvents.createdAt,
      })
      .from(markEvents)
      .where(
        and(
          eq(markEvents.workspaceId, workspaceId),
          inArray(markEvents.markId, validPinIds),
          ne(markEvents.actorUserId, userId),
        ),
      )
      .orderBy(desc(markEvents.createdAt)),
    db
      .select({ id: spaces.id, code: spaces.code })
      .from(spaces)
      .where(and(eq(spaces.workspaceId, workspaceId), inArray(spaces.id, spaceIds))),
  ]);

  const eventRows = events.map((event) => ({
    ...event,
    createdAt: toIso(event.createdAt),
  })) as EventRow[];
  if (eventRows.length === 0) return emptyInbox(lastReadAt);

  const actorIds = unique(eventRows.map((e) => e.actorUserId));
  const [members, profileRows] = await Promise.all([
    db
      .select({
        userId: workspaceMembers.userId,
        username: workspaceMembers.username,
      })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          inArray(workspaceMembers.userId, actorIds),
        ),
      ),
    db
      .select({
        id: profiles.id,
        fullName: profiles.fullName,
        email: profiles.email,
      })
      .from(profiles)
      .where(inArray(profiles.id, actorIds)),
  ]);

  const pinById = new Map(pinRows.map((m) => [m.id, m]));
  const spaceCodeById = new Map(
    (spaceRows as SpaceRow[]).map((s) => [s.id, s.code?.trim() || "UNKN"]),
  );
  const memberById = new Map((members as MemberRow[]).map((m) => [m.userId, m]));
  const profileById = new Map((profileRows as ProfileRow[]).map((p) => [p.id, p]));

  const inboxEvents: InboxEvent[] = [];
  for (const e of eventRows) {
    const pin = pinById.get(e.markId);
    if (!pin) continue;
    const member = memberById.get(e.actorUserId);
    const profile = profileById.get(e.actorUserId);
    const fallbackName = profile?.email?.split("@")[0] ?? "Unknown";
    const actorName = profile?.fullName?.trim() || fallbackName;
    inboxEvents.push({
      id: e.id,
      pinId: e.markId,
      pinTitle: pin.title?.trim() || "(untitled)",
      spaceId: pin.spaceId,
      actorId: e.actorUserId,
      actorName,
      actorUsername: member?.username?.trim() ?? "",
      actorInitials: initialsFromFullName(actorName),
      type: e.type,
      fromValue: e.fromValue ?? undefined,
      toValue: e.toValue ?? undefined,
      createdAt: e.createdAt,
      unread: lastReadAt === "" ? true : e.createdAt > lastReadAt,
    });
  }

  const groupMap = new Map<string, InboxGroup>();
  for (const ev of inboxEvents) {
    const existing = groupMap.get(ev.pinId);
    if (existing) {
      existing.events.push(ev);
      if (ev.createdAt > existing.latestAt) existing.latestAt = ev.createdAt;
      if (ev.unread) existing.unreadCount += 1;
      continue;
    }
    const pin = pinById.get(ev.pinId);
    const code = spaceCodeById.get(ev.spaceId) ?? "UNKN";
    groupMap.set(ev.pinId, {
      pinId: ev.pinId,
      pinDisplayKey: formatPinDisplayKey(code, pin?.seq ?? 0),
      pinTitle: ev.pinTitle,
      spaceId: ev.spaceId,
      events: [ev],
      latestAt: ev.createdAt,
      unreadCount: ev.unread ? 1 : 0,
    });
  }

  const groups = Array.from(groupMap.values()).sort((a, b) =>
    a.latestAt < b.latestAt ? 1 : -1,
  );
  const unreadCount = inboxEvents.reduce((acc, e) => acc + (e.unread ? 1 : 0), 0);

  return { groups, totalEvents: inboxEvents.length, unreadCount, lastReadAt };
}

export async function markInboxReadAction(readAt?: string): Promise<{ lastReadAt: string }> {
  const { db, userId, workspaceId } = await requireWorkspaceContext();
  const lastReadAt = readAt ?? new Date().toISOString();
  const lastReadDate = new Date(lastReadAt);
  await db
    .insert(inboxReadStates)
    .values({
      workspaceId,
      userId,
      lastReadAt: lastReadDate,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [inboxReadStates.workspaceId, inboxReadStates.userId],
      set: {
        lastReadAt: lastReadDate,
        updatedAt: new Date(),
      },
    });
  return { lastReadAt };
}
