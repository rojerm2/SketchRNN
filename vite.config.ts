import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import modelSource from "./src/model-source.json";
const manifest = JSON.stringify(modelSource, null, 2) + "\n";
export default defineConfig(({ mode, command }) => ({
  plugins: [
    react(),
    {
      name: "model-provenance",
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          if (request.url !== "/model-source.json") {
            next();
            return;
          }
          response.setHeader("Content-Type", "application/json");
          response.end(manifest);
        });
      },
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "model-source.json",
          source: manifest,
        });
      },
    },
  ],
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
