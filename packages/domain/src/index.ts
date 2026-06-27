export const MARK_STATUSES = ["open", "closed"] as const;
export type MarkStatus = (typeof MARK_STATUSES)[number];

export const MARK_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type MarkPriority = (typeof MARK_PRIORITIES)[number];

export const LEGACY_EXTENSION_MARK_STATUSES = ["resolved"] as const;
export type LegacyExtensionMarkStatus =
  (typeof LEGACY_EXTENSION_MARK_STATUSES)[number];

export type MarkStatusInput = MarkStatus | LegacyExtensionMarkStatus | string | null | undefined;
export type MarkPriorityInput = MarkPriority | string | null | undefined;

const MARK_STATUS_SET = new Set<string>(MARK_STATUSES);
const MARK_PRIORITY_SET = new Set<string>(MARK_PRIORITIES);

export function isMarkStatus(value: unknown): value is MarkStatus {
  return typeof value === "string" && MARK_STATUS_SET.has(value);
}

export function isMarkPriority(value: unknown): value is MarkPriority {
  return typeof value === "string" && MARK_PRIORITY_SET.has(value);
}

export function normalizeMarkStatus(
  value: MarkStatusInput,
  fallback: MarkStatus = "open",
): MarkStatus {
  if (value === "resolved") return "closed";
  return isMarkStatus(value) ? value : fallback;
}

export function normalizeMarkPriority(
  value: MarkPriorityInput,
  fallback: MarkPriority = "medium",
): MarkPriority {
  return isMarkPriority(value) ? value : fallback;
}

export function isClosedMarkStatus(value: MarkStatusInput): boolean {
  return normalizeMarkStatus(value) === "closed";
}

export * from "./mentions/index.ts";
