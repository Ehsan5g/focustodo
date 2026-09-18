// Minimal ambient types for `pg` (transitive runtime dependency via
// @prisma/adapter-pg). E2E specs query the database directly with raw SQL —
// importing the Prisma client into the Playwright process is not possible
// (the generated client is ESM-only and the Playwright loader is CJS). If
// @types/pg is ever added as a devDependency, DELETE this file.
declare module "pg" {
  export interface QueryResultRow {
    [column: string]: unknown;
  }
  export interface QueryResult<T extends QueryResultRow> {
    rows: T[];
    rowCount: number | null;
  }
  export class Pool {
    constructor(config?: { connectionString?: string });
    query<T extends QueryResultRow = QueryResultRow>(
      text: string,
      values?: unknown[],
    ): Promise<QueryResult<T>>;
    end(): Promise<void>;
  }
}
