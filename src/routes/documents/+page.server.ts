import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireWrite } from '$lib/server/auth';
import { getEnv } from '$lib/server/env';
import { listDocuments } from '$lib/server/repository';
import { deleteDocument, saveDocument } from '$lib/server/repository';

export const load: PageServerLoad = async () => ({ documents: await listDocuments() });

export const actions: Actions = {
	upload: async ({ request, locals }) => {
		requireWrite(locals.user);
		const form = await request.formData();
		const file = form.get('file');
		if (!file || typeof file === 'string') return fail(400, { error: 'Select a file' });
		if (file.size > getEnv().maxEvidenceBytes) return fail(400, { error: 'File is too large' });
		await saveDocument(file.name, new Uint8Array(await file.arrayBuffer()));
		return { ok: true };
	},
	delete: async ({ request, locals }) => {
		requireWrite(locals.user);
		const form = await request.formData();
		await deleteDocument(String(form.get('path') ?? ''));
		return { ok: true };
	}
};
