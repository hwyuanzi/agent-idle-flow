import chalk from 'chalk';
import { clearCompleted } from '../db/index';

export function runClear(): void {
  const count = clearCompleted();

  if (count === 0) {
    console.log(chalk.dim('No completed tasks to clear.'));
    return;
  }

  console.log(
    chalk.green('✔') +
      chalk.bold(` Cleared ${count} completed task${count === 1 ? '' : 's'}`)
  );
}
