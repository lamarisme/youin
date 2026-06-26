export interface ParsedMention {
  /** Workspace-scoped username without the leading `@`. */
  username: string;
  /** Zero-based index of the leading `@` in the source text. */
  start: number;
  /** Exclusive end index of the mention token in the source text. */
  end: number;
}

export interface MentionableMember {
  /** Stable user identity for the workspace member. */
  userId: string;
  /** Workspace-scoped username without the leading `@`. */
  username: string;
}

export interface ResolvedMention {
  /** Stable identity of the mentioned user. */
  userId: string;
  /** Workspace-scoped username that appeared in the text. */
  username: string;
  /** Zero-based index of the leading `@` in the source text. */
  start: number;
  /** Exclusive end index of the mention token in the source text. */
  end: number;
}

export interface PreviousResolvedMention {
  /** Stable identity of the previously mentioned user. */
  userId: string;
  /** Previous username, if the caller has it. Not used as identity. */
  username?: string;
  /** Zero-based index of the leading `@` in the previous source text. */
  start: number;
  /** Exclusive end index of the mention token in the previous source text. */
  end: number;
}

export type IgnoredMentionReason =
  | "unknown_username"
  | "self_mention"
  | "duplicate_mention";

export interface IgnoredMention {
  username: string;
  start: number;
  end: number;
  reason: IgnoredMentionReason;
}

export interface ResolveMentionsInput {
  text: string;
  members: readonly MentionableMember[];
  previousMentions?: readonly PreviousResolvedMention[];
  currentUserId?: string | null;
}

export interface MentionResolutionPlan {
  parsedMentions: ParsedMention[];
  resolvedMentions: ResolvedMention[];
  mentionsToCreate: ResolvedMention[];
  mentionsToDelete: PreviousResolvedMention[];
  notificationTargets: string[];
  ignoredMentions: IgnoredMention[];
}
