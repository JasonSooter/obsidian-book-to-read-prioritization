module.exports = function (_wallaby) {
  return {
    files: ["src/**/*.js", "!src/**/*.test.js", "src/tests/fixtures/*.md"],

    tests: ["src/**/*.test.js"],

    env: {
      type: "node",
      runner: "node",
    },

    testFramework: "jest",

    setup: function (wallaby) {
      const jestConfig = require("./jest.config.js");
      wallaby.testFramework.configure(jestConfig);
    },
  };
};
