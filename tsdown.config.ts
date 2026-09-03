import { defineConfig } from "tsdown";

// oxlint-disable-next-line import/no-anonymous-default-export
export default defineConfig({
  minify: true,
  entry: "./src/index.ts",
  platform: "node",
});
