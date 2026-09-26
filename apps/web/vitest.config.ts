import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["app/**/*.test.ts"],
    environment: "node",
    // graphql ships CJS and ESM builds without an exports map. Inlining the
    // libraries that import it makes them resolve the same copy as our code;
    // otherwise its instanceof checks see two graphql modules.
    server: { deps: { inline: [/@pothos\//, /graphql-yoga/, /@graphql-yoga\//] } },
  },
});
