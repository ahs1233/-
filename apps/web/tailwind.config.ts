import type { Config } from "tailwindcss";
import preset from "@al-souq/config/tailwind-preset";

const config: Config = {
  presets: [preset as Config],
  content: [
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
};

export default config;
