import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // Most tests are pure logic; component tests opt in to a DOM with a
    // `// @vitest-environment jsdom` comment at the top of the file.
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["src/test/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
