import { escapeIdentifierSmart } from "@rheactor/rheactor-core/postgres";
import spawn from "nano-spawn";

export async function pgDump(database: string) {
  const env = {
    PGHOST: process.env.POSTGRES_HOST,
    PGPORT: process.env.POSTGRES_PORT,
    PGUSER: process.env.POSTGRES_USER,
    PGPASSWORD: process.env.POSTGRES_PASSWORD,
    PGDATABASE: database,
  } as const;

  const { stdout, stderr } = await spawn(
    process.env.POSTGRES_BIN,
    [
      ["--schema", "public"],
      "--no-comments",
      "--no-data",
      "--no-owner",
      "--no-table-access-method",
      "--no-tablespaces",
    ].flat(),
    { env },
  );

  if (stderr) {
    throw new Error(stderr);
  }

  const createSchema = `CREATE SCHEMA ${escapeIdentifierSmart("public")};`;
  const createSchemaIndex = stdout.indexOf(createSchema);

  const unrestrictIndex = stdout.indexOf("\\unrestrict");

  const query = stdout
    .slice(createSchemaIndex + createSchema.length, unrestrictIndex)
    .replaceAll(/^--.*$/gmv, "")
    .replaceAll("\r\n", "\n")
    .replaceAll(/\n{3,}/gv, "\n\n")
    .replaceAll("\t", "  ")
    .replaceAll(`${escapeIdentifierSmart("public")}.`, "");

  return `${query.trim()}\n`;
}
