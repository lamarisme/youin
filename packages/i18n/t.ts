import messages from "./messages/en.json";

type Nested = string | number | boolean | null | Nested[] | { [k: string]: Nested };
type StringKeyOf<T> = Extract<keyof T, string>;
type StringLeafKey<T, Prefix extends string = ""> = {
  [K in StringKeyOf<T>]: T[K] extends string
    ? `${Prefix}${K}`
    : T[K] extends readonly unknown[]
      ? never
      : T[K] extends Record<string, unknown>
        ? StringLeafKey<T[K], `${Prefix}${K}.`>
        : never;
}[StringKeyOf<T>];

export type MessageKey = StringLeafKey<typeof messages>;

function lookup(parts: string[], root: Nested): string | undefined {
  let cur: Nested = root;
  for (const p of parts) {
    if (typeof cur !== "object" || cur === null || Array.isArray(cur)) return undefined;
    const next = (cur as Record<string, Nested>)[p];
    if (next === undefined) return undefined;
    cur = next;
  }
  return typeof cur === "string" ? cur : undefined;
}

/** Simple `{name}` interpolation for extension and non-React callers */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const raw = lookup(key.split("."), messages as Nested);
  if (raw === undefined) return key;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, name: string) =>
    params[name] !== undefined ? String(params[name]) : `{${name}}`,
  );
}

export { messages };
