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
  ...nextTs
]);

export default config;
