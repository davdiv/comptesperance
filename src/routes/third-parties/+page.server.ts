import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireWrite } from '#lib/server/auth.ts';
import { listThirdPartiesWithCounts } from '#lib/server/queries.ts';
import { createThirdParty } from '#lib/server/repository.ts';

export const load: PageServerLoad = async () => ({
	thirdParties: await listThirdPartiesWithCounts()
});

export const actions: Actions = {
	default: async ({ request, locals }) => {
		requireWrite(locals.user);
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'Name is required' });
		const aliases = [
			...new Set(
				String(form.get('aliases') ?? '')
					.split(/[\n,]/)
					.map((alias) => alias.trim())
					.filter(Boolean)
			)
		];
		const party = await createThirdParty({ name, aliases });
		redirect(303, `/third-parties/${party.id}`);
	}
};
