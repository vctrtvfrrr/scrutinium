import { defineConfig } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import baseConfig from "../../eslint.config.mjs";

const config = defineConfig([
  {
    ignores: ["eslint.config.mjs", "postcss.config.mjs", "tailwind.config.ts"]
  },
  ...baseConfig,
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/server/actions/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/restrict-template-expressions": "off"
    }
  }
]);

export default config;
