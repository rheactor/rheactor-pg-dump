CREATE TABLE example_a (
    id integer,
    status text
);

CREATE INDEX example_a_status_idx ON example_a USING btree (status);
