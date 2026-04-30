---
name: github
description: Use GitHub CLI (`gh`) for pull request creation, PR lookup, PR status, and GitHub repository publication. Use when asked to create/open a PR, publish branch work, check PR state, or verify GitHub auth.
---

# GitHub CLI Skill

Use this skill for GitHub work in this repository. This repository's unattended runner flow must use local CLI commands, not GitHub connector/MCP tools.

## Hard Rules

- Use `git` for local branch/commit/push operations.
- Use `gh` CLI for GitHub pull request operations.
- Do **not** use GitHub connector/MCP tools for PR creation.
- Do **not** open a browser or rely on interactive prompts.
- If `gh` auth, DNS, permissions, or tooling fail, stop as blocked and report the exact command and error.
- A Studio Runner task is not complete until a PR URL exists.

## Required PR Workflow

1. Verify current branch and repo:

```bash
git status --short --branch
git remote -v
gh auth status
```

2. Push the current branch:

```bash
git push -u origin HEAD
```

If the push is rejected because remote moved, resolve sync safely before retrying. If it fails due to auth/network/permissions, stop as blocked.

3. Check whether a PR already exists for the branch:

```bash
gh pr view --json url,state,headRefName,baseRefName
```

4. If no PR exists, create one non-interactively:

```bash
branch=$(git branch --show-current)
gh pr create \
  --base main \
  --head "$branch" \
  --title "<clear title>" \
  --body-file /tmp/pr-body.md
```

Write `/tmp/pr-body.md` before running `gh pr create`. Include:

- summary of what changed
- validation evidence with exact commands/results
- risks or follow-ups

5. Return the PR URL:

```bash
gh pr view --json url --jq .url
```

## Blocked Output

If PR creation cannot complete, report:

- status: blocked
- branch name
- commit SHA
- whether push succeeded
- exact failing `gh` or `git` command
- exact stderr/stdout error

Do not call local-only work complete.
