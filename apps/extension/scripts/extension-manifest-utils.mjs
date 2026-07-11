import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const extensionRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

export function resolveBuildDir(rawBuildDir = process.argv[2]) {
  return rawBuildDir
    ? path.resolve(rawBuildDir)
    : path.join(extensionRoot, "build", "chrome-mv3-prod");
}

export function readManifest(buildDir) {
  const manifestPath = path.join(buildDir, "manifest.json");
  return {
    manifestPath,
    manifest: JSON.parse(fs.readFileSync(manifestPath, "utf8")),
  };
}

export function writeManifest(manifestPath, manifest) {
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`);
}

export function isWildcardResource(resource) {
  return resource.includes("*");
}

export function fileExists(buildDir, resource) {
  return fs.existsSync(path.join(buildDir, resource));
}

export function collectManifestFileReferences(manifest) {
  const refs = [];

  for (const value of Object.values(manifest.icons ?? {})) refs.push(value);
  for (const value of Object.values(manifest.action?.default_icon ?? {})) {
    refs.push(value);
  }
  if (manifest.action?.default_popup) refs.push(manifest.action.default_popup);
  if (manifest.background?.service_worker) {
    refs.push(manifest.background.service_worker);
  }

  for (const contentScript of manifest.content_scripts ?? []) {
    refs.push(...(contentScript.js ?? []), ...(contentScript.css ?? []));
  }

  for (const resourceSet of manifest.web_accessible_resources ?? []) {
    refs.push(...(resourceSet.resources ?? []));
  }

  return refs;
}

export function missingManifestReferences(buildDir, manifest) {
  return [...new Set(collectManifestFileReferences(manifest))]
    .filter((resource) => !isWildcardResource(resource))
    .filter((resource) => !fileExists(buildDir, resource))
    .sort();
}
