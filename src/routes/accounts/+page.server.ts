import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireWrite } from '$lib/server/auth';
import { parseDecimalToCents } from '$lib/server/money';
import { listAccountsWithTotals } from '$lib/server/queries';
import { createAccount } from '$lib/server/repository';
import type { AccountSource, AccountType } from '$lib/types';

const ACCOUNT_TYPES: AccountType[] = ['bank', 'stripe', 'sumup', 'cash', 'other'];
const SOURCES: AccountSource[] = ['csv', 'manual'];

export const load: PageServerLoad = async () => ({
	accounts: await listAccountsWithTotals(),
	accountTypes: ACCOUNT_TYPES,
	sources: SOURCES
});

export const actions: Actions = {
	default: async ({ request, locals }) => {
		requireWrite(locals.user);
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const type = String(form.get('type') ?? 'bank') as AccountType;
		const source = String(form.get('source') ?? 'manual') as AccountSource;
		const currency =
			String(form.get('currency') ?? 'EUR')
				.trim()
				.toUpperCase() || 'EUR';
		const opening = parseDecimalToCents(String(form.get('opening_balance') ?? '')) ?? 0;
		if (!name) return fail(400, { error: 'Name is required' });
		if (!ACCOUNT_TYPES.includes(type)) return fail(400, { error: 'Invalid account type' });
		if (!SOURCES.includes(source)) return fail(400, { error: 'Invalid account source' });
		const account = await createAccount({
			name,
			type,
			source,
			currency,
			opening_balance_cents: opening
		});
		redirect(303, `/accounts/${account.id}`);
	}
};
