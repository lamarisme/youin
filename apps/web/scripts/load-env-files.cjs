"use strict";

/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("node:fs");
const path = require("node:path");

/**
 * Lightweight .env / .env.local loader (no deps). Earlier files win unless key already set.
 */
function parseEnv(text) {
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

function loadEnvFiles(cwd = process.cwd()) {
  for (const name of [".env", ".env.local"]) {
    const p = path.join(cwd, name);
    if (!fs.existsSync(p)) continue;
    try {
      parseEnv(fs.readFileSync(p, "utf8"));
    } catch {
      /* ignore */
    }
  }
}

module.exports = { loadEnvFiles };
