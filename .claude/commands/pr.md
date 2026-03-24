---
name: pr
description: "Create a pull request with summary, test plan, and proper base branch"
category: Workflow
---

# Create Pull Request

You are a pull request assistant. Analyze the current branch's changes and create a well-structured PR.

## Step 1 — Branch Discovery

Detect the project's branch structure:

```bash
git branch --show-current
git branch -r | grep -E 'origin/(main|master|develop|development|dev)$'
```

From the remote branches, identify:
- **Main branch**: prefer `main` over `master`
- **Dev branch**: prefer `develop` over `development` over `dev`

Determine the **base branch** for this PR:
- If a dev branch exists: the base is the dev branch (feature branches merge into dev)
- If no dev branch exists: the base is the main branch

If the current branch IS a protected branch (main, master, develop, dev, development), **STOP** — tell the user they need to be on a feature/fix branch to create a PR.

## Step 2 — Analyze Changes

Review everything that will be in the PR:

```bash
git log <base-branch>..HEAD --oneline
git diff <base-branch>...HEAD --stat
git diff <base-branch>...HEAD
```

Understand:
- What commits are included (ALL of them, not just the latest)
- What files changed and why
- The overall purpose of the changes

## Step 3 — Push Branch

Ensure the branch is pushed to the remote:

```bash
git push -u origin HEAD
```

## Step 4 — Create the PR

Build the PR using `gh pr create`:

```bash
gh pr create --base <base-branch> --title "<title>" --body "$(cat <<'EOF'
## Summary
<1-3 bullet points explaining WHAT and WHY>

## Changes
<grouped list of notable changes — skip trivial ones>

## Test plan
- [ ] <how to verify this works>
- [ ] <edge cases checked>
- [ ] <any manual testing steps>
EOF
)"
```

### Title

- Keep under 70 characters
- Use conventional commit style: `feat(scope): short description`
- Match the dominant type of changes in the PR

### Summary

- Lead with WHY, not WHAT — the diff already shows what changed
- 1-3 bullet points, concise
- Mention any decisions or trade-offs worth calling out

### Changes

- Group by area or theme, not by file
- Only list notable changes — reviewers can read the diff for the rest
- Call out anything non-obvious or surprising

### Test Plan

- Be specific — "tested locally" is not a test plan
- Include manual steps a reviewer could follow
- Mention what automated tests cover

## Examples

### BAD — Lazy PR

```
Title: updates
Body: (empty)
```

### GOOD — Informative PR

```
Title: feat(auth): add OAuth2 login with Google provider

## Summary
- Add Google OAuth2 login flow to replace the legacy username/password auth
- This unblocks the SSO initiative tracked in #142

## Changes
- New `GoogleAuthProvider` class handling the OAuth2 handshake
- Login page updated with "Sign in with Google" button
- Session middleware now accepts JWT tokens from OAuth providers
- Added refresh token rotation to prevent token expiry issues

## Test plan
- [ ] Click "Sign in with Google" → redirects to Google consent screen
- [ ] After consent → redirected back and logged in
- [ ] Refresh the page after 1h → session persists via refresh token
- [ ] Logout → Google session is also cleared
```

### BAD — Wrong base branch

```bash
# Feature branch PR targeting main directly when develop exists
gh pr create --base main --title "feat: add search"
```

### GOOD — Correct base branch

```bash
# Feature branch PR targeting develop
gh pr create --base develop --title "feat(search): add full-text search"
```

## Step 5 — Output

Show the PR URL and a summary:

```
PR created:
  Title: feat(auth): add OAuth2 login with Google provider
  Base:  develop ← feat/oauth-login
  URL:   https://github.com/org/repo/pull/47
```

## Rules

- NEVER create a PR from a protected branch (main, master, develop, dev, development)
- NEVER target `main`/`master` when a dev branch exists — features go to dev
- NEVER leave the PR body empty
- NEVER write a title longer than 70 characters
- ALWAYS detect the correct base branch automatically
- ALWAYS push the branch before creating the PR
- ALWAYS include a Summary, Changes, and Test plan section
- ALWAYS analyze ALL commits in the branch, not just the latest one
- ALWAYS show the PR URL when done
- If `gh` CLI is not installed or not authenticated, tell the user how to set it up
