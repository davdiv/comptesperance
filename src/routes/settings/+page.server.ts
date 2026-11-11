import { fail } from '@sveltejs/kit';
import { m } from '#lib/paraglide/messages.js';
import { requireWrite } from '#lib/server/auth.ts';
import { mutateConfig, saveAppName } from '#lib/server/config.ts';
import type { Actions } from './$types';

export const actions: Actions = {
	app: async ({ request, locals }) => {
		requireWrite(locals.user);
		const form = await request.formData();
		try {
			await saveAppName(String(form.get('name') ?? ''));
		} catch {
			return fail(400, { error: m.config_invalid() });
		}
		return { ok: true };
	},
	save: async ({ request, locals }) => {
		requireWrite(locals.user);
		const form = await request.formData();
		const collection = String(form.get('collection'));
		if (collection !== 'categories' && collection !== 'paymentModes')
			return fail(400, { error: m.config_invalid() });
		try {
			await mutateConfig(collection, {
				id: String(form.get('id') ?? '') || undefined,
				name: String(form.get('name') ?? ''),
				kind: String(form.get('kind') ?? ''),
				archived: form.get('archived') === 'on',
				remove: form.get('intent') === 'delete'
			});
		} catch (e) {
			return fail(400, {
				error:
					e instanceof Error && e.message === 'config_in_use'
						? m.config_in_use()
						: m.config_invalid()
			});
		}
		return { ok: true };
	}
};
