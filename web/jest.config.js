/** @type {import('jest').Config} */
const config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/lib", "<rootDir>/app"],
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  collectCoverageFrom: [
    "lib/**/*.ts",
    "app/**/*.ts",
    "!**/__tests__/**",
    "!**/node_modules/**",
  ],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
};

module.exports = config;
