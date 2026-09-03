import { escapeIdentifierSmart } from "@rheactor/rheactor-core/postgres";

import { Builder } from "#/builders/Builder";

interface Constraint {
  name: string;
  expression: string;
  withOptions: string[] | null;
}

export interface TableEntry {
  unlogged: boolean;
  name: string;
  columns: Array<{
    name: string;
    type: string;
    collate: { schema?: string; name: string } | null;
    notNull: { enabled: boolean; constraint: string | null };
    default: string | null;
    generated: { type: "s" | "v"; expression: string } | null;
    identity: {
      type: "a" | "d";
      sequence: {
        name: string | null;
        startWith: string | null;
        incrementBy: string | null;
        minValue: string | null;
        maxValue: string | null;
        cache: number | null;
        cycle: boolean;
      };
    } | null;
  }> | null;
  constraints: Constraint[] | null;
  inherits: Array<{ schema?: string; name: string }> | null;
  withOptions: string[];
  indexes: string[] | null;
}

function withOptionsBuilder(builder: Builder, withOptions: string[]) {
  builder.push("WITH (");

  for (const option of withOptions) {
    builder.push(option, ", ");
  }

  return (builder.amend(")"), builder);
}

export function tableBuilder(entry: TableEntry) {
  const builder = new Builder([
    "CREATE ",
    entry.unlogged && "UNLOGGED ",
    `TABLE ${escapeIdentifierSmart(entry.name)} `,
  ]);

  if (entry.columns !== null && entry.columns.length > 0) {
    builder.push("(\n");

    for (const column of entry.columns) {
      builder.push(`  ${escapeIdentifierSmart(column.name)} ${column.type}`);

      if (column.collate !== null) {
        builder.push(" COLLATE ").pushIdentifier(column.collate.name, column.collate.schema);
      }

      if (column.notNull.enabled) {
        if (column.notNull.constraint !== null) {
          builder.push(" CONSTRAINT ").pushIdentifier(column.notNull.constraint);
        }

        builder.push(" NOT NULL");
      }

      if (column.default !== null) {
        builder.push(` DEFAULT ${column.default}`);
      } else if (column.generated !== null) {
        builder.push(
          ` GENERATED ALWAYS AS (${column.generated.expression}) ${column.generated.type === "s" ? "STORED" : "VIRTUAL"}`,
        );
      } else if (column.identity !== null) {
        builder.push(
          ` GENERATED ${column.identity.type === "a" ? "ALWAYS" : "BY DEFAULT"} AS IDENTITY`,
        );

        const sequenceAttributes: string[] = [];

        if (column.identity.sequence.name !== null) {
          sequenceAttributes.push(
            `SEQUENCE NAME ${escapeIdentifierSmart(column.identity.sequence.name)}`,
            " ",
          );
        }

        if (column.identity.sequence.startWith !== null) {
          sequenceAttributes.push(`START WITH ${column.identity.sequence.startWith}`, " ");
        }

        if (column.identity.sequence.incrementBy !== null) {
          sequenceAttributes.push(`INCREMENT BY ${column.identity.sequence.incrementBy}`, " ");
        }

        if (column.identity.sequence.minValue !== null) {
          sequenceAttributes.push(`MINVALUE ${column.identity.sequence.minValue}`, " ");
        }

        if (column.identity.sequence.maxValue !== null) {
          sequenceAttributes.push(`MAXVALUE ${column.identity.sequence.maxValue}`, " ");
        }

        if (column.identity.sequence.cache !== null) {
          sequenceAttributes.push(`CACHE ${column.identity.sequence.cache}`, " ");
        }

        if (column.identity.sequence.cycle) {
          sequenceAttributes.push(`CYCLE`, " ");
        }

        if (sequenceAttributes.length > 0) {
          builder.push(` (`, ...(sequenceAttributes.pop(), sequenceAttributes), `)`);
        }
      }

      builder.push(",\n");
    }

    builder.amend("\n)", "\n");
  } else {
    builder.push("()", "\n");
  }

  if (entry.inherits !== null) {
    builder.push("INHERITS (");

    for (const inherit of entry.inherits) {
      builder.pushIdentifier(inherit.name, inherit.schema).push(", ");
    }

    builder.amend(")", "\n");
  }

  if (entry.withOptions.length > 0) {
    withOptionsBuilder(builder, entry.withOptions).push("\n");
  }

  builder.amend(";\n\n");

  if (entry.constraints !== null && entry.constraints.length > 0) {
    for (const constraint of entry.constraints) {
      builder.push(
        `ALTER TABLE ONLY ${escapeIdentifierSmart(entry.name)} ` +
          `ADD CONSTRAINT ${escapeIdentifierSmart(constraint.name)} ${constraint.expression}`,
        " ",
      );

      if (constraint.withOptions !== null) {
        withOptionsBuilder(builder, constraint.withOptions).push(" ");
      }

      builder.amend(";\n\n");
    }
  }

  if (entry.indexes !== null) {
    for (const index of entry.indexes) {
      builder.push(index, "\n\n");
    }
  }

  return builder.pop().build();
}
