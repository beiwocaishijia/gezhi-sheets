const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
    testDir: './test-browser',
    testMatch: '**/*.spec.cjs',
    fullyParallel: false,
    workers: 1,
    timeout: 45000,
    expect: { timeout: 10000 },
    reporter: [['list'], ['html', { open: 'never' }]],
    use: {
        baseURL: 'http://127.0.0.1:8003',
        viewport: { width: 1440, height: 1000 },
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        launchOptions: { executablePath: process.env.CE_LAB_TEST_CHROMIUM || undefined },
    },
    webServer: { command: 'node test-browser/server.cjs', url: 'http://127.0.0.1:8003/api/health', reuseExistingServer: false, timeout: 60000 },
});
