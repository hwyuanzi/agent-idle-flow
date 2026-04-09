#!/usr/bin/env node
import { Command, CommanderError } from 'commander';
import chalk from 'chalk';
import { runAdd } from './commands/add';
import { runList } from './commands/list';
import { runWait } from './commands/wait';
import { runDelete } from './commands/delete';
import { runClear } from './commands/clear';

// ─── Global Error Handlers ────────────────────────────────────────────────────

process.on('uncaughtException', (err: Error) => {
  const msg = err.message ?? String(err);
  if (msg.includes('SQLITE_BUSY')) {
    console.error(chalk.red('\nError: The database is locked by another process. Try again.'));
  } else if (msg.includes('SQLITE_READONLY') || msg.includes('EACCES') || msg.includes('EPERM')) {
    console.error(chalk.red('\nError: Permission denied accessing ~/.aiflow/tasks.db'));
  } else if (msg.includes('ENOSPC') || msg.includes('SQLITE_FULL')) {
    console.error(chalk.red('\nError: Disk is full. Free up space and try again.'));
  } else {
    console.error(chalk.red(`\nUnexpected error: ${msg}`));
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  console.error(chalk.red(`\nUnexpected error: ${msg}`));
  process.exit(1);
});

// Clean newline on Ctrl+C when no interactive prompt is active
process.on('SIGINT', () => {
  process.stdout.write('\n');
  process.exit(0);
});

// ─── CLI ──────────────────────────────────────────────────────────────────────

const program = new Command();

program
  .name('aiflow')
  .description('Intercept idle LLM wait time with micro-tasks')
  .version('1.0.0')
  .exitOverride();

program
  .command('add <description>')
  .description('Add a micro-task to your backlog')
  .action((description: string) => {
    runAdd(description);
  });

program
  .command('list')
  .description('Show all micro-tasks')
  .action(() => {
    runList();
  });

program
  .command('wait <seconds>')
  .description('Start a countdown and work on a micro-task while you wait')
  .action(async (secondsStr: string) => {
    await runWait(parseInt(secondsStr, 10));
  });

program
  .command('delete <id>')
  .description('Delete a task by its ID')
  .action((idStr: string) => {
    runDelete(idStr);
  });

program
  .command('clear')
  .description('Delete all completed tasks')
  .action(() => {
    runClear();
  });

// ─── Parse ────────────────────────────────────────────────────────────────────
// Top-level await is not available in CommonJS; wrap in async IIFE.

(async () => {
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    if (err instanceof CommanderError) {
      process.exit(err.exitCode);
    }
    throw err; // re-throw → uncaughtException handler formats it
  }
})();
