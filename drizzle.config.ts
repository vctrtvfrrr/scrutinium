import type { Config } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL ?? "./sqlite/elections.sqlite";

export default {
  schema: "./packages/db/src/schema/index.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: databaseUrl
  },
  verbose: true,
  strict: true
} satisfies Config;

