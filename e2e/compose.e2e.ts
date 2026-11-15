import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function expectWriterCommit() {
	const { stdout } = await execFileAsync('docker', [
		'compose',
		'exec',
		'-T',
		'app',
		'git',
		'-C',
		'/data',
		'log',
		'-1',
		'--format=%an <%ae>|%cn <%ce>'
	]);
	expect(stdout.trim()).toBe(
		'Alice Read-write <alice@example.local>|comptes app <comptes@app.local>'
	);
}

async function signIn(page: Page, user: 'alice' | 'bob', destination = '/accounts') {
	await page.goto(destination);
	await expect(page).toHaveURL(/^https:\/\/auth\.comptes\.localhost:8443\//);
	const returnUrl = new URL(page.url()).searchParams.get('rd');
	expect(returnUrl).toBeTruthy();
	await page.locator('#username-textfield').fill(user);
	await page.locator('#password-textfield').fill(user);
	await page.locator('#sign-in-button').click();
	await expect(page).toHaveURL(returnUrl ?? '');
}

async function signOut(page: Page) {
	await page.getByRole('link', { name: 'Sign out', exact: true }).click();
	await expect(page.locator('#sign-in-button')).toBeVisible();
	await page.goto('/accounts');
	await expect(page.locator('#sign-in-button')).toBeVisible();
}

async function refusedAccountWrite(page: Page) {
	return page.evaluate(async () => {
		const response = await fetch('/accounts', {
			method: 'POST',
			body: new URLSearchParams({ name: 'Forbidden E2E account', source: 'manual' })
		});
		return response.status;
	});
}

async function createAccount(page: Page, name: string, source: 'manual' | 'csv') {
	await page.goto('/accounts');
	await page.locator('details:has(input[name="name"]) > summary').click();
	const form = page.locator('form:has(input[name="name"])');
	await form.locator('[name="name"]').fill(name);
	await form.locator('[name="source"]').selectOption(source);
	await form.getByRole('button', { name: 'Create', exact: true }).click();
	await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();
	return new URL(page.url()).pathname;
}

async function importStatement(page: Page, account: string, format: 'ccp' | 'sumup') {
	await page.goto('/import');
	await page.locator('[name="account_id"]').selectOption({ label: account });
	await page.locator('[name="format"]').selectOption(format);
	await page
		.locator('input[type="file"]')
		.setInputFiles(
			fileURLToPath(new URL(`../src/lib/server/csv/testdata/${format}-sample.csv`, import.meta.url))
		);
	await page.getByRole('button', { name: 'Import', exact: true }).click();
	await expect(page.getByRole('status').filter({ hasText: 'Import completed.' })).toBeVisible();
}

test('signed-out redirect, read-only authorization and sign-out', async ({ page, baseURL }) => {
	await signIn(page, 'bob', '/accounts?e2e=return');
	await expect(page).toHaveURL(new URL('/accounts?e2e=return', baseURL).href);
	await expect(
		page.getByRole('heading', { level: 1, name: 'Accounts', exact: true })
	).toBeVisible();
	await expect(page.getByRole('button', { name: 'Switch to edit mode', exact: true })).toHaveCount(
		0
	);
	await expect(page.locator('form:has(input[name="name"])')).toHaveCount(0);
	expect(await refusedAccountWrite(page)).toBe(403);
	expect(
		await page.evaluate(async () => {
			const response = await fetch('/edit-mode', {
				method: 'POST',
				body: new URLSearchParams({ mode: 'on', return_to: '/accounts' })
			});
			return response.status;
		})
	).toBe(403);
	const profile = page.getByRole('link', { name: 'Profile & security', exact: true });
	await expect(profile).toHaveAttribute(
		'href',
		'https://auth.comptes.localhost:8443/settings/security'
	);
	await profile.click();
	await expect(page).toHaveURL('https://auth.comptes.localhost:8443/settings/security');
	await page.goto('/projects');
	await expect(
		page.getByRole('heading', { level: 1, name: 'Projects', exact: true })
	).toBeVisible();
	await signOut(page);
});

test('writer edit mode, account, transaction, allocation, large evidence and CSV deduplication', async ({
	page
}) => {
	await signIn(page, 'alice');
	await expect(
		page.getByRole('button', { name: 'Switch to edit mode', exact: true })
	).toBeVisible();
	await expect(page.locator('form:has(input[name="name"])')).toHaveCount(0);
	expect(await refusedAccountWrite(page)).toBe(403);
	await page.getByRole('button', { name: 'Switch to edit mode', exact: true }).click();
	await expect(
		page.getByRole('button', { name: 'Return to read-only', exact: true })
	).toBeVisible();

	await page.goto('/projects');
	await page.locator('details:has(input[name="name"]) > summary').click();
	const projectForm = page.locator('form:has(input[name="name"])');
	await projectForm.locator('[name="name"]').fill('E2E community project');
	await projectForm.getByRole('button', { name: 'New project', exact: true }).click();
	await expect(
		page.getByRole('heading', { level: 1, name: 'E2E community project' })
	).toBeVisible();
	const projectUrl = new URL(page.url()).pathname;

	const accountUrl = await createAccount(page, 'E2E cash', 'manual');
	await expectWriterCommit();
	await page.getByText('New transaction', { exact: true }).click();
	const transactionForm = page.locator('form[action="?/add_transaction"]');
	await transactionForm.locator('[name="date"]').fill('2026-01-15');
	await transactionForm.locator('[name="amount"]').fill('12.34');
	await transactionForm.locator('[name="label"]').fill('E2E donation');
	await transactionForm.getByRole('button', { name: 'Create', exact: true }).click();
	await page.getByRole('link', { name: 'E2E donation', exact: true }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'E2E donation' })).toBeVisible();
	const transactionUrl = new URL(page.url()).pathname;
	const allocation = page.locator('form[action="?/add_project_allocation"]');
	await allocation.locator('[name="project_id"]').selectOption({ label: 'E2E community project' });
	await allocation.locator('[name="amount"]').fill('12.34');
	await allocation.getByRole('button').click();
	await expect(
		page.locator('#allocations').getByRole('link', { name: 'E2E community project' })
	).toBeVisible();
	await page.goto(projectUrl);
	await expect(page.getByRole('link', { name: 'E2E donation', exact: true })).toBeVisible();
	const projectRow = page.locator('tbody tr').filter({ hasText: 'E2E donation' });
	await expect(projectRow).toContainText('€12.34');
	await expect(projectRow.locator('input, select, textarea, form')).toHaveCount(0);
	await page.goto('/');
	await expect(page.locator('table, input[name="search"]')).toHaveCount(0);
	await expect(page.getByRole('link', { name: /Transactions/ })).toHaveCount(2);

	await page.goto(transactionUrl);
	const evidence = Buffer.alloc(2 * 1024 * 1024, ' ');
	evidence.write('%PDF-1.4\n');
	evidence.write('\n%%EOF\n', evidence.length - 7);
	const filename = 'e2e-large-evidence.pdf';
	const upload = page.locator('form[action="?/upload_evidence"]');
	await upload.locator('input[type="file"]').setInputFiles({
		name: filename,
		mimeType: 'application/pdf',
		buffer: evidence
	});
	await upload.locator('button').click();
	await expectWriterCommit();
	await expect(page.getByRole('link', { name: filename, exact: true })).toBeVisible();
	await page.goto('/documents');
	await expect(page.locator('tbody tr').filter({ hasText: filename })).toContainText('2.0 MB');
	const downloadUrl = await page
		.getByRole('link', { name: filename, exact: true })
		.getAttribute('href');
	expect(downloadUrl).toBeTruthy();
	expect(
		await page.evaluate(async (url) => {
			const response = await fetch(url);
			return { status: response.status, size: (await response.arrayBuffer()).byteLength };
		}, downloadUrl ?? '')
	).toEqual({ status: 200, size: evidence.length });

	for (const [format, count] of [
		['ccp', 4],
		['sumup', 4]
	] as const) {
		const accountName = `E2E ${format}`;
		const csvAccountUrl = await createAccount(page, accountName, 'csv');
		await importStatement(page, accountName, format);
		await expectWriterCommit();
		await page.goto(csvAccountUrl);
		const rows = page.locator('tbody tr:has(a[href^="/transactions/"])');
		await expect(rows).toHaveCount(count);
		const originalRows = await rows.allTextContents();
		const originalLinks = await rows
			.locator('a[href^="/transactions/"]')
			.evaluateAll((links) => links.map((link) => link.getAttribute('href')));
		await importStatement(page, accountName, format);
		await page.goto(csvAccountUrl);
		await expect(rows).toHaveCount(count);
		expect(await rows.allTextContents()).toEqual(originalRows);
		expect(
			await rows
				.locator('a[href^="/transactions/"]')
				.evaluateAll((links) => links.map((link) => link.getAttribute('href')))
		).toEqual(originalLinks);
	}

	await page.goto(accountUrl);
	await page.getByRole('button', { name: 'Return to read-only', exact: true }).click();
	await expect(
		page.getByRole('button', { name: 'Switch to edit mode', exact: true })
	).toBeVisible();
	await expect(page.locator('form[action="?/add_transaction"]')).toHaveCount(0);
	expect(await refusedAccountWrite(page)).toBe(403);
	await signOut(page);
});

