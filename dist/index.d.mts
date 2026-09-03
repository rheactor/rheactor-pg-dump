import { Client, ClientTransaction } from "@rheactor/rheactor-pg-connector";
//#region src/services/DumpService.d.ts
interface DumpOptions {
  schema?: "public" | (string & {});
  tables?: string[];
}
interface DumpResult {
  sql: string;
  tables: string[];
}
export declare function dump(client: Client | ClientTransaction, options?: DumpOptions): Promise<DumpResult>;
//#endregion