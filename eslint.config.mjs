import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  // These metadata routes render through Satori inside ImageResponse, which only
  // handles raw <img>. The upstream rule's own metadata-route exemption is
  // platform-dependent (it collapses only the first path separator), so scope the
  // rule off here instead of relying on a disable directive that is "unused" on
  // Linux and "used" on Windows.
  {
    files: ["app/apple-icon.tsx", "app/opengraph-image.tsx"],
    rules: { "@next/next/no-img-element": "off" },
  },
  globalIgnores([".next/**", "out/**", "build/**", "coverage/**", "next-env.d.ts"]),
]);
