import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireWrite } from '$lib/server/auth';
import { getEnv } from '$lib/server/env';
import { listDocumentsWithLinks } from '$lib/server/queries';
import { deleteDocument, saveDocuments } from '$lib/server/repository';

export const load: PageServerLoad = async () => ({ documents: await listDocumentsWithLinks() });

export const actions: Actions = {
	upload: async ({ request, locals }) => {
		requireWrite(locals.user);
		const form = await request.formData();
		const files = form.getAll('file');
		if (!files.length || files.some((file) => typeof file === 'string' || !file.name))
			return fail(400, { error: 'Select at least one file' });
		const uploads = files as File[];
		if (uploads.some((file) => file.size > getEnv().maxEvidenceBytes))
			return fail(400, { error: 'File is too large' });
		try {
			await saveDocuments(
				await Promise.all(
					uploads.map(async (file) => ({
						name: file.name,
						data: new Uint8Array(await file.arrayBuffer())
					}))
				)
			);
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Upload failed' });
		}
		return { ok: true };
	},
	delete: async ({ request, locals }) => {
		requireWrite(locals.user);
		const form = await request.formData();
		try {
			await deleteDocument(String(form.get('path') ?? ''));
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Delete failed' });
		}
		return { ok: true };
	}
};
