import { fail } from '@sveltejs/kit';
import { m } from '#lib/paraglide/messages.js';
import { requireWrite } from './auth';
import { listTransferPool } from './queries';
import { createTransferGroups } from './repository';
import { suggestTransferGroups } from './transfer-matcher';
import type { RequestEvent } from '@sveltejs/kit';

export async function linkBalancedSuggestions({
	request,
	locals
}: Pick<RequestEvent, 'request' | 'locals'>) {
	requireWrite(locals.user);
	const form = await request.formData();
	const suggestions = suggestTransferGroups(await listTransferPool());
	const keys = new Set(form.getAll('suggestion_key').map(String));
	const selected = suggestions.filter((item) => keys.has(item.key));
	if (!selected.length || selected.length !== keys.size)
		return fail(400, { error: m.transfer_suggestion_invalid() });
	try {
		await createTransferGroups(
			selected.map((item) =>
				item.members.map((member) => ({ account_id: member.account_id, transaction_id: member.id }))
			)
		);
	} catch {
		return fail(400, { error: m.transfer_suggestion_invalid() });
	}
	return { ok: true };
}
