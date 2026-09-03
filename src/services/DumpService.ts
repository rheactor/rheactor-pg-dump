import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { singleton } from "@rheactor/rheactor-core";
import type { Client, ClientTransaction } from "@rheactor/rheactor-pg-connector";

import type { TableEntry } from "#/builders/TableBuilder";
import { tableBuilder } from "#/builders/TableBuilder";
import { queriesPath } from "#queries/index";

export interface DumpOptions {
  schema?: "public" | (string & {});
  tables?: string[];
}

export interface DumpResult {
  sql: string;
  tables: string[];
}

const getDumpQuery = singleton(async () => readFile(join(queriesPath, "dump.sql"), "utf-8"));

export async function dump(
  client: Client | ClientTransaction,
  options?: DumpOptions,
): Promise<DumpResult> {
  const dumpQuery = await getDumpQuery();
  const { rows } = await client.query<TableEntry>(dumpQuery, [
    options?.schema ?? "public",
    options?.tables,
  ]);
  const dumpResult: string[] = [];

  for (const entry of rows) {
    dumpResult.push(tableBuilder(entry));
  }

  return {
    sql: dumpResult.join("\n\n"),
    tables: rows.map(({ name }) => name),
  };
}
