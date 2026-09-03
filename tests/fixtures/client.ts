import { randomUUID } from "node:crypto";
import { glob, readFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { singleton } from "@rheactor/rheactor-core";
import { Client } from "@rheactor/rheactor-pg-connector";

import type { TestDumpResult } from "#tests/fixtures/queries/index";
import { queriesPath } from "#tests/fixtures/queries/index";

export function createDatabaseName() {
  return `rheactor_test_db_${randomUUID()}`;
}

export function createClient(database?: string) {
  return new Client({
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT),
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database,
  });
}

interface QueryTest {
  name: string;
  dumpPath: string;
  pgDumpPath: string;
  getInputQuery(this: void): Promise<string>;
  getInputParameters(this: void): Promise<TestDumpResult>;
  getSupportQuery(this: void): Promise<string | undefined>;
  getDumpQuery(this: void): Promise<string>;
  getPgDumpQuery(this: void): Promise<string>;
}

export async function getTestQueries() {
  const queries = await Array.fromAsync(
    glob(join(queriesPath, "**/*.input.sql"), { withFileTypes: true }),
  );

  return queries
    .map(({ name, parentPath }) => ({ name: basename(name, ".input.sql"), parentPath }))
    .map(({ name, parentPath }): QueryTest => {
      const inputPath = join(parentPath, `${name}.input.sql`);
      const inputParametersPath = join(parentPath, `${name}.parameters.ts`);
      const supportPath = join(parentPath, `${name}.support.sql`);
      const dumpPath = join(parentPath, `${name}.dump.sql`);
      const pgDumpPath = join(parentPath, `${name}.pg-dump.sql`);

      return {
        name,
        dumpPath,
        pgDumpPath,
        getInputQuery: singleton(async () => readFile(inputPath, "utf-8")),
        getInputParameters: singleton(async () => {
          try {
            // oxlint-disable-next-line typescript/no-unsafe-assignment
            const { default: value } = await import(inputParametersPath);

            return value as TestDumpResult;
          } catch {
            return {};
          }
        }),
        getSupportQuery: singleton(async () =>
          // oxlint-disable-next-line promise/prefer-await-to-then
          readFile(supportPath, "utf-8").catch(() => undefined),
        ),
        getDumpQuery: singleton(async () => readFile(dumpPath, "utf-8")),
        getPgDumpQuery: singleton(async () => readFile(pgDumpPath, "utf-8")),
      };
    });
}
