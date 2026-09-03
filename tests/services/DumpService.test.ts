import { singleton } from "@rheactor/rheactor-core";
import { escapeIdentifier } from "@rheactor/rheactor-core/postgres";
import type { Client } from "@rheactor/rheactor-pg-connector";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { dump } from "#/services/DumpService";
import { createClient, createDatabaseName, getTestQueries } from "#tests/fixtures/client";
import { pgDump } from "#tests/fixtures/PGDumpService";

describe("DumpService", async () => {
  const getClientDefault = singleton(() => createClient());

  afterAll(async () => {
    await getClientDefault().close();
  });

  const queries = await getTestQueries();

  describe.each(queries)(
    "dump($name)",
    async ({
      name,
      dumpPath,
      pgDumpPath,
      getInputQuery,
      getInputParameters,
      getSupportQuery,
      getDumpQuery,
      getPgDumpQuery,
    }) => {
      let database: string;
      let client: Client;

      const inputQuery = await getInputQuery();
      const inputParameters = await getInputParameters();
      const supportQuery = await getSupportQuery();
      const dumpQuery = await getDumpQuery();
      const pgDumpQuery = await getPgDumpQuery();

      beforeEach(async () => {
        database = createDatabaseName();

        const clientDefault = getClientDefault();
        await clientDefault.query(`CREATE DATABASE ${escapeIdentifier(database)}`);

        client = createClient(database);
      });

      afterEach(async () => {
        await client.close();

        const clientMain = getClientDefault();
        await clientMain.query(`DROP DATABASE IF EXISTS ${escapeIdentifier(database)}`);
      });

      it(`dump(${JSON.stringify(name)}): create from raw`, async () => {
        expect.assertions(2);

        // oxlint-disable-next-line vitest/no-conditional-in-test
        if (supportQuery !== undefined) {
          await client.query(supportQuery);
        }

        await client.query(inputQuery);
        await expect(pgDump(database)).resolves.toMatchFileSnapshot(pgDumpPath, "pg_dump");

        const dumpResult = await dump(client, inputParameters);

        await expect(dumpResult.sql).toMatchFileSnapshot(dumpPath, "dump");
      });

      it.skipIf(inputParameters.skipPgDump)(
        `dump(${JSON.stringify(name)}): create from pg_ump`,
        async () => {
          expect.assertions(1);

          await client.query(pgDumpQuery);

          const dumpResult = await dump(client);

          expect(dumpResult.sql).toBe(dumpQuery);
        },
      );

      it.skipIf(inputParameters.skipPgDump)(
        `dump(${JSON.stringify(name)}): create from dump`,
        async () => {
          expect.assertions(2);

          // oxlint-disable-next-line vitest/no-conditional-in-test
          if (supportQuery !== undefined) {
            await client.query(supportQuery);
          }

          await client.query(dumpQuery);

          const dumpResult = await dump(client);

          expect(dumpResult.sql).toBe(dumpQuery);
          await expect(pgDump(database)).resolves.toBe(pgDumpQuery);
        },
      );
    },
  );
});