test('transaction pagination and internal-transfer selections, allocation movement and responsive layout', async ({
	page,
	baseURL
}, testInfo) => {
	await signIn(page, 'alice');
	await page.getByRole('button', { name: 'Switch to edit mode', exact: true }).click();
	await page.goto('/projects');
	await page.locator('details:has(input[name="name"]) > summary').click();
	const projectForm = page.locator('form:has(input[name="name"])');
	await projectForm.locator('[name="name"]').fill('E2E transfer allocation');
	await projectForm.getByRole('button', { name: 'New project', exact: true }).click();
	await expect(
		page.getByRole('heading', { level: 1, name: 'E2E transfer allocation' })
	).toBeVisible();
	const projectId = new URL(page.url()).pathname.split('/').at(-1)!;
	const cash = await createAccount(page, 'E2E pagination cash', 'manual');
	const bank = await createAccount(page, 'E2E pagination bank', 'manual');
	for (const [account, count, amount, date] of [
		[cash, 26, '10.00', '2026-11-01'],
		[bank, 2, '-10.00', '2026-11-02']
	] as const) {
		for (let index = 0; index < count; index++) {
			const response = await page.request.post(account + '?/add_transaction', {
				headers: { origin: baseURL! },
				form: {
					date,
					amount,
					label: `E2E pagination ${account === bank ? 'bank' : 'cash'} ${index}`
				}
			});
			expect(response.ok()).toBe(true);
		}
	}
	await page.goto(cash + '?limit=25');
	const rows = page.locator('tbody tr:has(a[href^="/transactions/"])');
	await expect(rows).toHaveCount(25);
	const pager = page.getByRole('navigation', { name: 'Transaction pages' });
	await pager.getByRole('link', { name: 'Next', exact: true }).click();
	await expect(rows).toHaveCount(1);
	await pager.getByRole('combobox').selectOption('50');
	await expect(rows).toHaveCount(26);
	expect(new URL(page.url()).searchParams.has('offset')).toBe(false);
	await page.goto('/transfers?pool_search=E2E+pagination&pool_limit=25');
	const creator = page.locator('#transfer-create');
	await creator.locator(':scope > summary').click();
	await creator
		.locator('label')
		.filter({ hasText: 'E2E pagination bank 0' })
		.getByRole('checkbox')
		.check();
	await expect(creator).toContainText('1 selected transactions');
	await creator.getByRole('link', { name: 'Next', exact: true }).click();
	await expect(creator.getByRole('checkbox')).toHaveCount(3);
	await expect(creator).toContainText('1 selected transactions');
	await creator.getByRole('checkbox').first().check();
	await expect(creator).toContainText('2 selected transactions');
	const refs = await creator
		.locator('input[name="members"]')
		.evaluateAll((inputs) =>
			inputs.map((input) => JSON.parse((input as HTMLInputElement).value) as [string, string])
		);
	for (const [account, id] of refs) {
		const response = await page.request.post(
			`/transactions/${account}/${id}?/add_project_allocation`,
			{
				headers: { origin: baseURL! },
				form: {
					project_id: projectId,
					amount: account === bank.split('/').at(-1) ? '-10.00' : '10.00'
				}
			}
		);
		expect(response.ok()).toBe(true);
	}
	await creator
		.getByRole('button', { name: 'Create an internal transfer group', exact: true })
		.click();
	await expect(
		page.locator('section').filter({ hasText: 'Internal transfer groups' })
	).toContainText('Amount moved');
	await page.locator('section details > summary').click();
	const allocationRow = page.locator('tbody tr').filter({ hasText: 'E2E transfer allocation' });
	await expect(allocationRow).toContainText('€10.00');
	await expect(allocationRow).toContainText('€0.00');
	await expect(creator).toContainText('0 selected transactions');
	await creator.locator(':scope > summary').click();
	await page.screenshot({ path: testInfo.outputPath('transfers-desktop.png'), fullPage: true });
	await page.setViewportSize({ width: 390, height: 844 });
	await expect(page.locator('aside')).not.toBeInViewport();
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
		true
	);
	await expect(allocationRow).toBeVisible();
	await page.screenshot({ path: testInfo.outputPath('transfers-mobile.png'), fullPage: true });
	await creator.locator(':scope > summary').click();
	await creator
		.locator('label')
		.filter({ hasText: 'E2E pagination bank 1' })
		.getByRole('checkbox')
		.check();
	await creator
		.locator('label')
		.filter({ hasText: 'E2E pagination cash' })
		.getByRole('checkbox')
		.first()
		.check();
	await expect(creator).toContainText('2 selected transactions');
	await creator
		.getByRole('button', { name: 'Create an internal transfer group', exact: true })
		.click();
	await expect(creator).toContainText('0 selected transactions');
	await expect(page.locator('section').getByText('Balanced', { exact: true })).toHaveCount(2);
});
