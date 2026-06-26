export interface ParsedMention {
  /** Workspace-scoped username without the leading `@`. */
  username: string;
  /** Zero-based index of the leading `@` in the source text. */
  start: number;
  /** Exclusive end index of the mention token in the source text. */
  end: number;
}

