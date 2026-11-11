import { fail } from '@sveltejs/kit';
import { m } from '$lib/paraglide/messages.js';
import { requireWrite } from '$lib/server/auth';
import { listAccountsWithTotals, listTransferGroups, listTransferPool } from '$lib/server/queries';
import { createTransferGroup, unlinkTransfer } from '$lib/server/repository';
import { suggestTransferGroups } from '$lib/server/transfer-matcher';
import { linkBalancedSuggestions } from '$lib/server/transfer-suggestions';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [groups, pool, accounts] = await Promise.all([
		listTransferGroups(),
		listTransferPool(),
		listAccountsWithTotals()
	]);
	return { groups, pool, accounts, suggestions: suggestTransferGroups(pool) };
};
export const actions: Actions = {
	unlink_transfer: async ({ request, locals }) => {
		requireWrite(locals.user);
		const value = String((await request.formData()).get('member') ?? '');
		const index = value.indexOf(':');
		const ref = { account_id: value.slice(0, index), transaction_id: value.slice(index + 1) };
		const groups = await listTransferGroups();
		if (
			index <= 0 ||
			!groups.some((group) =>
				group.members.some(
					(member) => member.account_id === ref.account_id && member.id === ref.transaction_id
				)
			)
		)
			return fail(400, { error: m.transfer_invalid() });
		await unlinkTransfer(ref);
		return { ok: true };
	},
	link_suggestion: linkBalancedSuggestions,
	create: async ({ request, locals }) => {
		requireWrite(locals.user);
		const form = await request.formData();
		const pool = await listTransferPool();
		const selected = new Set(form.getAll('members').map(String));
		const members = pool.filter((item) => selected.has(JSON.stringify([item.account_id, item.id])));
		if (members.length !== selected.size) return fail(400, { error: m.transfer_invalid() });
		try {
			await createTransferGroup(
				members.map((item) => ({ account_id: item.account_id, transaction_id: item.id }))
			);
		} catch {
			return fail(400, { error: m.transfer_invalid() });
		}
		return { ok: true };
	}
};
