import chalk from 'chalk';
import { deleteTask } from '../db/index';

export function runDelete(idStr: string): void {
  const id = parseInt(idStr, 10);

  if (isNaN(id) || id <= 0) {
    console.error(chalk.red(`Error: "${idStr}" is not a valid task ID. Use a positive integer.`));
    process.exit(1);
  }

  const task = deleteTask(id);

  if (!task) {
    console.error(chalk.red(`Error: No task found with ID ${id}.`));
    process.exit(1);
  }

  console.log(
    chalk.red('✖') +
      chalk.bold(` Task #${task.id} deleted`) +
      chalk.dim(` — "${task.description}"`)
  );
}
