import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TaskStatus = 'pending' | 'completed';

export interface Task {
  id: number;
  description: string;
  status: TaskStatus;
  created_at: string;
}

// ─── DB Path ──────────────────────────────────────────────────────────────────

const DB_DIR = join(homedir(), '.aiflow');
const DB_PATH = join(DB_DIR, 'tasks.db');

// ─── DB Init ──────────────────────────────────────────────────────────────────

function ensureDbDir(): void {
  if (!existsSync(DB_DIR)) {
    mkdirSync(DB_DIR, { recursive: true });
  }
}

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  ensureDbDir();
  _db = new Database(DB_PATH);

  // WAL mode for better concurrent read performance
  _db.pragma('journal_mode = WAL');

  _db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id          INTEGER  PRIMARY KEY AUTOINCREMENT,
      description TEXT     NOT NULL,
      status      TEXT     NOT NULL DEFAULT 'pending',
      created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  return _db;
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

/** Insert a new pending task and return the inserted row. */
export function addTask(description: string): Task {
  const db = getDb();
  const stmt = db.prepare<[string], Task>(
    `INSERT INTO tasks (description) VALUES (?) RETURNING *`
  );
  return stmt.get(description)!;
}

/** Return all tasks, optionally filtered by status. */
export function listTasks(status?: TaskStatus): Task[] {
  const db = getDb();
  if (status) {
    return db
      .prepare<[string], Task>(
        `SELECT * FROM tasks WHERE status = ? ORDER BY created_at ASC`
      )
      .all(status);
  }
  return db
    .prepare<[], Task>(`SELECT * FROM tasks ORDER BY created_at ASC`)
    .all();
}

/** Return the oldest pending task, or undefined if none exist. */
export function getOnePendingTask(): Task | undefined {
  const db = getDb();
  return (
    db
      .prepare<[], Task>(
        `SELECT * FROM tasks WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1`
      )
      .get() ?? undefined
  );
}

/** Mark a task completed and return the updated row. */
export function completeTask(id: number): Task | undefined {
  const db = getDb();
  return (
    db
      .prepare<[number], Task>(
        `UPDATE tasks SET status = 'completed' WHERE id = ? RETURNING *`
      )
      .get(id) ?? undefined
  );
}

/** Delete a task by id and return the deleted row, or undefined if not found. */
export function deleteTask(id: number): Task | undefined {
  const db = getDb();
  return (
    db
      .prepare<[number], Task>(`DELETE FROM tasks WHERE id = ? RETURNING *`)
      .get(id) ?? undefined
  );
}

/** Delete all completed tasks and return the number of rows removed. */
export function clearCompleted(): number {
  const db = getDb();
  return db.prepare(`DELETE FROM tasks WHERE status = 'completed'`).run()
    .changes;
}
