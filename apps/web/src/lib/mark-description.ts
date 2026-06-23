import DOMPurify from "isomorphic-dompurify";

export const MARK_DESCRIPTION_MAX_LENGTH = 3000;
export const MARK_COMMENT_MAX_LENGTH = 2000;

const MARK_DESCRIPTION_PURIFY = {
  ALLOWED_TAGS: [
    "p",
    "br",
    "h1",
    "h2",
    "h3",
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
    "pre",
    "blockquote",
    "hr",
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
    .replace(/\s+([.,!?;:])/g, "$1")
    .trim();
}

export function looksLikeRichHtml(s: string): boolean {
  return /<\/?[a-z][a-z0-9]*\b/i.test(s);
}

export function looksLikeMarkdown(s: string): boolean {
  return (
    /^ {0,3}#{1,6}\s+\S/m.test(s) ||
    /^ {0,3}>\s?\S/m.test(s) ||
    /^ {0,3}[-*+]\s+\S/m.test(s) ||
    /^ {0,3}\d+[.)]\s+\S/m.test(s) ||
    /^ {0,3}(```|~~~)/m.test(s) ||
    /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/m.test(s) ||
    /(?:\*\*|__)\S[\s\S]*?\S(?:\*\*|__)/.test(s) ||
    /(^|[\s(])\*\S[^*\n]*\*(?=[\s).,!?:;]|$)/.test(s) ||
    /~~\S[\s\S]*?\S~~/.test(s) ||
    /`[^`\n]+`/.test(s) ||
    /\[[^\]\n]+\]\([^) \n]+(?:\s+"[^"]*")?\)/.test(s)
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInlineMarkdown(raw: string): string {
  const codeParts: string[] = [];
  let html = escapeHtml(raw).replace(/`([^`\n]+)`/g, (_match, code: string) => {
    const index = codeParts.push(`<code>${code}</code>`) - 1;
    return `\u0000CODE${index}\u0000`;
  });

  html = html.replace(
    /\[([^\]\n]+)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g,
    (_match, label: string, href: string) =>
      `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`,
  );
  html = html.replace(/(?:\*\*|__)(\S[\s\S]*?\S)(?:\*\*|__)/g, "<strong>$1</strong>");
  html = html.replace(/~~(\S[\s\S]*?\S)~~/g, "<s>$1</s>");
  html = html.replace(/(^|[\s(])\*(\S[^*\n]*?\S?)\*(?=[\s).,!?:;]|$)/g, "$1<em>$2</em>");

  return html.replace(/\u0000CODE(\d+)\u0000/g, (_match, index: string) => codeParts[Number(index)] ?? "");
}

function renderMarkdownParagraph(lines: string[]): string {
  return `<p>${lines.map((line) => renderInlineMarkdown(line)).join("<br>")}</p>`;
}

function renderMarkdownQuote(lines: string[]): string {
  const content = lines
    .map((line) => line.replace(/^ {0,3}>\s?/, ""))
    .join("\n")
    .trim();
  return `<blockquote>${markdownToHtml(content)}</blockquote>`;
}

function renderMarkdownList(lines: string[], ordered: boolean): string {
  const items = lines
    .map((line) =>
      line.replace(
        ordered ? /^ {0,3}\d+[.)]\s+/ : /^ {0,3}[-*+]\s+/,
        "",
      ),
    )
    .map((item) => `<li>${renderInlineMarkdown(item)}</li>`)
    .join("");
  return ordered ? `<ol>${items}</ol>` : `<ul>${items}</ul>`;
}

export function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (!line.trim()) {
      i += 1;
      continue;
    }

    const fence = line.match(/^ {0,3}(```|~~~)\s*([A-Za-z0-9_-]+)?\s*$/);
    if (fence) {
      const close = fence[1];
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !(lines[i] ?? "").startsWith(close)) {
        code.push(lines[i] ?? "");
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }

    if (/^ {0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      blocks.push("<hr>");
      i += 1;
      continue;
    }

    const heading = line.match(/^ {0,3}(#{1,3})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const level = Math.min(heading[1].length, 3);
      blocks.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }

    if (/^ {0,3}>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^ {0,3}>\s?/.test(lines[i] ?? "")) {
        quoteLines.push(lines[i] ?? "");
        i += 1;
      }
      blocks.push(renderMarkdownQuote(quoteLines));
      continue;
    }

    if (/^ {0,3}[-*+]\s+\S/.test(line)) {
      const listLines: string[] = [];
      while (i < lines.length && /^ {0,3}[-*+]\s+\S/.test(lines[i] ?? "")) {
        listLines.push(lines[i] ?? "");
        i += 1;
      }
      blocks.push(renderMarkdownList(listLines, false));
      continue;
    }

    if (/^ {0,3}\d+[.)]\s+\S/.test(line)) {
      const listLines: string[] = [];
      while (i < lines.length && /^ {0,3}\d+[.)]\s+\S/.test(lines[i] ?? "")) {
        listLines.push(lines[i] ?? "");
        i += 1;
      }
      blocks.push(renderMarkdownList(listLines, true));
      continue;
    }

    const paragraphLines: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? "").trim() &&
      !/^ {0,3}(#{1,3}\s+|>\s?|[-*+]\s+\S|\d+[.)]\s+\S|```|~~~)/.test(lines[i] ?? "") &&
      !/^ {0,3}([-*_])(?:\s*\1){2,}\s*$/.test(lines[i] ?? "")
    ) {
      paragraphLines.push(lines[i] ?? "");
      i += 1;
    }
    blocks.push(renderMarkdownParagraph(paragraphLines));
  }

  return blocks.join("");
}

