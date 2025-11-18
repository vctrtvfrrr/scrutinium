import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import tseslint from "typescript-eslint";

const baseConfig = defineConfig([
  {
    ignores: [
      "node_modules",
      "dist",
      ".turbo",
      ".next",
      "apps/web/.next",
      "packages/**/dist",
      "coverage",
      "drizzle",
      "bun.lockb"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylistic,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    }
  }
]);

export default baseConfig;

