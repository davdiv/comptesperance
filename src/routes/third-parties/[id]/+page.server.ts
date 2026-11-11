import { transactionFilterState, thirdPartyPerspective } from '#lib/server/transaction-list.ts';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireWrite } from '#lib/server/auth.ts';
import { listTransactions } from '#lib/server/queries.ts';
import { deleteThirdParty, readThirdParty, updateThirdParty } from '#lib/server/repository.ts';

export const load: PageServerLoad = async ({ params, url }) => {
	const state = await transactionFilterState(url, { third_party_id: params.id });
	const [party, result] = await Promise.all([
		readThirdParty(params.id),
		listTransactions(state.filters)
	]);
	if (!party) error(404, 'Third party not found');
	return {
		...state,
		...thirdPartyPerspective(result),
		party,
		accounts: state.filterOptions.accounts
	};
};

export const actions: Actions = {
	update: async ({ request, locals, params }) => {
		requireWrite(locals.user);
		const form = await request.formData();
		const aliases = [
			...new Set(
				String(form.get('aliases') ?? '')
					.split(/[\n,]/)
					.map((alias) => alias.trim())
					.filter(Boolean)
			)
		];
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
