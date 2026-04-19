import type { Config } from "tailwindcss";
import preset from "@rag/config/tailwind/preset";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  presets: [preset],
};

export default config;
