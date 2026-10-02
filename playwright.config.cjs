const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
 testDir: './tests', testMatch: '*.browser.spec.cjs', workers: 1,
 use: { baseURL: 'http://127.0.0.1:4181', channel: 'chrome', headless: true },
 webServer: { command: 'node scripts/preview.cjs', url: 'http://127.0.0.1:4181/outputs/maps/datacentermap_sweden_interactive_map.html', reuseExistingServer: false },
 reporter: 'list'
});