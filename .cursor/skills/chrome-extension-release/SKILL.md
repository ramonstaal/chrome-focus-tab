---
name: chrome-extension-release
description: >-
  Cuts a GitHub Release for Focus Todo New Tab (chrome-focus-tab): bumps semver,
  commits, tags v*, and publishes the extension zip. Use when the user asks for
  a release, minor release, major release, patch release, new version on GitHub,
  publish/download zip, or bump version for shipping.
disable-model-invocation: false
---

# Chrome extension release (GitHub)

Ship **Focus Todo New Tab** to [GitHub Releases](https://github.com/ramonstaal/chrome-focus-tab/releases). Pushing tag `vX.Y.Z` triggers `.github/workflows/release.yml`, which builds and attaches `focus-todo-new-tab-vX.Y.Z.zip`.

**Source of truth for version:** `manifest.json` → `"version"`. It must equal `package.json` and the git tag (without `v`).

## Choose bump type

| User intent | Command | Example |
|-------------|---------|---------|
| Bug fixes only | `patch` | `1.0.0` → `1.0.1` |
| New features, compatible | `minor` | `1.0.0` → `1.1.0` |
| Breaking changes | `major` | `1.0.0` → `2.0.0` |

Chrome never accepts a **lower** manifest version on existing installs — only bump forward.

If `manifest.json` and `package.json` versions differ, run the bump script once; it reads `manifest.json` and syncs both.

## Release checklist

Copy and track progress:

```
Release progress:
- [ ] On main (or merge PR first), working tree clean except release files
- [ ] Bump version (patch | minor | major)
- [ ] Optional: npm ci && npm run package
- [ ] Commit version bump
- [ ] Push main
- [ ] Create and push tag vX.Y.Z
- [ ] Watch release workflow; confirm zip on Releases page
```

## Steps (agent executes)

### 1. Preflight

```bash
git status
git branch --show-current
```

- Prefer **`main`** with a clean tree before tagging.
- If the user only wanted a local bump, stop after step 2.

### 2. Bump version

```bash
npm run release:patch   # bugfix
npm run release:minor   # new features
npm run release:major   # breaking
```

Equivalent: `node scripts/bump-version.mjs <patch|minor|major>`

Read the script output for the new version `X.Y.Z`.

### 3. Verify locally (recommended)

```bash
npm ci
npm run package
unzip -l release/focus-todo-new-tab-vX.Y.Z.zip
```

Fix any version mismatch errors before committing.

### 4. Commit and push

```bash
git add manifest.json package.json package-lock.json
git commit -m "chore: release vX.Y.Z"
git push origin main
```

**Ask the user before push** if they did not explicitly ask to publish.

### 5. Tag (triggers GitHub Release)

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

Tag **must** be `v` + exact `manifest.json` version or CI fails.

### 6. Watch CI

```bash
gh run list --workflow=release.yml --limit 1
gh run watch
```

Success → new release with zip + auto-generated notes.

### 7. Tell the user how to install

1. Open Releases → download `focus-todo-new-tab-vX.Y.Z.zip`
2. Unzip → `chrome://extensions/` → **Load unpacked** → select folder
3. New tab should show the focus dashboard

## Do not

- Reuse or force-push a bad tag — bump patch and release again.
- Tag without pushing the version commit to `main` first (tag should point at that commit).

## Bad release recovery

```bash
gh release delete vX.Y.Z --yes
git push --delete origin vX.Y.Z
git tag -d vX.Y.Z
```

Then `npm run release:patch` and repeat from step 4.

## More detail

See [PUBLISHING.md](../../../PUBLISHING.md) at repo root (Chrome Web Store, first-time setup).
