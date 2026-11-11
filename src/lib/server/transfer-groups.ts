import type { TransactionView } from './queries';

export function summarizeTransferGroup(id: string, members: TransactionView[]) {
	const total_cents = members.reduce((sum, item) => sum + item.amount_cents, 0);
	const projects = new Map<string, { project_id: string; name: string; amount_cents: number }>();
	for (const member of members)
		for (const allocation of member.allocations) {
			const entry = projects.get(allocation.project_id) ?? {
				project_id: allocation.project_id,
				name:
					member.allocation_details.find((item) => item.project_id === allocation.project_id)
						?.project_name ?? allocation.project_id,
				amount_cents: 0
			};
			entry.amount_cents += allocation.amount_cents;
			projects.set(entry.project_id, entry);
		}
	const project_totals = [...projects.values()];
	return {
		id,
		members,
		total_cents,
		balanced:
			total_cents === 0 &&
			members.length >= 2 &&
			new Set(members.map((item) => item.account_id)).size >= 2,
		allocations_balanced: project_totals.every((item) => item.amount_cents === 0),
		project_totals
	};
}
export type TransferGroup = ReturnType<typeof summarizeTransferGroup>;
