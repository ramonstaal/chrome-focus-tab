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

In Cursor, you can ask the agent to cut a release — it should follow the **chrome-extension-release** skill in `.cursor/skills/chrome-extension-release/` (and **firefox-extension-release** in `.cursor/skills/firefox-extension-release/` for Firefox install and AMO notes). The same tag and zip ship both browsers.

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

**Chrome**

1. Download the zip from the release page.
2. Unzip it.
3. In `chrome://extensions/`, click **Load unpacked** and select the unzipped folder.
4. Open a new tab and verify the focus dashboard loads.

**Firefox**

1. Download the **same** zip and unzip it.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…** and select `manifest.json` inside the unzipped folder.
4. Open a new tab and verify the focus dashboard loads.

Temporary add-ons last until you quit Firefox; they are meant for QA and developer installs.

---

## Firefox distribution

The release workflow produces one MV3 zip. `manifest.json` includes `browser_specific_settings.gecko` (add-on ID, minimum Firefox version, and `data_collection_permissions` declaring no off-device data collection). Chrome ignores the `gecko` block; Firefox requires it for AMO and for a stable extension ID.

### Sideload for testing (temporary)

Use the smoke-test steps above. No signing step is required.

### Publishing to Firefox Add-ons (AMO)

1. Create or use a [Firefox Add-on developer account](https://addons.mozilla.org/developers/).
2. Submit a new add-on and upload the same `focus-todo-new-tab-v<version>.zip` from GitHub Releases (or from `npm run package` locally).
3. Complete the listing (summary, screenshots, privacy policy if required by policy). This extension stores data only in extension storage and declared APIs; align the privacy questionnaire with that.
4. The add-on ID in the manifest (`browser_specific_settings.gecko.id`) must stay the same for all future updates of that listing. If you fork the project, generate a new ID before your first AMO submission.

### Optional: signed `.xpi` with `web-ext`

For self-hosted updates or internal distribution outside AMO, Mozilla’s signing service can produce a signed `.xpi`. Typical flow: install [`web-ext`](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/), set API credentials from the AMO developer hub, then run `web-ext sign --source-dir dist` (after `npm run build`) or point at your unzipped release folder. See Extension Workshop’s **web-ext** docs for current flags and JWT keys.

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

## Sync server (Cloudflare Worker)

The optional cross-device sync backend lives in `sync-server/` and deploys via [`.github/workflows/deploy-sync.yml`](.github/workflows/deploy-sync.yml) when `sync-server/**` changes on `main`.

### One-time Cloudflare + GitHub setup

1. Create a Cloudflare API token (**Edit Cloudflare Workers** template) and note your Account ID.
2. Create KV namespaces and update `sync-server/wrangler.toml`:

   ```bash
   cd sync-server && npm ci
   npx wrangler kv namespace create SYNC_KV
   npx wrangler kv namespace create SYNC_KV --preview
   ```

3. Add GitHub Actions secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
4. Push to `main` — confirm **Deploy sync server** succeeds.
5. Set `VITE_SYNC_API_URL` in `.env.production` to the deployed `*.workers.dev` URL before building the extension for sync users.

See [README — Sync](README.md#sync-optional) for end-user token setup.

---

## (Optional) Publishing to the Chrome Web Store

The same `release/focus-todo-new-tab-v<version>.zip` produced by `npm run package` is the exact artifact the Chrome Web Store expects.

1. Create a developer account at [chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole) (one-time US$5 fee).
2. Click **New item** and upload the zip.
3. Fill in the listing (description, screenshots, category, etc.).
4. Submit for review.

For subsequent versions, upload the new zip to the existing item and re-submit.

> The Chrome Web Store enforces some extra constraints not checked here (icon sizes, screenshot dimensions, privacy policy URL for extensions that touch user data). If users enable optional sync, disclose that data is sent to their Cloudflare Worker (see README).
