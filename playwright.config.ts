import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',

    use: {
        baseURL: 'http://localhost:8080',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },

    /* Configure mobile viewports for testing */
    projects: [
        {
            name: 'Mobile iPhone SE',
            use: { ...devices['iPhone SE'] },
        },
        {
            name: 'Mobile iPhone 14',
            use: { ...devices['iPhone 14'] },
        },
        {
            name: 'Mobile iPhone 14 Landscape',
            use: {
                ...devices['iPhone 14'],
                viewport: { width: 844, height: 390 },
            },
        },
        {
            name: 'Tablet iPad',
            use: { ...devices['iPad (gen 7)'] },
        },
    ],

    /* Run local dev server before starting tests */
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:8080',
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
    },
});
