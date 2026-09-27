import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    fileParallelism: false,
    pool: "forks",
    testTimeout: 30_000,
    // scripts/*.test.mjs files use node's built-in `node:test` runner
    // (run via `node --test`), not vitest — vitest's default include glob
    // (**/*.test.mjs) picks them up too, and vitest chokes trying to run a
    // node:test suite as its own. Exclude the whole scripts/ tree from
    // vitest's default excludes plus this one.
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*",
      "scripts/**/*.test.mjs",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
