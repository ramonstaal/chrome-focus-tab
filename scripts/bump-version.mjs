#!/usr/bin/env node
/**
 * Bump extension version in manifest.json and package.json (kept in sync).
 * Source of truth: manifest.json "version".
 *
 * Usage: node scripts/bump-version.mjs <patch|minor|major>
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const manifestPath = join(projectRoot, "manifest.json");
const packagePath = join(projectRoot, "package.json");
const lockPath = join(projectRoot, "package-lock.json");

const KINDS = ["patch", "minor", "major"];
const kind = process.argv[2];

if (!KINDS.includes(kind)) {
  process.stderr.write(
    `Usage: node scripts/bump-version.mjs <${KINDS.join("|")}>\n`,
  );
  process.exit(1);
}

function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(.*)?$/.exec(version);
  if (!match) {
    throw new Error(`Invalid semver "${version}" (expected X.Y.Z)`);
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    suffix: match[4] ?? "",
  };
}

function bumpVersion(version, bumpKind) {
  const parts = parseVersion(version);
  if (bumpKind === "major") {
    parts.major += 1;
    parts.minor = 0;
    parts.patch = 0;
  } else if (bumpKind === "minor") {
    parts.minor += 1;
    parts.patch = 0;
  } else {
    parts.patch += 1;
  }
  return `${parts.major}.${parts.minor}.${parts.patch}${parts.suffix}`;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function writeJson(path, data) {
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function main() {
  const manifest = await readJson(manifestPath);
  const pkg = await readJson(packagePath);

  const current = manifest.version;
  if (!current) {
    throw new Error("manifest.json is missing a version field.");
  }

  const packageWas = pkg.version;
  const next = bumpVersion(current, kind);

  manifest.version = next;
  pkg.version = next;

  await writeJson(manifestPath, manifest);
  await writeJson(packagePath, pkg);

  try {
    const lock = await readJson(lockPath);
    if (lock.version !== undefined) {
      lock.version = next;
      await writeJson(lockPath, lock);
    }
  } catch {
    // package-lock.json optional
  }

  const previous =
    packageWas !== current ? ` (package.json was ${packageWas})` : "";
  process.stdout.write(
    `Bumped ${kind}: ${current} → ${next}${previous}\n` +
      `Updated: manifest.json, package.json\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`[bump-version] ${err.message}\n`);
  process.exit(1);
});
