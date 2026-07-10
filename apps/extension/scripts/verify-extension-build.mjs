import {
  missingManifestReferences,
  readManifest,
  resolveBuildDir,
} from "./extension-manifest-utils.mjs";

const buildDir = resolveBuildDir();
const { manifest } = readManifest(buildDir);
const errors = [];

if (manifest.manifest_version !== 3) {
  errors.push("manifest_version must be 3 for Chrome Web Store publishing.");
}

if (!manifest.name?.trim()) errors.push("manifest.name is required.");
if (!manifest.version?.trim()) errors.push("manifest.version is required.");
if (!manifest.description?.trim()) {
  errors.push("manifest.description is required.");
}
if ((manifest.description ?? "").length > 132) {
  errors.push("manifest.description must be 132 characters or fewer.");
}

const externalMatches = manifest.externally_connectable?.matches ?? [];
if (externalMatches.length > 0) {
  errors.push(
    `Production manifest must not expose external messaging: ${externalMatches.join(", ")}`,
  );
}

const missing = missingManifestReferences(buildDir, manifest);
if (missing.length > 0) {
  errors.push(`Manifest references missing files: ${missing.join(", ")}`);
}

if (errors.length > 0) {
  throw new Error(errors.map((error) => `- ${error}`).join("\n"));
}

console.log(`Verified Chrome extension build at ${buildDir}`);
