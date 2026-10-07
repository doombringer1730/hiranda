import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // React Compiler rules: advisory here (the app doesn't use the compiler),
    // so they warn instead of failing CI.
    rules: {
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
    },
  },
  // ── The Theater sandbox (src/theater/README.md) ──
  {
    // App code may only touch the Theater through its public surface.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/theater/**", "src/app/(theater)/**"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{
        regex: "^@/theater/(?!public$)",
        message: "The Theater is sandboxed — import only from '@/theater/public'.",
      }] }],
    },
  },
  {
    // Theater code stands alone: nothing from the rest of the app.
    files: ["src/theater/**/*.{ts,tsx}", "src/app/(theater)/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{
        regex: "^@/(lib|components|app)(/|$)",
        message: "The Theater is sandboxed — copy what you need into src/theater/ instead.",
      }] }],
      // The sync code is deliberately left untouched; don't fail CI on its
      // legacy require() import.
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
