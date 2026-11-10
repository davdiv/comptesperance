import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireWrite } from '$lib/server/auth';
import type { CsvFormat } from '$lib/server/csv';
import { importCsvFile } from '$lib/server/importer';
import { listAccountsWithTotals } from '$lib/server/queries';

export const load: PageServerLoad = async () => {
	const accounts = await listAccountsWithTotals();
	return { accounts: accounts.filter((account) => account.source === 'csv') };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		requireWrite(locals.user);
		const form = await request.formData();
		const accountId = String(form.get('account_id') ?? '');
		const file = form.get('file');
		const format = String(form.get('format') ?? '') as CsvFormat | '';
		if (!accountId || !file || typeof file === 'string')
			return fail(400, { error: 'Account and CSV file are required' });
		try {
			const result = await importCsvFile(
				accountId,
				file.name,
				await file.text(),
				format === 'ccp' || format === 'sumup' ? format : undefined
			);
			return { ok: true, result };
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Import failed' });
		}
	}
};
