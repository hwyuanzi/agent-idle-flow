# agent-idle-flow ⚡

**Stop losing focus while your AI agent thinks.**

In the era of *Vibe Coding*, every LLM call punches a 1–3 minute hole in your day. You open Twitter. You scroll Hacker News. You lose the thread completely.

`agent-idle-flow` fixes this. It's a local CLI task scheduler that intercepts that dead time and surfaces a **micro-task** from your personal backlog — a docstring to write, a PR comment to review, a note to file. Answer it, mark it done, and be fully ready when your agent returns.

Zero context switches. Full flow state. Every wait becomes a win.

---

## Features

- **Add micro-tasks** to a local SQLite backlog with a single command
- **Countdown timer** with an interactive prompt — work on a task *while* you wait
- **Graceful timeout** — if the agent finishes first, the prompt is automatically dismissed
- **Delete and clear** — keep your backlog clean with surgical or bulk removal
- **Zero cloud, zero telemetry** — all data lives in `~/.aiflow/tasks.db`

---

## Installation

**Prerequisites:** Node.js ≥ 18

```bash
# 1. Clone the repo
git clone https://github.com/your-username/agent-idle-flow.git
cd agent-idle-flow

# 2. Install dependencies
npm install

# 3. Compile TypeScript → dist/
npm run build

# 4. Install the `aiflow` binary globally
npm link
```

Verify the install:

```bash
aiflow --version
# 1.0.0
```

---

## Usage

### `aiflow add <description>`

Add a micro-task to your backlog.

```bash
aiflow add "Write a docstring for the parseConfig function"
aiflow add "Reply to the auth-service PR review comments"
aiflow add "Update the CHANGELOG for v1.1"
```

```
✔ Task #1 added — "Write a docstring for the parseConfig function"
✔ Task #2 added — "Reply to the auth-service PR review comments"
✔ Task #3 added — "Update the CHANGELOG for v1.1"
```

---

### `aiflow list`

Display all tasks — pending and completed — in a formatted table.

```bash
aiflow list
```

```
ID     Description                                         Status       Created
──────────────────────────────────────────────────────────────────────────────────
1      Write a docstring for the parseConfig function      pending      4/9/2026
2      Reply to the auth-service PR review comments        pending      4/9/2026
3      Update the CHANGELOG for v1.1                       completed    4/9/2026

3 total  —  2 pending,  1 completed
```

---

### `aiflow wait <seconds>`

The core command. Start a countdown timer and work on a micro-task while your agent runs.

```bash
# Simulate a 90-second agent call
aiflow wait 90
```

`aiflow` immediately shows you the oldest pending task and asks if you completed it:

```
  Micro-task while you wait: (Task #1)
  Write a docstring for the parseConfig function

? [Idle Flow] While you wait, did you complete: "Write a docstring for the parseConfig function" (Y/n)
```

**If you answer before the timer expires:**

```
✔ Micro-task #1 marked as completed!

  Agent is still running in the background.
  Use `aiflow wait <seconds>` again to check in on another task.
```

**If the timer expires while you're still answering:**

The prompt is automatically dismissed and `aiflow` notifies you:

```
✔ Agent task finished! Return to main work when ready.
  Micro-task #1 is still pending — come back to it later.
```

---

### `aiflow delete <id>`

Remove a specific task by ID — useful for tasks that are no longer relevant.

```bash
aiflow delete 2
```

```
✖ Task #2 deleted — "Reply to the auth-service PR review comments"
```

Error handling:

```bash
aiflow delete 999
# Error: No task found with ID 999.

aiflow delete abc
# Error: "abc" is not a valid task ID. Use a positive integer.
```

---

### `aiflow clear`

Bulk-delete all completed tasks to keep the backlog clean.

```bash
aiflow clear
```

```
✔ Cleared 3 completed tasks
```

Run it again when there's nothing to remove:

```bash
aiflow clear
# No completed tasks to clear.
```

---

## Recommended Workflow

```bash
# Morning: fill the backlog
aiflow add "Add rate-limiting to the /search endpoint"
aiflow add "Respond to the design review thread"
aiflow add "Bump the axios dependency to fix the CVE"

# Every time you fire off an LLM prompt in your editor:
aiflow wait 120

# End of day: clean up
aiflow clear
aiflow list
```

---

## Architecture

### The Timer vs. Prompt Concurrency Problem

The `wait` command must do two things simultaneously:

1. Count down a timer in the background
2. Show an interactive `enquirer` prompt in the foreground

Both write to `stdout`, so they cannot run at the same time without corrupting the terminal. `aiflow` solves this with a three-part design:

**Decoupled counting and rendering.** The `setInterval` counter and the spinner renderer are separated. The interval always runs; the spinner only updates when a flag (`isSpinnerActive`) is `true`. This lets the timer count silently while `enquirer` owns the TTY.

**`Promise.race()` as the arbiter.** Two promises are created — one for the timer, one for the prompt — and `Promise.race()` resolves with whichever finishes first:

```typescript
const result = await Promise.race([timerPromise, promptPromise]);
```

**Clean losers.** Whoever loses the race is gracefully shut down:

- **Timer wins:** `prompt.cancel()` is called, which closes `enquirer`'s readline interface and restores the terminal to cooked mode. A 60 ms settle period and a `\r\x1b[K` escape sequence clear any partial prompt text before the "finished" banner is shown.
- **User wins:** `cancelTimer()` clears the `setInterval`, stopping the countdown cleanly.

This approach guarantees the terminal is never left in raw mode regardless of which side wins.

### Tech Stack

| Package | Version | Role |
|---------|---------|------|
| `better-sqlite3` | ^12 | Synchronous local SQLite — no async DB calls needed |
| `commander` | ^14 | CLI argument parsing and subcommand routing |
| `enquirer` | ^2 | Interactive yes/no prompt with programmatic `.cancel()` |
| `chalk` | ^4 | Terminal color output (pinned to v4 — v5+ is ESM-only) |
| `ora` | ^5 | Spinner animations (pinned to v5 — v6+ is ESM-only) |
| `typescript` | ^5 | Type safety across the entire codebase |
| `tsx` | ^4 | Zero-config TypeScript execution for development |

> **Why chalk@4 and ora@5?** Both packages went ESM-only in their major version bumps. Since `better-sqlite3` is a native CommonJS addon, the entire project targets CommonJS to avoid interop complexity. Pinning to the last CJS-compatible versions keeps the setup simple and dependency-free of dynamic imports.

### Data Storage

All tasks are stored in `~/.aiflow/tasks.db` — a standard SQLite 3 file created automatically on first use.

```sql
CREATE TABLE tasks (
  id          INTEGER  PRIMARY KEY AUTOINCREMENT,
  description TEXT     NOT NULL,
  status      TEXT     NOT NULL DEFAULT 'pending',  -- 'pending' | 'completed'
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev -- <cmd>` | Run without building via `tsx` |
| `npm run build` | Compile TypeScript → `dist/` |
| `npm run typecheck` | Type-check without emitting files |
| `npm run clean` | Delete `dist/` |

---

## License

Apache 2.0 — see [LICENSE](LICENSE).
