import path from "node:path";
import { defineConfig } from "prisma/config";

// Prisma 7 CLI configuration. DATABASE_URL comes from the environment
// (.env is loaded by Next.js at runtime; set it in your shell for CLI use).
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
