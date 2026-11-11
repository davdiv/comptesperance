import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireWrite } from '#lib/server/auth.ts';
import { listProjectsWithTotals } from '#lib/server/queries.ts';
import { createProject } from '#lib/server/repository.ts';

export const load: PageServerLoad = async () => ({ projects: await listProjectsWithTotals() });

export const actions: Actions = {
	default: async ({ request, locals }) => {
		requireWrite(locals.user);
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'Name is required' });
		const project = await createProject({
			name,
			description: String(form.get('description') ?? '').trim() || undefined
		});
		redirect(303, `/projects/${project.id}`);
	}
};
