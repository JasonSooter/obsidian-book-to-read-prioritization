# Wallaby.js Configuration Guide

This project includes a Wallaby.js configuration for continuous test running in your IDE.

## Setup Instructions

### 1. Install Wallaby.js

- Install the Wallaby.js extension for your IDE:
  - **VS Code**: Search for "Wallaby.js" in the extensions marketplace
  - **WebStorm/IntelliJ**: Install the Wallaby.js plugin
  - **Other IDEs**: Check [Wallaby.js documentation](https://wallabyjs.com/)

### 2. Configuration Details

The `wallaby.js` file is already configured with:

- **Simplified Setup**: Minimal configuration to avoid path issues
- **Jest Integration**: Built-in Jest configuration without external dependencies
- **Auto Node.js Detection**: Wallaby automatically finds your Node.js installation
- **Test Selection**: Runs only the stable unit tests (`helpers.test.js`, `edge-cases.test.js`)

### 3. Simplified Configuration

The configuration uses Wallaby's built-in Node.js detection:

- **Automatic detection**: Wallaby finds your Node.js installation automatically
- **No path configuration needed**: Works with NVM, Homebrew, and standard installations
- **Minimal setup**: Just Jest + Node.js, no external config files

### 4. Usage

Once Wallaby.js is installed and configured:

1. **Start Wallaby**: Use the command palette/menu to start Wallaby.js
2. **Automatic Testing**: Tests run automatically as you type
3. **Real-time Feedback**: See test results directly in your editor
4. **Coverage**: View code coverage inline (gutter indicators)

### 5. Troubleshooting

#### Jest Config Issues

If you get "Cannot find module './jest.config.js'" errors:

1. **Use the simplified config**: The main `wallaby.js` has been simplified to avoid this issue
2. **Path issues**: Wallaby runs from a different directory context than your project

#### Jest Runner Issues

If you get "Cannot find Jest test runner" errors:

1. **Try alternative configs**:
   - `wallaby.explicit.js`: Uses explicit Jest paths
   - `wallaby.cmd.js`: Uses Jest command directly
2. **Check Jest installation**: Run `npx jest --version` to verify Jest is installed
3. **Restart Wallaby**: Stop and restart Wallaby.js completely

#### Node.js Path Issues

If you get Node.js path errors:

1. Check your Node.js installation: `which node`
2. The simplified config should auto-detect Node.js
3. Ensure Node.js is in your PATH

#### Performance Issues

If Wallaby feels slow:

1. Set `debug: true` in the config for more information
2. Adjust `workers.regular` count based on your machine
3. Increase `delays.run` for slower systems

#### Test Exclusions

The config excludes `script.test.js` because:

- Integration tests require complex mocking
- They're slower than unit tests
- Better suited for traditional `npm test` runs

### 6. Available Files

- **Source**: `src/index.js.js`
- **Tests**: `helpers.test.js`, `edge-cases.test.js`
- **Fixtures**: `book-sample.md`, `edge-cases.md`
- **Config**: `package.json` (for dependencies)

### 7. Advanced Configuration

The current `wallaby.js` is intentionally minimal. To add advanced features:

```javascript
module.exports = function () {
  return {
    files: ["src/index.js.js"],
    tests: ["helpers.test.js", "edge-cases.test.js"],
    env: { type: "node" },
    testFramework: "jest",

    // Add performance optimizations:
    workers: { initial: 1, regular: 1 },
    delays: { run: 300, edit: 100 },

    // Add debugging:
    debug: true,
  };
};
```

### 8. Performance Tips

- **Fast Feedback**: Changes trigger tests in ~300ms
- **Smart Caching**: Only affected tests re-run
- **Coverage Display**: Real-time coverage in editor gutter
- **Error Highlighting**: Failed assertions highlighted inline

## Example Usage

```javascript
// Edit this function in src/index.js.js
const lower = s => String(s || "").toLowerCase();

// Wallaby immediately shows:
// ✅ All tests passing
// 📊 Coverage information
// 🎯 Affected test results
```

The configuration is optimized for the functional programming style used in this project and should provide fast, reliable continuous testing.
