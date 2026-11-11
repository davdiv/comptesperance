export interface TransferTransaction {
	id: string;
	account_id: string;
	date: string;
	amount_cents: number;
	label: string;
	description?: string;
	attributes?: Record<string, string>;
	transfer_id?: string | null;
	excluded?: boolean;
}
export interface TransferMatch<T extends TransferTransaction = TransferTransaction> {
	transaction: T;
	strong: boolean;
	reference: string | null;
	days: number;
	difference_cents: number;
}
function tokens(transaction: TransferTransaction): Set<string> {
	const text = [
		transaction.label,
		transaction.description,
		...Object.values(transaction.attributes ?? {})
	]
		.join(' ')
		.toUpperCase();
	return new Set(
		(text.match(/\b[A-Z][A-Z0-9_-]{5,}\b/g) ?? []).filter((token) => /\d/.test(token))
	);
}
export function rankTransferCandidates<T extends TransferTransaction>(
	transaction: TransferTransaction,
	pool: T[]
): TransferMatch<T>[] {
	if (transaction.transfer_id || transaction.excluded || transaction.amount_cents === 0) return [];
	const references = tokens(transaction);
	return pool
		.flatMap((candidate) => {
			if (
				candidate.account_id === transaction.account_id ||
				candidate.transfer_id ||
				candidate.excluded ||
				candidate.amount_cents === 0 ||
				Math.sign(candidate.amount_cents) === Math.sign(transaction.amount_cents)
			)
				return [];
			const days =
				Math.abs(
					Date.parse(candidate.date.slice(0, 10)) - Date.parse(transaction.date.slice(0, 10))
				) / 86400000;
			if (!Number.isFinite(days) || days > 7) return [];
			const reference = [...tokens(candidate)].find((token) => references.has(token)) ?? null;
			const difference_cents = transaction.amount_cents + candidate.amount_cents;
			if (!reference && difference_cents !== 0) return [];
			return [
				{ transaction: candidate, strong: reference !== null, reference, days, difference_cents }
			];
		})
		.sort(
			(a, b) =>
				Number(b.strong) - Number(a.strong) ||
				a.days - b.days ||
				a.transaction.account_id.localeCompare(b.transaction.account_id) ||
				a.transaction.id.localeCompare(b.transaction.id)
		);
}
export function suggestedTransferPairs<T extends TransferTransaction>(pool: T[]) {
	const seen = new Set<string>();
	return pool
		.flatMap((first) =>
			rankTransferCandidates(first, pool)
				.filter((match) => {
					if (!match.strong) return false;
					const key = JSON.stringify(
						[
							[first.account_id, first.id],
							[match.transaction.account_id, match.transaction.id]
						].sort()
					);
					if (seen.has(key)) return false;
					seen.add(key);
					return true;
				})
				.map((match) => ({ first, ...match }))
		)
		.sort((a, b) => a.days - b.days);
}
