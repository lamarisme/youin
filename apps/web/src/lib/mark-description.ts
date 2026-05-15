import DOMPurify from "isomorphic-dompurify";

export const MARK_DESCRIPTION_MAX_LENGTH = 3000;
export const MARK_COMMENT_MAX_LENGTH = 2000;

const MARK_DESCRIPTION_PURIFY = {
  ALLOWED_TAGS: [
    "p",
    "br",
    "strong",
    "em",
    "b",
    "i",
    "u",
    "s",
    "strike",
    "del",
    "ul",
    "ol",
    "li",
    "a",
    "code",
    "blockquote",
  ],
  ALLOWED_ATTR: ["href", "target", "rel"],
  ALLOW_DATA_ATTR: false,
};

/**
 * Sanitize stored or incoming HTML before persisting or rendering.
 */
export function sanitizeMarkDescriptionHtml(dirty: string): string {
  return String(DOMPurify.sanitize(dirty, MARK_DESCRIPTION_PURIFY));
}

/**
 * Plain text for search / length checks (strips tags, collapses whitespace).
 */
export function markDescriptionPlainText(html: string): string {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function looksLikeRichHtml(s: string): boolean {
  return /<\/?[a-z][a-z0-9]*\b/i.test(s);
}

function legacyPlainToEditorHtml(plain: string): string {
  const escaped = plain
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  if (!escaped.trim()) return "<p></p>";
  return `<p>${escaped.replace(/\n/g, "<br>")}</p>`;
}

/** Load DB / API string into TipTap (supports legacy plain text and stored HTML). */
export function storedDescriptionToEditorHtml(stored: string): string {
  const t = stored ?? "";
  if (!t.trim()) return "<p></p>";
  if (looksLikeRichHtml(t)) return t;
  return legacyPlainToEditorHtml(t);
}

/** Normalize editor output while typing (no DOMPurify — avoids fighting the caret). */
export function editorHtmlToDraft(html: string): string {
  const trimmed = html.trim();
  if (
    !trimmed ||
    trimmed === "<p></p>" ||
    trimmed === "<p><br></p>" ||
    trimmed === "<p><br class=\"ProseMirror-trailingBreak\"></p>"
  ) {
    return "";
  }
  return html;
}

function normalizeRichTextForStorage(
  raw: string,
  maxLength: number,
  label: string,
): string {
  const sanitized = sanitizeMarkDescriptionHtml(raw.trim());
  const plain = markDescriptionPlainText(sanitized);
  if (!plain) return "";
  if (plain.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  }
  return sanitized;
}

/**
 * Sanitize and drop empty descriptions. Enforce character limit on plain-text length.
 */
export function normalizeDescriptionForStorage(raw: string): string {
  return normalizeRichTextForStorage(raw, MARK_DESCRIPTION_MAX_LENGTH, "Description");
}

/**
 * Sanitize and drop empty rich-text comments. Supports legacy plain-text comments.
 */
export function normalizeCommentForStorage(raw: string): string {
  return normalizeRichTextForStorage(raw, MARK_COMMENT_MAX_LENGTH, "Comment");
}
