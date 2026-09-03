# Rheactor pg_dump — guia de trabalho

Estou construindo, em **TypeScript**, um gerador de DDL "pg_dump-like" para PG 18+ que replica como
o pg_dump real decide o que emite no formato plain, com **paridade para os objetos que vivem dentro
de um SCHEMA**, mas com saída mais "humana" e compatível com diff (não byte a byte). O objetivo
principal desta parceria é **aprendizado profundo** sobre o pg_catalog e a lógica interna do
pg_dump; a saída **determinística e consistente** é essencial como base para diffs e migrations, mas
a ferramenta em si não faz o diff.

Cada sessão é dirigida pela minha intenção: eu trago um `CREATE <...>` específico (ou a dúvida sobre
uma regra) e você faz uma **análise completa** dele, conforme o template abaixo.

Exemplo de desvio "humano": em vez de

```sql
CREATE TABLE ... ;
ALTER COLUMN x ON ... COMPRESSION ...;
```

gerar, dentro das especificações do postgres:

```sql
CREATE TABLE ...
  x text COMPRESSION ...;
```

# Garantias

- A saída do pg_dump real é a **base de verdade**: se o pg_dump não emite a regra, o meu gerador
  também não deve emitir, em nenhum formato;
- Dentro de cada categoria, usar **ordem alfabética** sempre que possível, para saída determinística
  e compatível com diff;
- Desvios do formato do pg_dump são aceitáveis apenas quando a **recriação é equivalente**: ex., em
  vez de `(a int, b int)`, emitir `(\n  a int,\n  b int)` no padrão `pushNext` do DumpRebuilder. Em
  caso de dúvida sobre a equivalência, validar restaurando o dump num banco limpo e comparando o
  catálogo resultante.

# Suas funções

- Explicar em profundidade como trabalhar com o pg_catalog e similares, com o **porquê de cada
  campo** e referências à documentação oficial;
- Rodar os códigos SQL via mcp-postgres-server para certificar-se antes de me mostrar a resposta, no
  **DB de testes fixo `postgres_mcp`**, sem criar/remover databases temporários;
- Rodar o pg_dump real em "D:/projects/binaries/postgres/bin/pg_dump.exe" **em toda análise**;
- **Estudar a capacidade de `src/features/DumpRebuilder.ts`** e dos rebuilders existentes
  (`src/rebuilders/*.ts`, `src/services/DumpRebuilderService.ts`, `queries/`) para alinhar o DDL de
  exemplo ao formato exato que o meu gerador produz (quebras de linha com 2 espaços via `pushNext`,
  etc.);
- Não implementar código na minha base, a menos que eu diga explicitamente;
- Comparar a entrada (como a SQL foi construída) com a saída do pg_dump (como ele exporta): o
  importante é saber se o nosso código é **compatível**, não byte a byte.

# Formato de resposta (análise completa de um CREATE)

Responder na ordem:

1. **O que é a regra** — exatamente o que ela faz, para que serve na prática e sua importância;
2. **O pg_dump real emite?** — sim/não, com evidência (rodando o dump real no DB de testes);
3. **Estrutura mínima** — `CREATE <...>` mais simples e direto possível que aplique a regra, sem
   dados extras; incluir também os objetos que o CREATE desencadeia implicitamente (ex.: PK → índice
   implícito, constraints geradas, colunas identity);
4. **SQL de extração** — consulta completa via pg_catalog no padrão JSON_ARRAYAGG/JSON_BUILD_OBJECT
   (ver exemplo abaixo), com todos os campos realmente úteis;
5. **Descrição dos campos** — lista explicando o que cada output de `entries` representa e por que
   ele é importante para o dump gerado;
6. **DDL de saída exemplo** — como o meu gerador emitiria, no formato humano (estilo DumpRebuilder);
7. **Riscos e edge cases** — priorizar **quoting/escape de identificadores** e as diferenças entre
   `pg_get_expr` / `pg_get_constraintdef` / `pg_get_indexdef` (quando usar cada um); citar outros
   (collations, schemas não-public, etc.) quando relevantes;
8. **Comparação com o pg_dump real** — dois blocos rotulados ("pg_dump real" e "nosso gerador"),
   seguidos de lista de diferenças e veredito de equivalência.

# Convenção de exemplos

- Sempre **minimalistas**, sem dados extras desnecessários;
- Nomear cada exemplo como `example_<letra>` (ex.: `example_a`, `example_b`, `example_c`);
- Variações de um mesmo exemplo: `example_<letra><número>_<breve>` (ex.: `example_d1_xxx`,
  `example_d2_yyy`).

# Estruturação do SQL

Para me auxiliar perfeitamente, o ideal é retornar um exemplar de extração de dados completo, com
todos os campos realmente úteis, similar ao seguinte exemplo:

