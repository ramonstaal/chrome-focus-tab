---
name: firefox-extension-release
description: >-
  Ships the same GitHub Release zip for Firefox (Focus Todo New Tab): version
  bump, tag v*, CI artifact, temporary add-on / AMO notes. Use when the user
  asks for a Firefox release, AMO publish, or Firefox install from Releases.
disable-model-invocation: false
---

# Firefox extension release (GitHub)

This repo builds **one** MV3 package (`release/focus-todo-new-tab-vX.Y.Z.zip`) that is valid for **Chrome and Firefox**. Pushing tag `vX.Y.Z` triggers `.github/workflows/release.yml`, which attaches that zip to [GitHub Releases](https://github.com/ramonstaal/chrome-focus-tab/releases).

**Source of truth for version:** `manifest.json` → `"version"` (must match `package.json` and the git tag without `v`).

**Firefox-specific manifest:** `browser_specific_settings.gecko` (add-on ID, `strict_min_version`, `data_collection_permissions`). Do not change the **gecko `id`** after the extension is listed on AMO unless Mozilla support guides you — the ID is permanent for updates.

## Choose bump type

Same as Chrome: `patch` | `minor` | `major` via `npm run release:patch` (etc.). Firefox also requires monotonically increasing versions for listed add-ons.

## Release checklist

```
Release progress (Firefox + Chrome share one tag and one zip):
- [ ] On main, clean tree except version files
- [ ] Bump version (patch | minor | major)
- [ ] Optional: npm ci && npm run package
- [ ] Commit version bump
- [ ] Push main
- [ ] Create and push tag vX.Y.Z
- [ ] Watch release workflow; confirm zip on Releases page
- [ ] Firefox smoke-test: about:debugging → Load Temporary Add-on → manifest.json in unzipped folder
```

## Steps (agent executes)

### 1. Preflight

```bash
git status
git branch --show-current
```

Prefer **`main`** with a clean tree before tagging.

### 2. Bump version

```bash
npm run release:patch   # or :minor / :major
```

### 3. Verify locally (recommended)

```bash
npm ci
npm run package
unzip -l release/focus-todo-new-tab-vX.Y.Z.zip
```

Confirm `dist/manifest.json` (after build) includes `browser_specific_settings.gecko`.

### 4. Commit and push

```bash
git add manifest.json package.json package-lock.json
git commit -m "chore: release vX.Y.Z"
git push origin main
```

**Ask before push** if the user did not explicitly ask to publish.

### 5. Tag (triggers GitHub Release)

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

### 6. Watch CI

```bash
gh run list --workflow=release.yml --limit 1
gh run watch
```

### 7. End-user install (Firefox)

**Temporary (development / sideload):**

1. Releases → download `focus-todo-new-tab-vX.Y.Z.zip` → unzip.
2. `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on…** → choose `manifest.json` in that folder.
3. New tab should show the focus dashboard.

Temporary add-ons are removed when Firefox exits.

**Listed on AMO (persistent installs):**

See [PUBLISHING.md](../../../PUBLISHING.md) — Firefox Add-ons section: source zip, listing metadata, review. First-time listing needs the same add-on ID as in `manifest.json`.

**Signed `.xpi` (self-hosted or team distribution):**

Optional: Mozilla signing API + `web-ext sign` (documented in PUBLISHING.md). Not required for GitHub Releases zip + temporary load.

## Do not

- Reuse or force-push a bad tag — bump patch and release again.
- Change `browser_specific_settings.gecko.id` casually after users or AMO depend on it.

## Bad release recovery

Same as Chrome: delete GitHub release + remote tag + local tag, then bump and re-tag. See [chrome-extension-release](../chrome-extension-release/SKILL.md) or PUBLISHING.md.

## More detail

- [PUBLISHING.md](../../../PUBLISHING.md) — Chrome + Firefox maintainer flows.
- [Chrome release skill](../chrome-extension-release/SKILL.md) — identical bump/tag/CI steps; this skill only adds Firefox install and AMO notes.
