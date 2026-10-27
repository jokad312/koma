import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      // Les faux prestataires de tests/doubles ne doivent jamais entrer dans la production (règle 13).
      "no-restricted-imports": [
        "error",
        { patterns: [{ group: ["**/tests/doubles", "**/tests/doubles/**"], message: "Interdit : tests/doubles est réservé aux tests." }] },
      ],
    },
  },
  {
    // Aucun texte visible en dur dans les composants : les libellés viennent de messages/*.json (FR-55).
    files: ["src/**/*.tsx"],
    ignores: ["src/**/*.test.tsx"],
    rules: {
      "react/jsx-no-literals": ["error", { noStrings: false, allowedStrings: [], ignoreProps: true }],
      // Les props qui portent du texte visible ou lu par un lecteur d'écran viennent aussi de messages/*.json
      // (alt="" reste permis : image décorative). className, href, id, etc. ne sont pas concernés.
      "no-restricted-syntax": [
        "error",
        {
          selector: 'JSXAttribute[name.name=/^(alt|aria-label|title|placeholder)$/] > Literal[value!=""]',
          message: "Texte en dur interdit dans cette prop : utiliser messages/*.json.",
        },
        {
          selector:
            "JSXAttribute[name.name=/^(alt|aria-label|title|placeholder)$/] > JSXExpressionContainer > :matches(Literal, TemplateLiteral)",
          message: "Texte en dur interdit dans cette prop : utiliser messages/*.json.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Notes de relais et brouillons de revue : jamais du code à revoir.
    ".relais/**",
  ]),
]);

export default eslintConfig;
