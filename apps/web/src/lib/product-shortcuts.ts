export const PRODUCT_SHORTCUT_IDS = {
  openCommandPalette: "openCommandPalette",
  navigateInbox: "navigateInbox",
  navigateMyMarks: "navigateMyMarks",
  navigateViews: "navigateViews",
  navigateAccount: "navigateAccount",
} as const;

export type ProductShortcutId =
  (typeof PRODUCT_SHORTCUT_IDS)[keyof typeof PRODUCT_SHORTCUT_IDS];

export type ProductNavigationShortcutId =
  | typeof PRODUCT_SHORTCUT_IDS.navigateInbox
  | typeof PRODUCT_SHORTCUT_IDS.navigateMyMarks
  | typeof PRODUCT_SHORTCUT_IDS.navigateViews
  | typeof PRODUCT_SHORTCUT_IDS.navigateAccount;

export type ProductShortcutPlatform = "apple" | "control" | "generic";

type ProductShortcutKey = "mod" | "g" | "i" | "m" | "v" | "c" | "k";
type ProductShortcutChord = readonly ProductShortcutKey[];

export interface ProductShortcutDefinition {
  id: ProductShortcutId;
  sequence: readonly ProductShortcutChord[];
}

export interface ProductNavigationShortcut {
  id: ProductNavigationShortcutId;
  href: string;
}

export type ProductShortcutKeyboardEvent = Pick<
  KeyboardEvent,
  "altKey" | "ctrlKey" | "key" | "metaKey"
>;

export const PRODUCT_SHORTCUTS = {
  [PRODUCT_SHORTCUT_IDS.openCommandPalette]: {
    id: PRODUCT_SHORTCUT_IDS.openCommandPalette,
    sequence: [["mod", "k"]],
  },
  [PRODUCT_SHORTCUT_IDS.navigateInbox]: {
    id: PRODUCT_SHORTCUT_IDS.navigateInbox,
    sequence: [["g"], ["i"]],
  },
  [PRODUCT_SHORTCUT_IDS.navigateMyMarks]: {
    id: PRODUCT_SHORTCUT_IDS.navigateMyMarks,
    sequence: [["g"], ["m"]],
  },
  [PRODUCT_SHORTCUT_IDS.navigateViews]: {
    id: PRODUCT_SHORTCUT_IDS.navigateViews,
    sequence: [["g"], ["v"]],
  },
  [PRODUCT_SHORTCUT_IDS.navigateAccount]: {
    id: PRODUCT_SHORTCUT_IDS.navigateAccount,
    sequence: [["g"], ["c"]],
  },
} as const satisfies Record<ProductShortcutId, ProductShortcutDefinition>;

export const PRODUCT_NAVIGATION_SHORTCUTS = [
  {
    id: PRODUCT_SHORTCUT_IDS.navigateInbox,
    href: "/inbox",
  },
  {
    id: PRODUCT_SHORTCUT_IDS.navigateMyMarks,
    href: "/dashboard/mine",
  },
  {
    id: PRODUCT_SHORTCUT_IDS.navigateViews,
    href: "/views",
  },
  {
    id: PRODUCT_SHORTCUT_IDS.navigateAccount,
    href: "/account",
  },
] as const satisfies readonly ProductNavigationShortcut[];

const PRODUCT_NAVIGATION_SHORTCUTS_BY_ID = new Map(
  PRODUCT_NAVIGATION_SHORTCUTS.map((shortcut) => [shortcut.id, shortcut]),
);

const KEY_LABELS = {
  c: "C",
  g: "G",
  i: "I",
  k: "K",
  m: "M",
  v: "V",
} satisfies Record<Exclude<ProductShortcutKey, "mod">, string>;

export function detectProductShortcutPlatform(): ProductShortcutPlatform {
  if (typeof navigator === "undefined") return "generic";

  const platform = navigatorPlatform(navigator);

  return /Mac|iPhone|iPad|iPod/i.test(platform) ? "apple" : "control";
}

export function formatProductShortcut(
  id: ProductShortcutId,
  platform: ProductShortcutPlatform = "generic",
): string {
  return PRODUCT_SHORTCUTS[id].sequence
    .map((chord) =>
      chord.map((key) => formatProductShortcutKey(key, platform)).join(" "),
    )
    .join(" ");
}

export function matchesProductShortcutEvent(
  event: ProductShortcutKeyboardEvent,
  id: ProductShortcutId,
): boolean {
  const shortcut = PRODUCT_SHORTCUTS[id];

  if (shortcut.sequence.length !== 1) return false;

  return matchesProductShortcutChord(event, shortcut.sequence[0]);
}

export function isProductNavigationShortcutLeaderKey(key: string): boolean {
  const firstNavigationShortcut =
    PRODUCT_SHORTCUTS[PRODUCT_NAVIGATION_SHORTCUTS[0].id];
  const leaderKey = firstNavigationShortcut.sequence[0]?.[0];

  return normalizeProductShortcutKey(key) === leaderKey;
}

export function getProductNavigationShortcutByKey(
  key: string,
): ProductNavigationShortcut | undefined {
  const normalizedKey = normalizeProductShortcutKey(key);

  if (!normalizedKey) return undefined;

  return PRODUCT_NAVIGATION_SHORTCUTS.find((navigationShortcut) => {
    const finalChord = PRODUCT_SHORTCUTS[navigationShortcut.id].sequence.at(-1);

    return finalChord?.length === 1 && finalChord[0] === normalizedKey;
  });
}

export function getProductNavigationShortcut(
  id: ProductNavigationShortcutId,
): ProductNavigationShortcut {
  const shortcut = PRODUCT_NAVIGATION_SHORTCUTS_BY_ID.get(id);

  if (!shortcut) {
    throw new Error(`Unknown product navigation shortcut: ${id}`);
  }

  return shortcut;
}

function matchesProductShortcutChord(
  event: ProductShortcutKeyboardEvent,
  chord: ProductShortcutChord,
): boolean {
  const eventKey = normalizeProductShortcutKey(event.key);
  const chordKey = chord.find((key) => key !== "mod");

  if (!eventKey || eventKey !== chordKey) return false;
  if (event.altKey) return false;

  return chord.includes("mod")
    ? event.metaKey || event.ctrlKey
    : !event.metaKey && !event.ctrlKey;
}

function formatProductShortcutKey(
  key: ProductShortcutKey,
  platform: ProductShortcutPlatform,
): string {
  if (key === "mod") {
    if (platform === "apple") return "Cmd";
    if (platform === "control") return "Ctrl";
    return "Ctrl/Cmd";
  }

  return KEY_LABELS[key];
}

function normalizeProductShortcutKey(
  key: string,
): ProductShortcutKey | undefined {
  const normalized = key.toLowerCase();

  if (
    normalized === "c" ||
    normalized === "g" ||
    normalized === "i" ||
    normalized === "k" ||
    normalized === "m" ||
    normalized === "v"
  ) {
    return normalized;
  }

  return undefined;
}

function navigatorPlatform(nav: Navigator): string {
  const navigatorWithUserAgentData = nav as Navigator & {
    userAgentData?: { platform?: string };
  };

  return navigatorWithUserAgentData.userAgentData?.platform ?? nav.platform ?? "";
}
