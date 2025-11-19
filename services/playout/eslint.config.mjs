import jest from "eslint-plugin-jest";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    ignores: ["dist/**", "**/*.js", "**/*.cjs", "**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["**/__tests__/**/*.ts", "**/*.test.ts"],
    plugins: {
      jest,
    },
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
    rules: {
      ...jest.configs["flat/recommended"].rules,
      "jest/no-conditional-expect": "off",
    },
  }
);

