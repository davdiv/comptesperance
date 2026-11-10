import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireWrite } from '$lib/server/auth';
import { getProjectDetails } from '$lib/server/queries';
import { deleteProject, readProject, updateProject } from '$lib/server/repository';
import type { ProjectAllocation } from '$lib/types';

export const load: PageServerLoad = async ({ params, url }) => {
	const includeTransfers = url.searchParams.get('include_transfers') === '1';
	const details = await getProjectDetails(params.id, includeTransfers);
	if (!details) error(404, 'Project not found');
	return { ...details, includeTransfers };
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
	},
	remove_allocation: async ({ request, locals, params }) => {
		requireWrite(locals.user);
		const project = await readProject(params.id);
		if (!project) error(404, 'Project not found');
		const form = await request.formData();
		const accountId = String(form.get('account_id') ?? '');
		const transactionId = String(form.get('transaction_id') ?? '');
		const allocations: ProjectAllocation[] = project.allocations.filter(
			(allocation) =>
				!(allocation.account_id === accountId && allocation.transaction_id === transactionId)
		);
		await updateProject(params.id, { allocations });
		return { ok: true };
	}
};
