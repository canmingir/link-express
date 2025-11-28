module.exports = {
  env: {
    es6: true,
    node: true,
    mocha: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    project: "./tsconfig.json",
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended",
  ],
  ignorePatterns: ["/node_modules", "/dist"],
  rules: {
    eqeqeq: ["error", "always"],
    "no-console": "off",
    "no-eval": "error",
    "no-var": "error",
    "prefer-arrow-callback": "error",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
  },
};
