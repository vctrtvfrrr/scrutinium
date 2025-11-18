import type { Config } from "tailwindcss";
import baseConfig from "../../packages/ui/tailwind.config";
import animate from "tailwindcss-animate";

const config: Config = {
  presets: [baseConfig],
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}"
  ],
  plugins: [animate]
};

export default config;

