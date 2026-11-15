import type { TransactionView } from './queries';

export function summarizeTransferGroup(id: string, members: TransactionView[]) {
	const amounts = (values: number[]) => {
		const incoming_cents = values.reduce((sum, value) => sum + Math.max(0, value), 0);
		const outgoing_cents = values.reduce((sum, value) => sum + Math.min(0, value), 0);
		return {
			incoming_cents,
			outgoing_cents,
			moved_cents: Math.max(0, Math.min(incoming_cents, -outgoing_cents)),
			amount_cents: incoming_cents + outgoing_cents
		};
	};
	const totals = amounts(members.map((item) => item.amount_cents));
	const total_cents = totals.amount_cents;
	const projects = new Map<string, { project_id: string; name: string; values: number[] }>();
	for (const member of members)
		for (const allocation of member.allocations) {
			const entry = projects.get(allocation.project_id) ?? {
				project_id: allocation.project_id,
				name:
					member.allocation_details.find((item) => item.project_id === allocation.project_id)
						?.project_name ?? allocation.project_id,
				values: []
			};
			entry.values.push(allocation.amount_cents);
			projects.set(entry.project_id, entry);
		}
	const project_totals = [...projects.values()].map(({ values, ...project }) => ({
		...project,
		...amounts(values)
	}));
	return {
		id,
		members,
		total_cents,
		incoming_cents: totals.incoming_cents,
		outgoing_cents: totals.outgoing_cents,
		moved_cents: totals.moved_cents,
		balanced:
			total_cents === 0 &&
			members.length >= 2 &&
			new Set(members.map((item) => item.account_id)).size >= 2,
		allocations_balanced: project_totals.every((item) => item.amount_cents === 0),
		project_totals
	};
}
export type TransferGroup = ReturnType<typeof summarizeTransferGroup>;
