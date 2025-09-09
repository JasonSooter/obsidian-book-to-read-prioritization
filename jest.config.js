module.exports = {
  testEnvironment: "node",
  roots: ["."],
  collectCoverage: true,
  coverageDirectory: "coverage",
  collectCoverageFrom: [
    "src/index.js",
    "!node_modules/**",
    "!coverage/**",
    "!jest.config.js",
    "!**/*.test.js",
  ],
  testMatch: ["**/*.test.js"],
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  verbose: true,
};
