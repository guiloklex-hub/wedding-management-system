import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// `server-only`/`client-only` são resolvidos pelo Next no build, mas não pelo
// Vite/Vitest — apontamos para um stub vazio para testar módulos server-only.
const emptyModule = fileURLToPath(new URL("./src/test-utils/empty-module.ts", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      "server-only": emptyModule,
      "client-only": emptyModule,
    },
  },
  test: {
    globals: false,
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", "prisma"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/lib/**", "src/app/actions/**", "src/components/**"],
      exclude: ["**/*.test.*", "src/lib/prisma.ts"],
    },
  },
});
