import chalk from 'chalk';
import ora from 'ora';
import { getOnePendingTask, completeTask } from '../db/index';
import type { Task } from '../db/index';

// enquirer ships `export = Enquirer` (CJS) and doesn't expose Confirm in its
// namespace types, but the class exists at runtime as a named export.
interface ConfirmPrompt {
  run(): Promise<boolean>;
  cancel(): void;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Confirm } = require('enquirer') as {
  Confirm: new (opts: { name: string; message: string }) => ConfirmPrompt;
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimerResult {
  type: 'timeout';
}

interface AnswerResult {
  type: 'answered';
  completed: boolean;
  taskId: number;
}

type RaceResult = TimerResult | AnswerResult;

// ─── Timer ────────────────────────────────────────────────────────────────────

/**
 * Creates a countdown timer that resolves after `seconds` seconds.
 * The spinner text is updated every second but ONLY when `isSpinnerActive`
 * returns true — this prevents writes to stdout while enquirer owns the TTY.
 */
function createTimer(
  seconds: number,
  spinner: ReturnType<typeof ora>,
  isSpinnerActive: () => boolean
): { promise: Promise<TimerResult>; cancel: () => void } {
  let remaining = seconds;
  let intervalId: ReturnType<typeof setInterval>;
  let cancelled = false;

  const promise = new Promise<TimerResult>((resolve) => {
    intervalId = setInterval(() => {
      if (cancelled) return;
      remaining--;
      if (remaining <= 0) {
        clearInterval(intervalId);
        resolve({ type: 'timeout' });
      } else if (isSpinnerActive()) {
        spinner.text = chalk.cyan(`Agent running... ${remaining}s remaining`);
      }
    }, 1000);
  });

  const cancel = () => {
    cancelled = true;
    clearInterval(intervalId);
  };

  return { promise, cancel };
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

/**
 * Wraps enquirer's Confirm prompt in a typed Promise.
 * Gracefully handles programmatic cancel (enquirer rejects with '' on cancel).
 */
function runTaskPrompt(task: Task): {
  promise: Promise<AnswerResult>;
  cancel: () => void;
} {
  const prompt = new Confirm({
    name: 'completed',
    message:
      chalk.bold.blue('[Idle Flow] ') +
      `While you wait, did you complete: ` +
      chalk.white(`"${task.description}"`) +
      chalk.dim(' (Y/n)'),
  });

  const promise: Promise<AnswerResult> = prompt
    .run()
    .then((answer: boolean) => ({
      type: 'answered' as const,
      completed: answer,
      taskId: task.id,
    }))
    .catch((err: unknown) => {
      // enquirer cancels with empty string; treat as "no" (not an error)
      if (err === '' || err === null || err === undefined) {
        return { type: 'answered' as const, completed: false, taskId: task.id };
      }
      throw err;
    });

  return { promise, cancel: () => prompt.cancel() };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function runWait(seconds: number): Promise<void> {
  if (isNaN(seconds) || seconds <= 0) {
    console.error(chalk.red('Error: seconds must be a positive number.'));
    process.exit(1);
  }

  // ── 1. Check for a pending task ───────────────────────────────────────────
  const task = getOnePendingTask();

  // ── 2. Start the spinner ──────────────────────────────────────────────────
  const spinner = ora({
    text: chalk.cyan(`Agent running... ${seconds}s remaining`),
    color: 'cyan',
    spinner: 'dots',
  }).start();

  // ── 3. No tasks — simple countdown only ──────────────────────────────────
  if (!task) {
    console.log(
      chalk.dim('\n  No pending micro-tasks. Add some with ') +
        chalk.cyan('aiflow add <description>') +
        chalk.dim('.\n')
    );

    let spinnerActive = true;
    const { promise: timerPromise } = createTimer(
      seconds,
      spinner,
      () => spinnerActive
    );
    await timerPromise;
    spinnerActive = false;
    spinner.succeed(chalk.bold.green('Agent task finished!'));
    return;
  }

  // ── 4. Display the micro-task ─────────────────────────────────────────────
  // Stop spinner briefly to print without animation interference
  spinner.stop();
  console.log('');
  console.log(
    chalk.bold.blue('  Micro-task while you wait:') +
      chalk.dim(` (Task #${task.id})`)
  );
  console.log(chalk.white(`  ${task.description}`));
  console.log('');

  // ── 5. Start timer in background (spinner not running yet) ────────────────
  // The spinner will only show when enquirer is NOT active (spinnerActive flag).
  // While the prompt owns the TTY, the interval keeps counting silently.
  let spinnerActive = false;
  const { promise: timerPromise, cancel: cancelTimer } = createTimer(
    seconds,
    spinner,
    () => spinnerActive
  );

  // ── 6. Build the prompt ───────────────────────────────────────────────────
  const { promise: promptPromise, cancel: cancelPrompt } = runTaskPrompt(task);

  // ── 7. Race ───────────────────────────────────────────────────────────────
  // enquirer takes full TTY control here; spinner stays stopped.
  const result = await Promise.race<RaceResult>([timerPromise, promptPromise]);

  // ── 8. Handle result ──────────────────────────────────────────────────────
  if (result.type === 'timeout') {
    // Timer won: dismiss the prompt, restore terminal, show notification
    cancelTimer(); // clean up interval (already fired, but safe to call)
    cancelPrompt(); // close enquirer readline → rejects promptPromise with ''

    // Wait briefly for enquirer's async cleanup before writing to stdout
    await new Promise<void>((resolve) => setTimeout(resolve, 60));
    process.stdout.write('\r\x1b[K'); // clear any partial prompt line

    spinner.succeed(chalk.bold.green('Agent task finished! Return to main work when ready.'));
    console.log(
      chalk.dim(`  Micro-task #${task.id} is still pending — come back to it later.`)
    );

  } else {
    // User answered: stop the timer
    cancelTimer();

    spinner.start('Saving...');

    if (result.completed) {
      completeTask(result.taskId);
      spinner.succeed(chalk.green(`Micro-task #${result.taskId} marked as `) + chalk.bold.green('completed!'));
    } else {
      spinner.info(chalk.yellow(`Micro-task #${result.taskId} left as pending.`));
    }

    console.log(
      chalk.dim(
        `\n  Agent is still running in the background.\n` +
          `  Use ${chalk.cyan('aiflow wait <seconds>')} again to check in on another task.\n`
      )
    );
  }
}