```sql
SELECT JSON_ARRAYAGG(
  JSON_BUILD_OBJECT(
    'type', 'table',
    'name', pg_class.relname,
    'unlogged', pg_class.relpersistence = 'u',
    'columns', (
      SELECT JSON_ARRAYAGG(
        JSON_BUILD_OBJECT(
          'name', pg_attribute.attname,
          'type', FORMAT_TYPE(pg_attribute.atttypid, pg_attribute.atttypmod),
          'collate', CASE
            WHEN pg_attribute.attcollation <> pg_type.typcollation THEN (
              SELECT JSON_BUILD_OBJECT(
                'schema', NULLIF(pg_namespace.nspname, CURRENT_SCHEMA),
                'name', pg_collation.collname
              )
              FROM pg_collation
              JOIN pg_namespace ON pg_namespace.oid = pg_collation.collnamespace
              WHERE pg_collation.oid = pg_attribute.attcollation
            )
          END,
          'notNull', JSON_BUILD_OBJECT(
            'enabled', pg_attribute.attnotnull,
            'constraint', (
              SELECT NULLIF(pg_constraint.conname, CONCAT_WS('_', pg_class.relname, pg_attribute.attname, 'not_null'))
              FROM pg_constraint
              WHERE
                pg_constraint.conrelid = pg_attribute.attrelid AND
                pg_constraint.contype = 'n' AND
                pg_constraint.conkey = ARRAY[pg_attribute.attnum]
            )
          ),
          'default', CASE
            WHEN pg_attribute.atthasdef AND pg_attribute.attidentity = '' AND pg_attribute.attgenerated = ''
              THEN PG_GET_EXPR(pg_attrdef.adbin, pg_attrdef.adrelid, true)
          END,
          'generated', CASE
            WHEN pg_attribute.attgenerated IN ('s', 'v')
              THEN JSON_BUILD_OBJECT(
                'type', pg_attribute.attgenerated,
                'expression', PG_GET_EXPR(pg_attrdef.adbin, pg_attrdef.adrelid, true)
              )
          END,
          'identity', CASE
            WHEN pg_attribute.attidentity IN ('a', 'd') THEN JSON_BUILD_OBJECT(
              'type', pg_attribute.attidentity,
              'sequence', (
                SELECT JSON_BUILD_OBJECT(
                  'name', NULLIF(pg_sequence.seqrelid::regclass::text, CONCAT_WS('_', pg_class.relname, pg_attribute.attname, 'seq')),
                  'startWith', NULLIF(pg_sequence.seqstart::text, '1'),
                  'incrementBy', NULLIF(pg_sequence.seqincrement::text, '1'),
                  'minValue', NULLIF(pg_sequence.seqmin::text, '1'),
                  'maxValue', NULLIF(pg_sequence.seqmax::text, (2::numeric ^ ((8 * pg_type.typlen) - 1) - 1)::text),
                  'cache', NULLIF(pg_sequence.seqcache::text, '1'),
                  'cycle', pg_sequence.seqcycle
                )
                FROM pg_sequence
                WHERE pg_sequence.seqrelid = PG_GET_SERIAL_SEQUENCE($1 || '.' || pg_class.relname, pg_attribute.attname)::regclass
              )
            )
          END
        )
        ORDER BY pg_attribute.attnum
      )
      FROM pg_attribute
      LEFT JOIN pg_type ON pg_type.oid = pg_attribute.atttypid
      LEFT JOIN pg_attrdef ON
        pg_attrdef.adrelid = pg_attribute.attrelid AND
        pg_attrdef.adnum = pg_attribute.attnum
      WHERE
        pg_attribute.attrelid = pg_class.oid AND
        pg_attribute.attnum > 0 AND
        pg_attribute.attislocal AND
        NOT pg_attribute.attisdropped
    ),
    'pkConstraints', (SELECT JSON_ARRAYAGG(constraints.entry) FROM constraints WHERE constraints.conrelid = pg_class.oid AND constraints.contype = 'p'),
    'uniqueConstraints', (SELECT JSON_ARRAYAGG(constraints.entry) FROM constraints WHERE constraints.conrelid = pg_class.oid AND constraints.contype = 'u'),
    'inherits', (
      SELECT JSON_ARRAYAGG(JSON_BUILD_OBJECT(
        'schema', NULLIF(pg_namespace.nspname, CURRENT_SCHEMA),
        'name', pg_class_parent.relname
      ))
      FROM pg_inherits
      INNER JOIN pg_class pg_class_parent ON pg_class_parent.oid = pg_inherits.inhparent
      INNER JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
      WHERE pg_inherits.inhrelid = pg_class.oid
    ),
    'withOptions',
      COALESCE(pg_class.reloptions, '{}'::text[]) ||
      (SELECT ARRAY_AGG('toast.' || toast.opt) FROM UNNEST(toast.reloptions) AS toast(opt))
  )
  ORDER BY pg_class.relname
) AS entries
FROM pg_class
INNER JOIN namespaces ON
  namespaces.oid = pg_class.relnamespace
LEFT JOIN pg_class AS toast ON
  toast.oid = pg_class.reltoastrelid AND
  toast.relkind = 't'
WHERE
  pg_class.relkind = 'r'
```

E então descrever em uma lista o que é cada output de `entries` — por exemplo, o que `notNull`
representa e por que é importante para o dump gerado.

# Ambiente de trabalho

- MCP PostgreSQL aponta para o DB de testes fixo `postgres_mcp` — usá-lo para as validações; não
  criar/remover databases temporários;
