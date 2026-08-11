// import "dotenv/config" FIRST so drizzle-kit (a standalone CLI) reads DATABASE_URL from
// .env — nothing loads it for the CLI otherwise (blueprint §19.6 env-loading rule).
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL as string },
});
