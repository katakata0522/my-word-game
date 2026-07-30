const { defineConfig } = require("@playwright/test");

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

module.exports = defineConfig({
    testDir: "./tests",
    testMatch: "browser.spec.cjs",
    fullyParallel: false,
    workers: 1,
    reporter: "line",
    timeout: 30_000,
    use: {
        baseURL: "http://127.0.0.1:4173",
        headless: true,
        launchOptions: executablePath ? { executablePath } : {}
    },
    webServer: {
        command: "node tests/static-server.cjs",
        port: 4173,
        reuseExistingServer: true,
        timeout: 15_000
    }
});
