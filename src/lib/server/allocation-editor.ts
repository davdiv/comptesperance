import { fail } from '@sveltejs/kit';
import { m } from '#lib/paraglide/messages.js';
import { parseDecimalToCents } from './money';
import { getTransaction } from './queries';
import { setTransactionAllocations } from './repository';
export async function editAllocation(
	accountId: string,
	transactionId: string,
	projectId: string,
	form: FormData
) {
	const transaction = await getTransaction(accountId, transactionId);
	if (!transaction || !transaction.allocations.some((item) => item.project_id === projectId))
		return fail(400, { error: m.allocation_invalid() });
	const removing = form.get('operation') === 'remove';
	const amount = parseDecimalToCents(String(form.get('amount') ?? ''));
	if (!removing && amount === null) return fail(400, { error: m.allocation_invalid() });
	const allocations = transaction.allocations.flatMap((item) =>
		item.project_id !== projectId
			? [item]
			: removing
				? []
				: [
						{
							...item,
							amount_cents: amount!,
							note: String(form.get('note') ?? '').trim() || undefined
						}
					]
	);
	try {
		await setTransactionAllocations(
			{ account_id: accountId, transaction_id: transactionId },
			allocations
		);
	} catch {
		return fail(400, { error: m.allocation_invalid() });
	}
	return { ok: true };
}
