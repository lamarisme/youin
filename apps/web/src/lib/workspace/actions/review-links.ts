"use server";

import { and, desc, eq, isNull } from "drizzle-orm";

import { spaces, workspaceReviewLinks } from "@/db/schema";
import type { WorkspaceReviewLink } from "@/lib/collab-types";
import { assertWorkspaceOwner } from "@/lib/workspace/authz";

import { requireWorkspaceContext, revalidateWorkspaceViews } from "./session";

const MAX_ACTIVE_REVIEW_LINKS = 10;

function toIso(value: Date | string | null): string | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : value;
}

function token(): string {
  return `${crypto.randomUUID().replace(/-/g, "")}${crypto
    .randomUUID()
    .replace(/-/g, "")}`;
}

function normalizeTargetOrigin(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Enter the site origin for this review link.");

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    throw new Error("Enter a valid site URL, like https://staging.example.com.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Review links only support http and https sites.");
  }
  return url.origin;
}

function fallbackNameForOrigin(origin: string): string {
  try {
    return new URL(origin).hostname;
  } catch {
    return "Guest review";
  }
}

function toReviewLink(row: typeof workspaceReviewLinks.$inferSelect): WorkspaceReviewLink {
  return {
    id: row.id,
    name: row.name,
    spaceId: row.spaceId,
    targetOrigin: row.targetOrigin,
    token: row.token,
    createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
    expiresAt: toIso(row.expiresAt),
    revokedAt: toIso(row.revokedAt),
    lastUsedAt: toIso(row.lastUsedAt),
  };
}

export async function createReviewLinkAction(input: {
  name?: string;
  targetOrigin: string;
  spaceId: string;
}): Promise<WorkspaceReviewLink> {
  const ctx = await requireWorkspaceContext();
  assertWorkspaceOwner(ctx);

  const targetOrigin = normalizeTargetOrigin(input.targetOrigin);
  const name = input.name?.trim() || fallbackNameForOrigin(targetOrigin);
  if (name.length > 80) throw new Error("Review link name is too long.");

  const [space] = await ctx.db
    .select({ id: spaces.id })
    .from(spaces)
    .where(and(eq(spaces.id, input.spaceId), eq(spaces.workspaceId, ctx.workspaceId)))
    .limit(1);
  if (!space) throw new Error("Choose a valid destination space.");

  const activeLinks = await ctx.db
    .select({ id: workspaceReviewLinks.id })
    .from(workspaceReviewLinks)
    .where(
      and(
        eq(workspaceReviewLinks.workspaceId, ctx.workspaceId),
        isNull(workspaceReviewLinks.revokedAt),
      ),
    )
    .limit(MAX_ACTIVE_REVIEW_LINKS + 1);
  if (activeLinks.length >= MAX_ACTIVE_REVIEW_LINKS) {
    throw new Error(`You can keep up to ${MAX_ACTIVE_REVIEW_LINKS} active review links.`);
  }

  const [created] = await ctx.db
    .insert(workspaceReviewLinks)
    .values({
      workspaceId: ctx.workspaceId,
      spaceId: input.spaceId,
      name,
      targetOrigin,
      token: token(),
      createdByUserId: ctx.userId,
    })
    .returning();
  if (!created) throw new Error("Could not create review link.");

  revalidateWorkspaceViews();
  return toReviewLink(created);
}

export async function revokeReviewLinkAction(linkId: string): Promise<void> {
  const ctx = await requireWorkspaceContext();
  assertWorkspaceOwner(ctx);

  const [updated] = await ctx.db
    .update(workspaceReviewLinks)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(workspaceReviewLinks.id, linkId),
        eq(workspaceReviewLinks.workspaceId, ctx.workspaceId),
      ),
    )
    .returning({ id: workspaceReviewLinks.id });
  if (!updated) throw new Error("Review link not found.");

  revalidateWorkspaceViews();
}

export async function listRecentReviewLinksAction(): Promise<WorkspaceReviewLink[]> {
  const ctx = await requireWorkspaceContext();
  const rows = await ctx.db
    .select()
    .from(workspaceReviewLinks)
    .where(eq(workspaceReviewLinks.workspaceId, ctx.workspaceId))
    .orderBy(desc(workspaceReviewLinks.createdAt))
    .limit(20);
  return rows.map(toReviewLink);
}
