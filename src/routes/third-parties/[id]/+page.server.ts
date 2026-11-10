import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireWrite } from '$lib/server/auth';
import { listAccountsWithTotals, listThirdPartyTransactions } from '$lib/server/queries';
import { deleteThirdParty, readThirdParty, updateThirdParty } from '$lib/server/repository';

export const load: PageServerLoad = async ({ params, url }) => {
	const includeTransfers = url.searchParams.get('include_transfers') === '1';
	const [party, transactions, accounts] = await Promise.all([
		readThirdParty(params.id),
		listThirdPartyTransactions(params.id, includeTransfers),
		listAccountsWithTotals()
	]);
	if (!party) error(404, 'Third party not found');
	return { party, transactions, accounts, includeTransfers };
};

export const actions: Actions = {
	update: async ({ request, locals, params }) => {
		requireWrite(locals.user);
		const form = await request.formData();
		const aliases = String(form.get('aliases') ?? '')
			.split(/[\n,]/)
			.map((alias) => alias.trim())
			.filter(Boolean);
		try {
			await updateThirdParty(params.id, {
				name: String(form.get('name') ?? '').trim() || undefined,
				aliases
			});
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Update failed' });
		}
		return { ok: true };
	},
	delete: async ({ locals, params }) => {
		requireWrite(locals.user);
		await deleteThirdParty(params.id);
		redirect(303, '/third-parties');
	}
};
