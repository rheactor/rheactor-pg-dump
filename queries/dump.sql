SELECT
  pg_class.relname AS "name",
  pg_class.relpersistence = 'u' AS "unlogged",
  (
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

    LEFT JOIN pg_type ON
      pg_type.oid = pg_attribute.atttypid

    LEFT JOIN pg_attrdef ON
      pg_attrdef.adrelid = pg_attribute.attrelid AND
      pg_attrdef.adnum = pg_attribute.attnum

    WHERE
      pg_attribute.attrelid = pg_class.oid AND
      pg_attribute.attnum > 0 AND
      pg_attribute.attislocal AND
      NOT pg_attribute.attisdropped
  ) AS "columns",
  (
    SELECT JSON_ARRAYAGG(
      JSON_BUILD_OBJECT(
        'name', pg_constraint.conname,
        'expression', PG_GET_CONSTRAINTDEF(pg_constraint.oid, true),
        'withOptions', pg_class_self.reloptions
      )
      ORDER BY
        pg_constraint.contype <> 'u',
        pg_constraint.contype <> 'p',
        pg_constraint.contype <> 'x',
        pg_constraint.contype <> 'f',
        pg_constraint.conname
    )
    FROM pg_constraint

    LEFT JOIN pg_class AS pg_class_self ON
      pg_class_self.oid = pg_constraint.conindid

    WHERE
      pg_constraint.conrelid = pg_class.oid AND
      pg_constraint.conparentid = 0 AND
      pg_constraint.contype IN ('u', 'p', 'x', 'f')
  ) AS "constraints",
  (
    SELECT JSON_ARRAYAGG(JSON_BUILD_OBJECT(
      'schema', NULLIF(pg_namespace.nspname, CURRENT_SCHEMA),
      'name', pg_class_parent.relname
    ))
    FROM pg_inherits

    INNER JOIN pg_class pg_class_parent ON
      pg_class_parent.oid = pg_inherits.inhparent

    INNER JOIN pg_namespace ON
      pg_namespace.oid = pg_class.relnamespace

    WHERE pg_inherits.inhrelid = pg_class.oid
  ) AS "inherits",
  COALESCE(pg_class.reloptions, '{}'::text[]) ||
    (SELECT ARRAY_AGG('toast.' || toast.opt) FROM UNNEST(pg_class_toast.reloptions) AS toast(opt)) AS "withOptions",
  (
    SELECT JSON_ARRAYAGG(
      PG_GET_INDEXDEF(pg_index.indexrelid, 0, true)
      ORDER BY pg_class_index.relname
    )
    FROM pg_index

    JOIN pg_class AS pg_class_index ON
      pg_class_index.oid = pg_index.indexrelid

    WHERE
      pg_index.indrelid = pg_class.oid AND
      NOT EXISTS (SELECT TRUE FROM pg_constraint WHERE pg_constraint.conindid = pg_index.indexrelid AND pg_constraint.conparentid = 0)
  ) AS "indexes"
FROM pg_class

INNER JOIN pg_namespace ON
  pg_namespace.oid = pg_class.relnamespace

LEFT JOIN pg_class AS pg_class_toast ON
  pg_class_toast.oid = pg_class.reltoastrelid AND
  pg_class_toast.relkind = 't'

WHERE
  (
    $2::text[] IS NULL OR
    pg_class.relname = ANY(
      SELECT LOWER(name) FROM UNNEST($2::text[]) AS name
    )
  ) AND
  pg_namespace.nspname = $1 AND
  pg_class.relkind = 'r'

ORDER BY pg_class.relname
