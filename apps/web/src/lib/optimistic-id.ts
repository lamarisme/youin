const OPTIMISTIC_ID_PREFIX = "optimistic:";

function randomId(): string {
  const cryptoRandom = globalThis.crypto?.randomUUID?.();
  if (cryptoRandom) return cryptoRandom;
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function createOptimisticId(scope: string): string {
  return `${OPTIMISTIC_ID_PREFIX}${scope}:${randomId()}`;
}

export function isOptimisticId(id: string | null | undefined): boolean {
  return Boolean(id?.startsWith(OPTIMISTIC_ID_PREFIX));
}
