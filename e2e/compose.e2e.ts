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
	await expect(
		page.locator('tbody tr').filter({ hasText: 'E2E donation' }).locator('input[name="amount"]')
	).toHaveValue('12.34');

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

	await page.goto('/settings/rules');
	await page.getByRole('link', { name: 'New rule', exact: true }).click();
	const ruleEditor = page.locator('#rule-editor');
	await ruleEditor.locator('[name="name"]').fill('E2E cash classification');
	await ruleEditor.locator('[name="condition_text"]').fill('VERSEMENT ESPECES');
	await ruleEditor.locator('[name="set_category_id"]').selectOption('ventes');
	await ruleEditor.getByRole('button', { name: 'Preview', exact: true }).click();
	await expect(
		page.getByRole('heading', { name: 'Matches 0 transactions', exact: true })
	).toBeVisible();
	await ruleEditor.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(
		page.getByRole('heading', { name: 'E2E cash classification', exact: false })
	).toBeVisible();
	await expectWriterCommit();

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
		if (format === 'ccp') {
			await page.getByRole('link', { name: 'VERSEMENT ESPECES', exact: true }).click();
			await expect(page).toHaveURL(/\/transactions\/e2e-ccp\//);
			const csvTransactionUrl = new URL(page.url()).pathname;
			const edit = page.locator('form[action="?/save"]');
			const category = edit.locator('select[name="category_id"]');
			await expect(category).toHaveValue('ventes');
			await expect(
				edit.getByRole('link', { name: 'By rule: E2E cash classification', exact: true })
			).toBeVisible();
			await category.selectOption('dons');
			await edit.getByRole('button', { name: 'Save', exact: true }).click();
			await expect(category).toHaveValue('dons');
			await expect(edit.getByText('Set manually', { exact: false })).toBeVisible();
			await page
				.getByRole('link', { name: 'Create rule from this transaction', exact: true })
				.click();
			await expect(ruleEditor.locator('[name="condition_text"]')).toHaveValue('VERSEMENT ESPECES');
			await expect(ruleEditor.locator('[name="condition_account_id"]')).toHaveValue(
				csvAccountUrl.split('/').pop()!
			);
			await expect(ruleEditor.locator('[name="condition_direction"]')).toHaveValue('in');
			await expect(ruleEditor.locator('[name="set_category_id"]')).toHaveValue('dons');
			await ruleEditor.getByRole('button', { name: 'Preview', exact: true }).click();
			await expect(
				page.getByRole('heading', { name: 'Matches 1 transactions', exact: true })
			).toBeVisible();
			await expect(page.locator('#preview')).toContainText('Set manually — not affected');
			await page.goto(csvTransactionUrl);
			await edit.getByRole('button', { name: 'Reset to automatic', exact: true }).click();
			await expect(category).toHaveValue('ventes');
			await expect(
				edit.getByRole('link', { name: 'By rule: E2E cash classification', exact: true })
			).toBeVisible();
			await expect(
				edit.getByRole('button', { name: 'Reset to automatic', exact: true })
			).toHaveCount(0);
			await expectWriterCommit();
		}
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
