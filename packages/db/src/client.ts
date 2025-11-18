import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import * as schema from "./schema";

const DEFAULT_DB_PATH = "./sqlite/elections.sqlite";

function resolveDatabasePath(value?: string) {
  const normalized = value?.startsWith("file:")
    ? value.replace("file:", "")
    : value;
  const target = normalized && normalized.length > 0 ? normalized : DEFAULT_DB_PATH;
  return isAbsolute(target) ? target : join(process.cwd(), target);
}

const databaseFile = resolveDatabasePath(process.env.DATABASE_URL);
mkdirSync(dirname(databaseFile), { recursive: true });

const sqlite = new Database(databaseFile);

export const db = drizzle(sqlite, { schema });
export { schema, databaseFile };

