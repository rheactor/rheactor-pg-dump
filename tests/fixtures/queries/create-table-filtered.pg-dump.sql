CREATE TABLE example_a (
    id integer
);

CREATE TABLE example_b (
    id integer
);

CREATE TABLE example_c (
    id integer
);

CREATE INDEX example_b_id_idx ON example_b USING btree (id);
