import type { DumpResult } from "#/services/DumpService";

export interface TestDumpResult extends Partial<DumpResult> {
  skipPgDump?: boolean;
}

export const queriesPath = import.meta.dirname;
