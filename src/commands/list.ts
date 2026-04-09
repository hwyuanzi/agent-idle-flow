import chalk from 'chalk';
import { listTasks } from '../db/index';
import type { Task } from '../db/index';

const STATUS_COLORS: Record<string, (s: string) => string> = {
  pending: chalk.yellow,
  completed: chalk.green,
};

/** SQLite CURRENT_TIMESTAMP returns UTC without 'Z'; append it for correct parsing. */
function formatDate(dt: string): string {
  return new Date(dt + 'Z').toLocaleString();
}

function truncate(str: string, width: number): string {
  return str.length > width ? str.slice(0, width - 1) + '…' : str.padEnd(width);
}

export function runList(): void {
  const tasks = listTasks();

  if (tasks.length === 0) {
    console.log(
      chalk.dim('No tasks yet. Use ') +
        chalk.cyan('aiflow add <description>') +
        chalk.dim(' to create one.')
    );
    return;
  }

  const COL_ID   = 5;
  const COL_DESC = 50;
  const COL_STAT = 11;
  const COL_DATE = 22;

  const header =
    chalk.bold(truncate('ID',          COL_ID))   + '  ' +
    chalk.bold(truncate('Description', COL_DESC))  + '  ' +
    chalk.bold(truncate('Status',      COL_STAT))  + '  ' +
    chalk.bold('Created');

  const separator = chalk.dim('─'.repeat(COL_ID + COL_DESC + COL_STAT + COL_DATE + 6));

  console.log('');
  console.log(header);
  console.log(separator);

  for (const task of tasks) {
    const colorFn = STATUS_COLORS[task.status] ?? ((s: string) => s);
    console.log(
      truncate(String(task.id), COL_ID)         + '  ' +
      truncate(task.description, COL_DESC)       + '  ' +
      colorFn(truncate(task.status, COL_STAT))   + '  ' +
      chalk.dim(formatDate(task.created_at))
    );
  }

  console.log('');

  const pending   = tasks.filter((t: Task) => t.status === 'pending').length;
  const completed = tasks.filter((t: Task) => t.status === 'completed').length;
  console.log(
    chalk.dim(
      `${tasks.length} total  —  ` +
        chalk.yellow(pending + ' pending') +
        chalk.dim(',  ') +
        chalk.green(completed + ' completed')
    )
  );
  console.log('');
}
