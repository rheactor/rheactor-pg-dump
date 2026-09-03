CREATE TABLE example_b (
  id integer
);

CREATE INDEX example_b_id_idx ON example_b USING btree (id);