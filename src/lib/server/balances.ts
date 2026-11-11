import type { BalanceCheckpoint } from '#lib/types.ts';

export interface ReconciledCheckpoint extends BalanceCheckpoint {
	computed_balance_cents: number;
	difference_cents: number;
	is_anchor: boolean;
}
export interface BalanceResult {
	current_balance_cents: number;
	anchor: BalanceCheckpoint | null;
	checkpoints: ReconciledCheckpoint[];
	mismatch_count: number;
}
export interface BalanceTransaction {
	date: string;
	amount_cents: number;
	excluded?: boolean;
}

export function calculateBalance(
	checkpoints: BalanceCheckpoint[],
	transactions: BalanceTransaction[]
): BalanceResult {
	const ordered = [...checkpoints].sort(
		(a, b) =>
			b.date.localeCompare(a.date) ||
			Number(b.source === 'statement') - Number(a.source === 'statement') ||
			a.id.localeCompare(b.id)
	);
	const anchor = ordered[0] ?? null;
	const included = transactions.filter((transaction) => !transaction.excluded);
	const sumBetween = (after: string, through?: string) =>
		included
			.filter(
				(transaction) =>
					transaction.date.slice(0, 10) > after &&
					(!through || transaction.date.slice(0, 10) <= through)
			)
			.reduce((sum, transaction) => sum + transaction.amount_cents, 0);
	const reconciled = ordered.map((checkpoint) => {
		const computed = anchor!.balance_cents - sumBetween(checkpoint.date, anchor!.date);
		return {
			...checkpoint,
			computed_balance_cents: computed,
			difference_cents: checkpoint.balance_cents - computed,
			is_anchor: checkpoint === anchor
		};
	});
	return {
		current_balance_cents: anchor ? anchor.balance_cents + sumBetween(anchor.date) : sumBetween(''),
		anchor,
		checkpoints: reconciled,
		mismatch_count: reconciled.filter((checkpoint) => checkpoint.difference_cents !== 0).length
	};
}
