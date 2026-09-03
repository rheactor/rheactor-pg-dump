import type { TestDumpResult } from "#tests/fixtures/queries/index";

const options: TestDumpResult = {
  tables: ["example_b"],
  skipPgDump: true,
};

export default options;
