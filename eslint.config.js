import js from "@eslint/js";
import globals from "globals";

// Lints the server-side code (Vercel middleware/functions), tools and tests.
// Browser scripts in js/ are plain ES5 files shipped as-is and are not linted yet.
export default [
  { ignores: ["node_modules/**", "js/**", "assets/**", "cargar-fotos/**", ".lh/**", ".playwright-mcp/**"] },
  js.configs.recommended,
  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: { ecmaVersion: 2023, sourceType: "module", globals: { ...globals.node } },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      eqeqeq: ["error", "smart"],
      "prefer-const": "error",
    },
  },
];
