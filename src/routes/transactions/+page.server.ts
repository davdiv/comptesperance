import { transactionFilterState } from '$lib/server/transaction-list';
import { fail } from '@sveltejs/kit';
import { m } from '$lib/paraglide/messages.js';
import { requireWrite } from '$lib/server/auth';
import { linkTransfer } from '$lib/server/repository';
import { rankTransferCandidates, suggestedTransferPairs } from '$lib/server/transfer-matcher';
import { getTransaction, listTransferPool } from '$lib/server/queries';
import type { Actions, PageServerLoad } from './$types';
import { listTransactions } from '$lib/server/queries';

export const load: PageServerLoad = async ({ url, locals }) => {
	const state = await transactionFilterState(url);
	const transactions = await listTransactions(state.filters);
	return {
		...transactions,
		...state,
		accounts: state.filterOptions.accounts,
		thirdParties: state.filterOptions.thirdParties,
		projects: state.filterOptions.projects,
		suggestions: locals.user?.canWrite
			? suggestedTransferPairs(await listTransferPool()).slice(0, 20)
			: []
	};
};

export const actions: Actions = {
	link_suggestion: async ({ request, locals }) => {
		requireWrite(locals.user);
		const form = await request.formData();
		const value = String(form.get('counterpart') ?? '');
		const index = value.indexOf(':');
		const [first, second] = await Promise.all([
			getTransaction(
				String(form.get('first_account') ?? ''),
				String(form.get('first_transaction') ?? '')
			),
			getTransaction(value.slice(0, index), value.slice(index + 1))
		]);
		if (!first || !second || !rankTransferCandidates(first, [second]).some((match) => match.strong))
			return fail(400, { error: m.transfer_suggestion_invalid() });
		await linkTransfer(
			{ account_id: first.account_id, transaction_id: first.id },
			{ account_id: second.account_id, transaction_id: second.id }
		);
		return { ok: true };
	}
};
