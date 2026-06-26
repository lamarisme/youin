import type { ParsedMention } from "./types.ts";

export const MENTION_USERNAME_MIN_LENGTH = 2;
export const MENTION_USERNAME_MAX_LENGTH = 32;

function isLowercaseAsciiLetter(ch: string): boolean {
  return ch >= "a" && ch <= "z";
}

function isAsciiDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

function isUsernameBodyChar(ch: string): boolean {
  return isLowercaseAsciiLetter(ch) || isAsciiDigit(ch) || ch === "_";
}

function isMentionBoundaryBefore(ch: string | undefined): boolean {
  return ch === undefined || !/[A-Za-z0-9_@]/.test(ch);
}

function isMentionBoundaryAfter(ch: string | undefined): boolean {
  if (ch === undefined) return true;
  if (/\s/.test(ch)) return true;
  return /[.,;:!?)\]}>"']/.test(ch);
}

export function isMentionUsername(value: string): boolean {
  if (
    value.length < MENTION_USERNAME_MIN_LENGTH ||
    value.length > MENTION_USERNAME_MAX_LENGTH
  ) {
    return false;
  }
  if (!isLowercaseAsciiLetter(value[0] ?? "")) return false;
  for (let i = 1; i < value.length; i += 1) {
    if (!isUsernameBodyChar(value[i] ?? "")) return false;
  }
  return true;
}

export function parseMentions(text: string): ParsedMention[] {
  const mentions: ParsedMention[] = [];
  let i = 0;

  while (i < text.length) {
    if (text[i] !== "@") {
      i += 1;
      continue;
    }

    const start = i;
    const previous = start > 0 ? text[start - 1] : undefined;
    if (!isMentionBoundaryBefore(previous)) {
      i += 1;
      continue;
    }

    let cursor = start + 1;
    while (cursor < text.length && isUsernameBodyChar(text[cursor] ?? "")) {
      cursor += 1;
    }

    const username = text.slice(start + 1, cursor);
    const next = cursor < text.length ? text[cursor] : undefined;
    if (isMentionUsername(username) && isMentionBoundaryAfter(next)) {
      mentions.push({ username, start, end: cursor });
      i = cursor;
      continue;
    }

    i += 1;
  }

  return mentions;
}

