import { transactionFilterState } from '$lib/server/transaction-list';
import { m } from '$lib/paraglide/messages.js';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireWrite } from '$lib/server/auth';
import { parseDecimalToCents } from '$lib/server/money';
import { getAccountWithTotals, listIssues, listTransactions } from '$lib/server/queries';
import {
	createManualTransaction,
	updateAccount,
	addManualCheckpoint,
	deleteManualCheckpoint
} from '$lib/server/repository';

export const load: PageServerLoad = async ({ params, url }) => {
	const account = await getAccountWithTotals(params.account_id);
	if (!account) error(404, 'Account not found');
	const state = await transactionFilterState(
		url,
		{ account_id: params.account_id },
		{ include_transfers: true }
	);
	const [transactions, issues] = await Promise.all([
		listTransactions(state.filters),
		listIssues(account.account_id)
	]);
	return { ...state, ...transactions, account, issues };
};

export const actions: Actions = {
	add_checkpoint: async ({ request, locals, params }) => {
		requireWrite(locals.user);
		const form = await request.formData();
		const balance = parseDecimalToCents(String(form.get('balance') ?? ''));
		if (balance === null) return fail(400, { error: m.checkpoint_invalid() });
		try {
			await addManualCheckpoint(params.account_id, {
				date: String(form.get('date') ?? ''),
				balance_cents: balance,
				note: String(form.get('note') ?? '')
			});
		} catch {
			return fail(400, { error: m.checkpoint_invalid() });
		}
		return { ok: true };
	},
	delete_checkpoint: async ({ request, locals, params }) => {
		requireWrite(locals.user);
		const form = await request.formData();
		try {
			await deleteManualCheckpoint(params.account_id, String(form.get('checkpoint_id') ?? ''));
		} catch {
			return fail(400, { error: m.checkpoint_invalid() });
		}
		return { ok: true };
	},
	update: async ({ request, locals, params }) => {
		requireWrite(locals.user);
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		try {
			await updateAccount(params.account_id, {
				name: name || undefined,
				notes: String(form.get('notes') ?? '').trim() || undefined
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
				amount_cents: amount,
				label: String(form.get('label') ?? '').trim() || 'Manual transaction',
				description: String(form.get('description') ?? '').trim() || undefined,
				category_id: String(form.get('category_id') ?? '').trim() || undefined,
				payment_mode_id: String(form.get('payment_mode_id') ?? '').trim() || undefined,
				notes: String(form.get('notes') ?? '').trim() || undefined,
				excluded: form.get('excluded') === 'on'
			});
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Create failed' });
		}
		return { ok: true };
	}
};
