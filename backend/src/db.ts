import { config } from "./config";

const { Pool } = require("pg");

type DbPool = {
  query: (sql: string) => Promise<unknown>;
  end: () => Promise<void>;
};

let pool: DbPool | undefined;

function getPool(): DbPool | undefined {
  if (!config.databaseUrl) {
    return undefined;
  }

  pool ??= new Pool({
    connectionString: config.databaseUrl,
  });

  return pool;
}

export async function checkDatabaseHealth(): Promise<{
  ok: boolean;
  message?: string;
}> {
  const db = getPool();

  if (!db) {
    return {
      ok: false,
      message: "DATABASE_URL is not configured.",
    };
  }

  try {
    await db.query("select 1");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Database check failed.",
    };
  }
}

export async function closeDatabase(): Promise<void> {
  if (!pool) {
    return;
  }

  await pool.end();
  pool = undefined;
}
