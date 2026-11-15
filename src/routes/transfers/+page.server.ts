import { fail } from '@sveltejs/kit';
import { m } from '#lib/paraglide/messages.js';
import { requireWrite } from '#lib/server/auth.ts';
import {
	listAccountsWithTotals,
	listTransferGroups,
	listTransferPool
} from '#lib/server/queries.ts';
import { createTransferGroup, unlinkTransfer } from '#lib/server/repository.ts';
import { suggestTransferGroups } from '#lib/server/transfer-matcher.ts';
import { linkBalancedSuggestions } from '#lib/server/transfer-suggestions.ts';
import {
	matchingTransferGroup,
	matchingTransferMembers,
	transferFilters
} from '#lib/server/transfer-list.ts';
import { paginate } from '#lib/pagination.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
	const [groups, pool, accounts] = await Promise.all([
		listTransferGroups(),
		listTransferPool(),
		listAccountsWithTotals()
	]);
	const filters = transferFilters(url);
	const poolFilters = transferFilters(url, 'pool_');
	const accountNames = Object.fromEntries(accounts.map((item) => [item.account_id, item.name]));
	const matches = (members: typeof pool) => matchingTransferMembers(members, filters, accountNames);
	const filteredGroups = groups
		.filter((group) => matches(group.members) && matchingTransferGroup(group, filters))
		.sort((a, b) => {
			const latest = (group: typeof a) =>
				group.members.reduce((date, item) => (item.date > date ? item.date : date), '');
			return latest(b).localeCompare(latest(a)) || a.id.localeCompare(b.id);
		});
	const suggestions = suggestTransferGroups(pool).filter((item) => matches(item.members));
	const tab = url.searchParams.get('tab') === 'suggestions' ? 'suggestions' : 'groups';
	return {
		accounts,
		filters,
		poolFilters,
		tab,
		filterUrl: url.pathname + url.search,
		groups: tab === 'groups' ? paginate(filteredGroups, filters).rows : [],
		suggestions: tab === 'suggestions' ? paginate(suggestions, filters).rows : [],
		groupCount: filteredGroups.length,
		suggestionCount: suggestions.length,
		pool: locals.user?.canWrite
			? paginate(
					pool.filter((item) => matchingTransferMembers([item], poolFilters, accountNames)),
					poolFilters
				)
			: { rows: [], total: 0 }
	};
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
