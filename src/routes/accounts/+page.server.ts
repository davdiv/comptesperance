import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireWrite } from '$lib/server/auth';
import { listAccountsWithTotals } from '$lib/server/queries';
import { createAccount } from '$lib/server/repository';
import type { AccountSource } from '$lib/types';

const SOURCES: AccountSource[] = ['csv', 'manual'];

export const load: PageServerLoad = async () => ({
	accounts: await listAccountsWithTotals(),
	sources: SOURCES
});

export const actions: Actions = {
	default: async ({ request, locals }) => {
		requireWrite(locals.user);
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const source = String(form.get('source') ?? 'manual') as AccountSource;
		if (!name) return fail(400, { error: 'Name is required' });
		if (!SOURCES.includes(source)) return fail(400, { error: 'Invalid account source' });
		const account = await createAccount({
			name,
			source,
			notes: String(form.get('notes') ?? '').trim() || undefined
		});
		redirect(303, `/accounts/${account.id}`);
	}
};
