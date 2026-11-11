import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireWrite } from '$lib/server/auth';
import { readUploadFiles } from '$lib/server/uploads';
import { listDocumentsWithLinks } from '$lib/server/queries';
import { deleteDocument, saveDocuments } from '$lib/server/repository';

export const load: PageServerLoad = async () => ({ documents: await listDocumentsWithLinks() });

export const actions: Actions = {
	upload: async ({ request, locals }) => {
		requireWrite(locals.user);
		const result = await readUploadFiles(request);
		if ('error' in result) return fail(result.status, { error: result.error });
		const uploads = result.files;
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
