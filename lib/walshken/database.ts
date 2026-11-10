import { readFile, readdir, mkdir } from "node:fs/promises";
import { join } from "node:path";
import postgres from "postgres";
import type { PGlite } from "@electric-sql/pglite";

type Result = { rows: unknown[]; count: number };
type Adapter = {
  query: (statement: string, values: unknown[]) => Promise<Result>;
  transaction: <T>(work: (adapter: Adapter) => Promise<T>) => Promise<T>;
};
type Statement = { sql: string; values: unknown[]; first: <T>() => Promise<T | null>; all: <T>() => Promise<{ results: T[] }>; run: () => Promise<Result> };
const state = globalThis as typeof globalThis & { walshkenPg?: Adapter; walshkenLocal?: Promise<Adapter> };

function postgresAdapter(connection: ReturnType<typeof postgres>): Adapter {
  return {
    async query(sql, values) {
      const rows = await connection.unsafe(sql, values as never[]);
      return { rows: [...rows], count: rows.count };
    },
    async transaction(work) {
      return await connection.begin((transaction) => work(postgresAdapter(transaction as unknown as ReturnType<typeof postgres>))) as Awaited<ReturnType<typeof work>>;
    },
  };
}

type PgliteConnection = Pick<PGlite, "query"> & Partial<Pick<PGlite, "transaction">>;
function pgliteAdapter(connection: PgliteConnection): Adapter {
  return {
    async query(sql, values) {
      const result = await connection.query(sql, values);
      return { rows: result.rows, count: result.affectedRows ?? 0 };
    },
    async transaction(work) {
      return connection.transaction ? connection.transaction((transaction) => work(pgliteAdapter(transaction))) : work(pgliteAdapter(connection));
    },
  };
}

async function localAdapter() {
  const { PGlite } = await import("@electric-sql/pglite");
  const directory = join(process.cwd(), ".walshken-data");
  await mkdir(directory, { recursive: true });
  const connection = new PGlite(directory);
  await connection.exec("CREATE TABLE IF NOT EXISTS walshken_migrations (name text PRIMARY KEY)");
  for (const file of (await readdir(join(process.cwd(), "drizzle"))).filter((name) => name.endsWith(".sql")).sort()) {
    await connection.transaction(async (transaction) => {
      if ((await transaction.query("SELECT name FROM walshken_migrations WHERE name=$1", [file])).rows.length) return;
      const sql = await readFile(join(process.cwd(), "drizzle", file), "utf8");
      for (const part of sql.split("--> statement-breakpoint")) if (part.trim()) await transaction.exec(part);
      await transaction.query("INSERT INTO walshken_migrations (name) VALUES ($1)", [file]);
    });
  }
  return pgliteAdapter(connection);
}

export class Db {
  constructor(private driver: () => Promise<Adapter>) {}
  prepare(statement: string, values: unknown[]): Statement {
    let parameter = 0;
    const sql = statement.replace(/\?/g, () => `$${++parameter}`);
    const execute = async () => (await this.driver()).query(sql, values);
    return {
      sql, values,
      async first<T>() { return ((await execute()).rows[0] as T | undefined) ?? null; },
      async all<T>() { return { results: (await execute()).rows as T[] }; },
      run: execute,
    };
  }
  async transaction<T>(work: (db: Db) => Promise<T>) {
    return (await this.driver()).transaction((driver) => work(new Db(async () => driver)));
  }
  async batch(statements: Statement[]) {
    return (await this.driver()).transaction(async (transaction) => {
      const results: Result[] = [];
      for (const { sql, values } of statements) results.push(await transaction.query(sql, values));
      return results;
    });
  }
}
export function workspaceDatabase() {
  const url = process.env.DATABASE_URL;
  if (url) {
    return new Db(async () => state.walshkenPg ??= postgresAdapter(postgres(url, { max: 3, prepare: false, idle_timeout: 20, connect_timeout: 8 })));
  }
  if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
    return new Db(() => state.walshkenLocal ??= localAdapter());
  }
  return null;
}
