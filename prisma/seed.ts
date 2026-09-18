// Seed script (US3/T020): proves write access against the disposable DB.
// Exactly-one-row upsert into system_meta (idempotent — safe to re-run).
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { env } from "../src/lib/env.js";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
});

async function main(): Promise<void> {
  const marker = `seeded-at-${new Date().toISOString()}`;

  const row = await db.systemMeta.upsert({
    where: { id: "singleton" },
    update: { key: "seed", value: marker },
    create: { id: "singleton", key: "seed", value: marker },
  });

  console.log(`Seed OK: system_meta.value = ${row.value}`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (error) => {
    await db.$disconnect();
    console.error(String(error));
    process.exit(1);
  });

