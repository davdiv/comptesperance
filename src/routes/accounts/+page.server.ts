import { m } from '#lib/paraglide/messages.js';
import { parseDecimalToCents } from '#lib/server/money.ts';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireWrite } from '#lib/server/auth.ts';
import { listAccountsWithTotals } from '#lib/server/queries.ts';
import { createAccount } from '#lib/server/repository.ts';
import type { AccountSource } from '#lib/types.ts';

const SOURCES: AccountSource[] = ['csv', 'manual'];

export const load: PageServerLoad = async () => ({
	accounts: await listAccountsWithTotals(),
	sources: SOURCES
});

export const actions: Actions = {
	default: async ({ request, locals }) => {
		requireWrite(locals.user);
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const source = String(form.get('source') ?? 'manual') as AccountSource;
		if (!name) return fail(400, { error: 'Name is required' });
		if (!SOURCES.includes(source)) return fail(400, { error: 'Invalid account source' });
		const balanceText = String(form.get('initial_balance') ?? '').trim();
		const date = String(form.get('initial_balance_date') ?? '').trim();
		const balance = parseDecimalToCents(balanceText);
		if ((balanceText || date) && (balance === null || !date))
			return fail(400, { error: m.checkpoint_invalid() });
		let account;
		try {
			account = await createAccount({
				name,
				source,
				notes: String(form.get('notes') ?? '').trim() || undefined,
				initial_checkpoint: balance !== null ? { date, balance_cents: balance } : undefined
			});
		} catch (e) {
			if (e instanceof Error && e.message === 'checkpoint_invalid')
				return fail(400, { error: m.checkpoint_invalid() });
			throw e;
		}
		redirect(303, `/accounts/${account.id}`);
	}
};
