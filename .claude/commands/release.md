---
name: release
description: "Create a release PR from dev to main with tag, changelog, and GitHub release"
category: Workflow
---

# Create Release

You are a release assistant. Create a release PR from the dev branch to main, with proper versioning, changelog, and a GitHub release.

## Step 1 — Branch Discovery & Validation

Detect the project's branch structure:

```bash
git branch --show-current
git branch -r | grep -E 'origin/(main|master|develop|development|dev)$'
```

From the remote branches, identify:
- **Main branch**: prefer `main` over `master`
- **Dev branch**: prefer `develop` over `development` over `dev`

**Validation:**
- If no dev branch exists: tell the user this project doesn't use a dev branch workflow and suggest using `/pr` instead
- If not currently on the dev branch: ask the user to switch or offer to switch for them
- If the dev branch is not ahead of main: **STOP** — nothing to release

## Step 2 — Determine Version

Check the latest tag and the commits since then:

```bash
git fetch --tags
git tag --sort=-v:refname | head -5
git log <latest-tag>..HEAD --oneline
```

Analyze the commits to suggest the next version based on semver:
- **MAJOR** — any commit with `!` or `BREAKING CHANGE:` footer
- **MINOR** — any `feat` commit
- **PATCH** — only `fix`, `refactor`, `perf`, `docs`, `chore`, etc.

If no tags exist, suggest `v1.0.0` as the first release.

Present the suggestion to the user and let them confirm or override:

```
Latest tag: v1.2.3
Commits since last release: 8
Suggested next version: v1.3.0 (minor — new features, no breaking changes)

Use v1.3.0? (or type a different version)
```

## Step 3 — Build Changelog

Generate a changelog from commits between the latest tag and HEAD, grouped by type:

```
## What's Changed

### Features
- Add OAuth2 login with Google provider (#42)
- Add full-text search to dashboard (#38)

### Bug Fixes
- Fix cart total calculation with discounts (#45)
- Handle null response from /users endpoint (#41)

### Other
- Bump express to v5 (#44)
- Refactor auth middleware for clarity (#40)
```

**Changelog rules:**
- Group by: Features (`feat`), Bug Fixes (`fix`), Performance (`perf`), Breaking Changes, Other (everything else)
- Use the commit's short description, not the full body
- Include PR/issue numbers if referenced in commits
- Skip `chore` commits that are noise (e.g., merge commits, version bumps)

## Step 4 — Create Release Branch and PR

```bash
git checkout -b release/<version>
git push -u origin release/<version>
```

Create the PR targeting the main branch:

```bash
gh pr create --base <main-branch> --title "release: <version>" --body "$(cat <<'EOF'
## Release <version>

<changelog from Step 3>

## Checklist
- [ ] Changelog reviewed
- [ ] Version numbers updated (if applicable)
- [ ] All CI checks passing
- [ ] QA sign-off (if applicable)
EOF
)"
```

## Step 5 — After PR is Merged (tag and release)

Tell the user to run `/release` again after the PR is merged, or instruct them to do the following manually:

Once the release PR is merged into main, create the tag and GitHub release:

```bash
git checkout <main-branch>
git pull
git tag -a <version> -m "Release <version>"
git push origin <version>
gh release create <version> --title "<version>" --notes "$(cat <<'EOF'
<changelog from Step 3>
EOF
)"
```

## Examples

### BAD — Manual, unstructured release

```bash
git checkout main
git merge develop
git tag v1.3.0
git push --tags
```

### GOOD — Structured release flow

```bash
# On develop branch
git checkout -b release/v1.3.0
git push -u origin release/v1.3.0
gh pr create --base main --title "release: v1.3.0" --body "..."
# After merge:
git tag -a v1.3.0 -m "Release v1.3.0"
git push origin v1.3.0
gh release create v1.3.0 --title "v1.3.0" --notes "..."
```

### BAD — Wrong version bump

```
Commits: feat: add search, fix: typo
Tag: v1.0.0 → v1.0.1  (should be v1.1.0 because of feat)
```

### GOOD — Correct semver analysis

```
Commits: feat: add search, fix: typo
Tag: v1.0.0 → v1.1.0  (minor bump because of feat)
```

## Step 6 — Output

Show the result:

```
Release PR created:
  Version:  v1.3.0
  Branch:   release/v1.3.0 → main
  PR:       https://github.com/org/repo/pull/50

After merge, run /release again to create the tag and GitHub release.
```

## Rules

- NEVER release from a branch other than the dev branch
- NEVER skip version confirmation with the user
- NEVER tag before the PR is merged into main
- NEVER merge directly — always go through a release PR
- ALWAYS detect main and dev branches automatically
- ALWAYS analyze commits to suggest the correct semver bump
- ALWAYS generate a grouped changelog
- ALWAYS create a `release/<version>` branch for the PR
- ALWAYS include a checklist in the release PR
- ALWAYS show the PR URL when done
- If `gh` CLI is not installed or not authenticated, tell the user how to set it up
- If the project has a `package.json`, `Cargo.toml`, `pyproject.toml`, or similar version file, remind the user to update it before releasing
