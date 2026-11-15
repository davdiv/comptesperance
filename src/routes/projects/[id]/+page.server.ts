import { transactionFilterState } from '#lib/server/transaction-list.ts';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireWrite } from '#lib/server/auth.ts';
import { getProjectDetails } from '#lib/server/queries.ts';
import { deleteProject, updateProject } from '#lib/server/repository.ts';

export const load: PageServerLoad = async ({ params, url }) => {
	const state = await transactionFilterState(url, { project_id: params.id });
	const details = await getProjectDetails(params.id, state.filters);
	if (!details) error(404, 'Project not found');
	return {
		...state,
		...details,
		transactions: details.allocations.flatMap((a) => (a.transaction ? [a.transaction] : []))
	};
};

export const actions: Actions = {
	update: async ({ request, locals, params }) => {
		requireWrite(locals.user);
		const form = await request.formData();
		try {
			await updateProject(params.id, {
				name: String(form.get('name') ?? '').trim() || undefined,
				description: String(form.get('description') ?? '').trim() || undefined
			});
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Update failed' });
		}
		return { ok: true };
	},
	delete: async ({ locals, params }) => {
		requireWrite(locals.user);
		await deleteProject(params.id);
		redirect(303, '/projects');
	}
};
