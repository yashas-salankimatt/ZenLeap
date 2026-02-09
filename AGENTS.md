## MANDATORY: Use td for Task Management

Run td usage --new-session at conversation start (or after /clear). This tells you what to work on next.

Sessions are automatic (based on terminal/agent context). Optional:
- td session "name" to label the current session
- td session --new to force a new session in the same context

Use td usage -q after first read.

## NEVER commit local worktree state files

The following files/directories are local to each worktree and must NEVER be committed, staged, or tracked in git. They cause database corruption and merge conflicts when shared across worktrees:

- `.todos/` — td database (local per-worktree)
- `.td-root` — td root marker
- `.sidecar*` — all sidecar state files (`.sidecar/`, `.sidecar-agent`, `.sidecar-task`, `.sidecar-pr`, `.sidecar-start.sh`, `.sidecar-base`)

If you see these in `git status` as untracked, IGNORE them. If they show as tracked, run `git rm --cached <file>` to untrack them. NEVER `git add` these files.
