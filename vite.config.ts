import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
export default defineConfig(({ mode, command }) => ({
  plugins: [react()],
  resolve: {
    alias:
      command === "serve" && mode === "e2e"
        ? [
            {
              find: "./inference",
              replacement: fileURLToPath(
                new URL("./tests/fake-inference.ts", import.meta.url),
              ),
            },
          ]
        : [],
  },
  test: { include: ["src/**/*.test.ts"] },
}));
