import { escapeIdentifierSmart } from "@rheactor/rheactor-core/postgres";

type Data = string | false;

export class Builder {
  public constructor(private readonly data: Data[] = []) {}

  public push(...items: Data[]) {
    return (this.data.push(...items), this);
  }

  public pushIdentifier(name: string, schema?: string | null) {
    return typeof schema === "string"
      ? (this.data.push(`${escapeIdentifierSmart(schema)}.${escapeIdentifierSmart(name)}`), this)
      : (this.data.push(escapeIdentifierSmart(name)), this);
  }

  public pop() {
    return (this.data.pop(), this);
  }

  public amend(...items: Data[]) {
    return (this.data.pop(), this.data.push(...items), this);
  }

  public build(suffix = ";") {
    return (this.data.push(suffix), this.data.filter(Boolean).join(""));
  }
}
