# Publishing & Releasing

Maintainer-facing guide for shipping new versions of **Focus Todo New Tab** to GitHub Releases so end users can install it without building from source.

There are two flows:

1. [First-time setup](#first-time-setup) — only needed once, when these changes haven't been pushed to GitHub yet.
2. [Cutting a new release](#cutting-a-new-release) — the everyday flow for shipping a new version.

---

## First-time setup

These steps push the packaging script and the GitHub Actions workflows to `origin/main` so future tags trigger an automated release.

1. **Review the local changes**

   ```bash
   git status
   git diff
   ```

2. **Commit the packaging + release infrastructure**

   ```bash
   git add .
   git commit -m "feat: add packaged extension export + release workflow"
   ```

3. **Push to GitHub**

   If you're working directly on `main`:

   ```bash
   git push origin main
   ```

   If you're on a feature branch (e.g. `cursor/add-project-readme`):

   ```bash
   git push -u origin HEAD
   gh pr create --fill          # or open a PR via the GitHub UI
   gh pr merge --squash --delete-branch
   ```

4. **Verify CI is green**

   The `CI` workflow (`.github/workflows/ci.yml`) runs on every push to `main` and every PR. Confirm it passed on the GitHub Actions tab — this proves the build and packaging steps work in CI before you tag.

   ```bash
   gh run list --workflow=ci.yml --limit 1
   ```

5. **Cut the first release** — follow [Cutting a new release](#cutting-a-new-release) below.

---

## Cutting a new release

The `Release` workflow (`.github/workflows/release.yml`) handles building, packaging, and publishing automatically whenever you push a `v*` tag.

### 1. Bump the version

The tag and the manifest version **must** match, or the release workflow will fail fast.

**Automated (recommended):**

```bash
npm run release:patch   # 1.0.0 → 1.0.1
npm run release:minor   # 1.0.0 → 1.1.0
npm run release:major   # 1.0.0 → 2.0.0
```

This updates `manifest.json`, `package.json`, and `package-lock.json` in one step (`manifest.json` is the source of truth).

**Manual:** edit both files:

- `manifest.json` → `"version"`
- `package.json` → `"version"`

In Cursor, you can ask the agent to cut a release — it should follow the **chrome-extension-release** skill in `.cursor/skills/chrome-extension-release/`.

Use [Semantic Versioning](https://semver.org/):

- **Patch** (`1.0.0` → `1.0.1`) — bug fixes only.
- **Minor** (`1.0.0` → `1.1.0`) — new features, backwards-compatible.
- **Major** (`1.0.0` → `2.0.0`) — breaking changes (e.g. removing a stored data key without migration).

> Chrome rejects manifest version downgrades on existing installs, so always go forward.

### 2. (Optional) Verify locally

```bash
npm ci
npm run package
unzip -l release/focus-todo-new-tab-v<version>.zip
```

The script will fail if the manifest version and the built `dist/manifest.json` don't match — that's the same check CI runs.

### 3. Commit, push, and tag

```bash
git add manifest.json package.json package-lock.json
git commit -m "chore: release v<version>"
git push origin main

git tag v<version>
git push origin v<version>
```

### 4. Watch the workflow

```bash
gh run watch
# or
gh run list --workflow=release.yml --limit 1
```

When the workflow finishes you'll have:

- A new entry on the [Releases page](https://github.com/ramonstaal/chrome-focus-tab/releases).
- An attached `focus-todo-new-tab-v<version>.zip` asset.
- Auto-generated release notes built from commits since the previous tag.

### 5. Smoke-test the published zip

1. Download the zip from the release page.
2. Unzip it.
3. In `chrome://extensions/`, click **Load unpacked** and select the unzipped folder.
4. Open a new tab and verify the focus dashboard loads.

---

## Fixing a bad release

If a release ships with a serious bug:

1. **Don't reuse the tag.** Bump the patch version (`1.0.1` → `1.0.2`) and cut a new release. Reusing or force-pushing a tag will not update users who already downloaded the old zip and creates confusing release history.
2. If the bad release is dangerous (e.g. data loss), mark it as **pre-release** or delete it in the GitHub UI so it's not the default download.

   ```bash
   gh release delete v<bad-version> --yes
   git push --delete origin v<bad-version>
   git tag -d v<bad-version>
   ```

   Then cut the corrected release with a new version number.

---

## (Optional) Publishing to the Chrome Web Store

The same `release/focus-todo-new-tab-v<version>.zip` produced by `npm run package` is the exact artifact the Chrome Web Store expects.

1. Create a developer account at [chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole) (one-time US$5 fee).
2. Click **New item** and upload the zip.
3. Fill in the listing (description, screenshots, category, etc.).
4. Submit for review.

For subsequent versions, upload the new zip to the existing item and re-submit.

> The Chrome Web Store enforces some extra constraints not checked here (icon sizes, screenshot dimensions, privacy policy URL for extensions that touch user data). The extension itself stays entirely local — no network, no analytics — so the privacy section is short.
