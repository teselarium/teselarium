import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // The app routes with the hash, so dev and preview answer missing files with 404 like static hosts.
  appType: "mpa",
  server: { host: "127.0.0.1" },
  preview: { host: "127.0.0.1" },
  test: {
    // The theme imports its base stylesheet as text, which Vitest empties unless CSS is processed.
    css: { include: [/base_stylesheet\.css/] },
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
