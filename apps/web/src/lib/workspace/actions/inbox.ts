"use server";

import type { MarkEventType } from "@/lib/collab-types";
import { formatPinDisplayKey } from "@/lib/workspace/mark-display-id";
import { initialsFromFullName } from "@/lib/workspace/profile-utils";
import { requireSession } from "./session";

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
  space_id: string;
  seq: number | null;
};

type EventRow = {
  id: string;
  mark_id: string;
  actor_user_id: string;
  type: MarkEventType;
  from_value: string | null;
  to_value: string | null;
  created_at: string;
};

type MemberRow = {
  user_id: string;
  username: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type SpaceRow = {
  id: string;
  code: string | null;
};

function emptyInbox(lastReadAt = ""): InboxSnapshot {
  return { groups: [], totalEvents: 0, unreadCount: 0, lastReadAt };
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

export async function getInboxAction(): Promise<InboxSnapshot> {
  const { supabase, userId, workspaceId } = await requireSession();

  const [{ data: readState }, { data: assignedMarks }, { data: touchedComments }] =
    await Promise.all([
      supabase
        .from("inbox_read_states")
        .select("last_read_at")
        .eq("workspace_id", workspaceId)
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("marks")
        .select("id,title,space_id,seq")
        .eq("workspace_id", workspaceId)
        .eq("assignee_user_id", userId),
      supabase
        .from("mark_comments")
        .select("mark_id")
        .eq("author_user_id", userId),
    ]);

  const lastReadAt = (readState?.last_read_at as string | null | undefined) ?? "";
  const markIds = unique([
    ...((assignedMarks ?? []).map((m) => m.id as string)),
    ...((touchedComments ?? []).map((c) => c.mark_id as string)),
  ]);

  if (markIds.length === 0) return emptyInbox(lastReadAt);

  const { data: marks } = await supabase
    .from("marks")
    .select("id,title,space_id,seq")
    .eq("workspace_id", workspaceId)
    .in("id", markIds);

  const pinRows = (marks ?? []) as PinRow[];
  const validPinIds = unique(pinRows.map((m) => m.id));
  if (validPinIds.length === 0) return emptyInbox(lastReadAt);

  const spaceIds = unique(pinRows.map((m) => m.space_id));
  const [{ data: events }, { data: spaces }] = await Promise.all([
    supabase
      .from("mark_events")
      .select("id,mark_id,actor_user_id,type,from_value,to_value,created_at")
      .eq("workspace_id", workspaceId)
      .in("mark_id", validPinIds)
      .neq("actor_user_id", userId)
      .order("created_at", { ascending: false }),
    supabase.from("spaces").select("id,code").eq("workspace_id", workspaceId).in("id", spaceIds),
  ]);

  const eventRows = (events ?? []) as EventRow[];
  if (eventRows.length === 0) return emptyInbox(lastReadAt);

  const actorIds = unique(eventRows.map((e) => e.actor_user_id));
  const [{ data: members }, { data: profiles }] = await Promise.all([
    supabase
      .from("workspace_members")
      .select("user_id,username")
      .eq("workspace_id", workspaceId)
      .in("user_id", actorIds),
    supabase.from("profiles").select("id,full_name,email").in("id", actorIds),
  ]);

  const pinById = new Map(pinRows.map((m) => [m.id, m]));
  const spaceCodeById = new Map(
    ((spaces ?? []) as SpaceRow[]).map((s) => [s.id, s.code?.trim() || "UNKN"]),
  );
  const memberById = new Map(((members ?? []) as MemberRow[]).map((m) => [m.user_id, m]));
  const profileById = new Map(((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p]));

  const inboxEvents: InboxEvent[] = [];
  for (const e of eventRows) {
    const pin = pinById.get(e.mark_id);
    if (!pin) continue;
    const member = memberById.get(e.actor_user_id);
    const profile = profileById.get(e.actor_user_id);
    const fallbackName = profile?.email?.split("@")[0] ?? "Unknown";
    const actorName = profile?.full_name?.trim() || fallbackName;
    inboxEvents.push({
      id: e.id,
      pinId: e.mark_id,
      pinTitle: pin.title?.trim() || "(untitled)",
      spaceId: pin.space_id,
      actorId: e.actor_user_id,
      actorName,
      actorUsername: member?.username?.trim() ?? "",
      actorInitials: initialsFromFullName(actorName),
      type: e.type,
      fromValue: e.from_value ?? undefined,
      toValue: e.to_value ?? undefined,
      createdAt: e.created_at,
      unread: lastReadAt === "" ? true : e.created_at > lastReadAt,
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
  const { supabase, userId, workspaceId } = await requireSession();
  const lastReadAt = readAt ?? new Date().toISOString();
  const { error } = await supabase.from("inbox_read_states").upsert(
    {
      workspace_id: workspaceId,
      user_id: userId,
      last_read_at: lastReadAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "workspace_id,user_id" },
  );
  if (error) throw error;
  return { lastReadAt };
}
