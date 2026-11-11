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
	const selected =
		form.get('all') === '1'
			? suggestions
			: suggestions.filter((item) => item.key === form.get('suggestion_key'));
	if (!selected.length) return fail(400, { error: m.transfer_suggestion_invalid() });
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
