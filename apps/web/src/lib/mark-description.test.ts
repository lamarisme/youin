import assert from "node:assert/strict";
import test from "node:test";

import {
  markDescriptionPlainText,
  normalizeDescriptionForStorage,
  storedDescriptionToEditorHtml,
} from "./mark-description.ts";

test("storedDescriptionToEditorHtml renders raw markdown notes into supported Tiptap HTML", () => {
  const html = storedDescriptionToEditorHtml(
    [
      "# Fix the CTA",
      "",
      "Use **Save changes** and link to [docs](https://example.com/docs).",
      "",
      "- keep focus visible",
      "- support `Escape`",
      "",
      "> Ship the small thing.",
    ].join("\n"),
  );

  assert.match(html, /<h1>Fix the CTA<\/h1>/);
  assert.match(html, /<strong>Save changes<\/strong>/);
  assert.match(
    html,
    /<a href="https:\/\/example.com\/docs"[^>]*>docs<\/a>/,
  );
  assert.match(html, /<ul><li>keep focus visible<\/li><li>support <code>Escape<\/code><\/li><\/ul>/);
  assert.match(html, /<blockquote><p>Ship the small thing\.<\/p><\/blockquote>/);
});

test("normalizeDescriptionForStorage converts markdown to sanitized HTML", () => {
  const html = normalizeDescriptionForStorage(
    "**Bold** <script>alert('x')</script>\n\n---\n\n```js\nalert('x')\n```",
  );

  assert.equal(html.includes("<script>"), false);
  assert.match(html, /<strong>Bold<\/strong>/);
  assert.match(html, /<hr>/);
  assert.match(html, /<pre><code>alert\('x'\)<\/code><\/pre>/);
});

test("normalizeDescriptionForStorage renders markdown typed into editor paragraphs", () => {
  const html = normalizeDescriptionForStorage(
    [
      "<p># Fix the CTA</p>",
      "<p>Use **Save changes** and link to [docs](https://example.com/docs).</p>",
      "<p>- keep focus visible</p>",
      "<p>- support `Escape`</p>",
    ].join(""),
  );

  assert.match(html, /<h1>Fix the CTA<\/h1>/);
  assert.match(html, /<strong>Save changes<\/strong>/);
  assert.match(
    html,
    /<a href="https:\/\/example.com\/docs"[^>]*>docs<\/a>/,
  );
  assert.match(
    html,
    /<ul><li>keep focus visible<\/li><li>support <code>Escape<\/code><\/li><\/ul>/,
  );
});

test("storedDescriptionToEditorHtml keeps already rich editor HTML intact", () => {
  const html = storedDescriptionToEditorHtml(
    "<p><strong>Already rich</strong> and **literal**.</p>",
  );

  assert.match(html, /<strong>Already rich<\/strong>/);
  assert.match(html, /\*\*literal\*\*/);
});

test("plain text extraction works on rendered markdown notes", () => {
  const html = normalizeDescriptionForStorage("Fix **copy** and `focus`.");

  assert.equal(markDescriptionPlainText(html), "Fix copy and focus.");
});