function legacyPlainToEditorHtml(plain: string): string {
  const escaped = escapeHtml(plain);
  if (!escaped.trim()) return "<p></p>";
  return `<p>${escaped.replace(/\n/g, "<br>")}</p>`;
}

function decodeBasicHtmlEntities(s: string): string {
  const decodeEntity = (value: number, fallback: string) =>
    Number.isFinite(value) && value >= 0 && value <= 0x10ffff
      ? String.fromCodePoint(value)
      : fallback;

  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (match, code: string) =>
      decodeEntity(Number(code), match),
    )
    .replace(/&#x([0-9a-f]+);/gi, (match, code: string) =>
      decodeEntity(Number.parseInt(code, 16), match),
    );
}

function markdownBlockKind(
  s: string,
): "ordered" | "quote" | "unordered" | null {
  if (/^ {0,3}[-*+]\s+\S/.test(s)) return "unordered";
  if (/^ {0,3}\d+[.)]\s+\S/.test(s)) return "ordered";
  if (/^ {0,3}>\s?/.test(s)) return "quote";
  return null;
}

function joinEditorMarkdownBlocks(blocks: string[]): string {
  return blocks.reduce((out, block) => {
    if (!out) return block;
    const lines = out.split("\n");
    const previous = lines[lines.length - 1] ?? "";
    const previousKind = markdownBlockKind(previous);
    const nextKind = markdownBlockKind(block);
    const separator =
      previousKind && previousKind === nextKind ? "\n" : "\n\n";
    return `${out}${separator}${block}`;
  }, "");
}

function plainEditorHtmlToMarkdownSource(html: string): string | null {
  const paragraphRe = /<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi;
  const blocks: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = paragraphRe.exec(html))) {
    if (html.slice(lastIndex, match.index).trim()) return null;
    const inner = match[1].replace(/<br\s*\/?>/gi, "\n");
    if (looksLikeRichHtml(inner)) return null;
    blocks.push(decodeBasicHtmlEntities(inner).trim());
    lastIndex = paragraphRe.lastIndex;
  }

  if (blocks.length) {
    if (html.slice(lastIndex).trim()) return null;
    return joinEditorMarkdownBlocks(blocks);
  }

  const lineBreakText = html.replace(/<br\s*\/?>/gi, "\n");
  if (looksLikeRichHtml(lineBreakText)) return null;
  return decodeBasicHtmlEntities(lineBreakText).trim();
}

/** Load DB / API string into TipTap (supports legacy plain text and stored HTML). */
export function storedDescriptionToEditorHtml(stored: string): string {
  const t = stored ?? "";
  if (!t.trim()) return "<p></p>";
  if (looksLikeRichHtml(t)) {
    const sanitized = sanitizeMarkDescriptionHtml(t);
    const markdownSource = plainEditorHtmlToMarkdownSource(sanitized);
    if (markdownSource && looksLikeMarkdown(markdownSource)) {
      return sanitizeMarkDescriptionHtml(markdownToHtml(markdownSource));
    }
    if (!looksLikeRichHtml(sanitized) && looksLikeMarkdown(sanitized)) {
      return sanitizeMarkDescriptionHtml(markdownToHtml(sanitized));
    }
    return sanitized;
  }
  if (looksLikeMarkdown(t)) return sanitizeMarkDescriptionHtml(markdownToHtml(t));
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
  const sanitized = sanitizeMarkDescriptionHtml(storedDescriptionToEditorHtml(raw.trim()));
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
