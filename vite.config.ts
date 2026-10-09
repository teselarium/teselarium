import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { host: "127.0.0.1" },
  preview: { host: "127.0.0.1" },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "lib",
          include: ["src/lib/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "app",
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: ["src/lib/**"],
          environment: "jsdom",
          setupFiles: ["src/test/setup.ts"],
        },
      },
    ],
  },
});
