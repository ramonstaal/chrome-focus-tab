#!/usr/bin/env node
/**
 * Build the project and package the dist/ folder into a zip suitable for:
 *   - "Load unpacked" in chrome://extensions (after unzipping)
 *   - Uploading to the Chrome Web Store as a new extension package
 *   - Firefox: temporary add-on (about:debugging) or AMO upload — same zip (MV3 + gecko in manifest)
 *
 * Output: release/<extension-slug>-v<version>.zip
 *
 * Behaviour:
 *   - Reads version from manifest.json so the zip name always matches
 *     the version Chrome will see.
 *   - Sanity-checks the dist/manifest.json version vs manifest.json so
 *     stale builds do not silently produce a mislabeled zip.
 *   - By default, runs `npm run build` first. Pass --no-build to skip (useful
 *     in CI where build is a separate step).
 */
import { spawnSync } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import archiver from "archiver";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const distDir = join(projectRoot, "dist");
const releaseDir = join(projectRoot, "release");
const sourceManifest = join(projectRoot, "manifest.json");
const distManifest = join(distDir, "manifest.json");

const args = new Set(process.argv.slice(2));
const skipBuild = args.has("--no-build");

function log(step, msg) {
  process.stdout.write(`[package] ${step.padEnd(8)} ${msg}\n`);
}

async function pathExists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function readJson(p) {
  return JSON.parse(await readFile(p, "utf8"));
}

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function runBuild() {
  log("build", "running `npm run build`...");
  const result = spawnSync("npm", ["run", "build"], {
    cwd: projectRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    throw new Error(`npm run build exited with code ${result.status}`);
  }
}

async function verifyDist(expectedVersion) {
  if (!(await pathExists(distDir))) {
    throw new Error(
      `dist/ not found at ${distDir}. Run \`npm run build\` first, or omit --no-build.`,
    );
  }
  if (!(await pathExists(distManifest))) {
    throw new Error(`dist/manifest.json not found at ${distManifest}.`);
  }
  const built = await readJson(distManifest);
  if (built.version !== expectedVersion) {
    throw new Error(
      `Version mismatch: manifest.json is ${expectedVersion} but dist/manifest.json is ${built.version}. ` +
        `Re-run the build (omit --no-build) to refresh dist/.`,
    );
  }
  const entries = await readdir(distDir);
  if (entries.length === 0) {
    throw new Error("dist/ is empty.");
  }
}

async function zipDist(outFile) {
  await mkdir(releaseDir, { recursive: true });
  await rm(outFile, { force: true });

  await new Promise((resolvePromise, rejectPromise) => {
    const output = createWriteStream(outFile);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => resolvePromise());
    output.on("error", rejectPromise);
    archive.on("warning", (err) => {
      if (err.code === "ENOENT") {
        process.stderr.write(`[package] warn     ${err.message}\n`);
      } else {
        rejectPromise(err);
      }
    });
    archive.on("error", rejectPromise);

    archive.pipe(output);
    // Zip the *contents* of dist/ so the manifest sits at the root of the
    // archive, which is what Chrome / the Web Store expect.
    archive.directory(distDir, false);
    archive.finalize();
  });
}

async function main() {
  const manifest = await readJson(sourceManifest);
  if (!manifest.version) {
    throw new Error("manifest.json is missing a version field.");
  }
  const slug = slugify(manifest.name || "chrome-extension");
  const zipName = `${slug}-v${manifest.version}.zip`;
  const outFile = join(releaseDir, zipName);

  log("info", `extension: ${manifest.name} v${manifest.version}`);
  log("info", `output:    release/${zipName}`);

  if (!skipBuild) {
    await runBuild();
  } else {
    log("build", "skipped (--no-build)");
  }

  await verifyDist(manifest.version);
  log("zip", "creating archive...");
  await zipDist(outFile);

  const { size } = await stat(outFile);
  const sizeKb = (size / 1024).toFixed(1);
  log("done", `wrote release/${zipName} (${sizeKb} KB)`);
}

main().catch((err) => {
  process.stderr.write(`[package] error    ${err.message}\n`);
  process.exit(1);
});
