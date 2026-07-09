import {
  fileExists,
  isWildcardResource,
  missingManifestReferences,
  readManifest,
  resolveBuildDir,
  writeManifest,
} from "./extension-manifest-utils.mjs";

const buildDir = resolveBuildDir();
const { manifestPath, manifest } = readManifest(buildDir);

let changed = false;

if (Array.isArray(manifest.externally_connectable?.matches)) {
  const productionMatches = manifest.externally_connectable.matches.filter(
    (match) => !match.includes("localhost") && !match.includes("127.0.0.1"),
  );
  if (
    productionMatches.length !== manifest.externally_connectable.matches.length
  ) {
    manifest.externally_connectable.matches = productionMatches;
    changed = true;
  }
}

if (Array.isArray(manifest.web_accessible_resources)) {
  const resourceSets = manifest.web_accessible_resources
    .map((resourceSet) => ({
      ...resourceSet,
      resources: (resourceSet.resources ?? []).filter(
        (resource) =>
          isWildcardResource(resource) || fileExists(buildDir, resource),
      ),
    }))
    .filter((resourceSet) => resourceSet.resources.length > 0);

  if (
    JSON.stringify(resourceSets) !==
    JSON.stringify(manifest.web_accessible_resources)
  ) {
    manifest.web_accessible_resources = resourceSets;
    changed = true;
  }

  if (manifest.web_accessible_resources.length === 0) {
    delete manifest.web_accessible_resources;
    changed = true;
  }
}

if (changed) writeManifest(manifestPath, manifest);

const missing = missingManifestReferences(buildDir, manifest);
if (missing.length > 0) {
  throw new Error(
    `Extension manifest references files that are missing from ${buildDir}: ${missing.join(", ")}`,
  );
}

console.log(`Finalized extension manifest at ${manifestPath}`);
