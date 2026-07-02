import type { Config } from "tailwindcss";

/**
 * Tailwind CSS v4 configuration.
 *
 * In v4 the bulk of theming lives in CSS via the `@theme` directive
 * (see `src/app/globals.css`). This file is kept for explicit `content`
 * globbing and to satisfy tooling/editors that expect a config file.
 */
const config: Config = {
  content: ["./src/app/**/*.{ts,tsx}", "./src/components/**/*.{ts,tsx}", "./src/lib/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
