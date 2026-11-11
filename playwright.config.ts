import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: './e2e',
	testMatch: '**/*.e2e.ts',
	fullyParallel: false,
	workers: 1,
	forbidOnly: !!process.env.CI,
	retries: 0,
	timeout: 120_000,
	expect: { timeout: 15_000 },
	reporter: [['list'], ['html', { open: 'never' }]],
	use: {
		baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'https://comptes.localhost:8443',
		channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
		ignoreHTTPSErrors: true,
		locale: 'en-GB',
		viewport: { width: 1440, height: 1000 },
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure'
	}
});
