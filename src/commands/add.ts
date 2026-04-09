import chalk from 'chalk';
import { addTask } from '../db/index';

export function runAdd(description: string): void {
  // Strip NUL bytes — SQLite TEXT columns reject them and would throw
  const trimmed = description.replace(/\0/g, '').trim();

  if (!trimmed) {
    console.error(chalk.red('Error: Task description cannot be empty.'));
    process.exit(1);
  }

  const task = addTask(trimmed);

  console.log(
    chalk.green('✔') +
      chalk.bold(` Task #${task.id} added`) +
      chalk.dim(` — "${task.description}"`)
  );
}
