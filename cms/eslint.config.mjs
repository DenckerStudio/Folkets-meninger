import { defineConfig } from "eslint/config";
import next from "eslint-config-next";

export default defineConfig([
  {
    ignores: [".next/**", "node_modules/**", "standalone/**"],
  },
  {
    extends: [...next],
    files: ["src/**/*.{ts,tsx,js,jsx}", "*.{ts,js,mjs}"],
  },
]);
