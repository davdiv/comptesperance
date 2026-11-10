import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireWrite } from '$lib/server/auth';
import { parseDecimalToCents } from '$lib/server/money';
import { getAccountWithTotals, listIssues, listTransactions } from '$lib/server/queries';
import { createManualTransaction, updateAccount } from '$lib/server/repository';
import type { AccountType } from '$lib/types';

const ACCOUNT_TYPES: AccountType[] = ['bank', 'sumup', 'stripe', 'cash', 'other'];

export const load: PageServerLoad = async ({ params }) => {
	const account = await getAccountWithTotals(params.account_id);
	if (!account) error(404, 'Account not found');
	const [transactions, issues] = await Promise.all([
		listTransactions({ account_id: account.account_id, include_transfers: true, limit: 500 }),
		listIssues(account.account_id)
	]);
	return { account, transactions: transactions.transactions, issues, accountTypes: ACCOUNT_TYPES };
};

export const actions: Actions = {
	update: async ({ request, locals, params }) => {
		requireWrite(locals.user);
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const currency = String(form.get('currency') ?? '')
			.trim()
			.toUpperCase();
		const opening = parseDecimalToCents(String(form.get('opening_balance') ?? ''));
		const type = String(form.get('type') ?? '') as AccountType;
		try {
			await updateAccount(params.account_id, {
				name: name || undefined,
				currency: currency || undefined,
				opening_balance_cents: opening ?? undefined,
				type: ACCOUNT_TYPES.includes(type) ? type : undefined
			});
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Update failed' });
		}
		return { ok: true };
	},
	add_transaction: async ({ request, locals, params }) => {
		requireWrite(locals.user);
		const account = await getAccountWithTotals(params.account_id);
		if (!account) error(404, 'Account not found');
		if (account.source !== 'manual') return fail(400, { error: 'CSV accounts are read-only' });
		const form = await request.formData();
		const amount = parseDecimalToCents(String(form.get('amount') ?? ''));
		const date = String(form.get('date') ?? '').trim();
		if (!amount || !date) return fail(400, { error: 'Date and amount are required' });
		try {
			await createManualTransaction(account.account_id, {
				date,
				value_date: String(form.get('value_date') ?? '').trim() || undefined,
				amount_cents: amount,
				currency: account.currency,
				label: String(form.get('label') ?? '').trim() || 'Manual transaction',
				description: String(form.get('description') ?? '').trim() || undefined,
				category: String(form.get('category') ?? '').trim() || undefined,
				notes: String(form.get('notes') ?? '').trim() || undefined,
				counts_in_total: form.get('counts_in_total') === 'on',
				excluded: form.get('counts_in_total') !== 'on'
			});
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Create failed' });
		}
		return { ok: true };
	}
};
