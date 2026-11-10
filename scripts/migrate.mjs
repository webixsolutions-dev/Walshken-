import { readFile, readdir } from "node:fs/promises";
import postgres from "postgres";

const url = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!url) throw new Error("Set DIRECT_DATABASE_URL or DATABASE_URL first.");
const db = postgres(url, { max: 1, prepare: false });
try {
  await db`CREATE TABLE IF NOT EXISTS walshken_migrations (name text PRIMARY KEY)`;
  for (const name of (await readdir("drizzle")).filter((file) => file.endsWith(".sql")).sort()) {
    await db.begin(async (transaction) => {
      await transaction`LOCK TABLE walshken_migrations IN EXCLUSIVE MODE`;
      const applied = await transaction`SELECT name FROM walshken_migrations WHERE name=${name}`;
      if (applied.length) return;
      const contents = await readFile(`drizzle/${name}`, "utf8");
      for (const statement of contents.split("--> statement-breakpoint")) if (statement.trim()) await transaction.unsafe(statement);
      await transaction`INSERT INTO walshken_migrations (name) VALUES (${name})`;
      console.log(`Applied ${name}`);
    });
  }
} finally { await db.end(); }
