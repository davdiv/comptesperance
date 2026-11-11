import { fail } from '@sveltejs/kit';
import { m } from '$lib/paraglide/messages.js';
import { requireWrite } from '$lib/server/auth';
import { linkTransfer } from '$lib/server/repository';
import { rankTransferCandidates, suggestedTransferPairs } from '$lib/server/transfer-matcher';
import { getTransaction, listTransferPool } from '$lib/server/queries';
import type { Actions, PageServerLoad } from './$types';
import {
	listAccountsWithTotals,
	listThirdPartiesWithCounts,
	listTransactions,
	listProjectsWithTotals
} from '$lib/server/queries';

export const load: PageServerLoad = async ({ url, locals }) => {
	const includeTransfers = url.searchParams.get('include_transfers') === '1';
	const filters = {
		account_id: url.searchParams.get('account_id') || undefined,
		third_party_id: url.searchParams.get('third_party_id') || undefined,
		search: url.searchParams.get('search') || undefined,
		date_from: url.searchParams.get('date_from') || undefined,
		date_to: url.searchParams.get('date_to') || undefined,
		category_id: url.searchParams.get('category_id') || undefined,
		payment_mode_id: url.searchParams.get('payment_mode_id') || undefined,
		project_id: url.searchParams.get('project_id') || undefined,
		allocation_status: url.searchParams.get('allocation_status') || undefined,
		include_transfers: includeTransfers,
		limit: 500
	};
	const [transactions, accounts, thirdParties, projects] = await Promise.all([
		listTransactions(filters),
		listAccountsWithTotals(),
		listThirdPartiesWithCounts(),
		listProjectsWithTotals()
	]);
	return {
		...transactions,
		accounts,
		thirdParties,
		projects,
		filters,
		includeTransfers,
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
