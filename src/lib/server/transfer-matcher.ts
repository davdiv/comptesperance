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
	record_type?: string | null;
}
export interface TransferMatch<T extends TransferTransaction = TransferTransaction> {
	transaction: T;
	strong: boolean;
	reference: string | null;
	days: number;
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
				candidate.amount_cents !== -transaction.amount_cents
			)
				return [];
			const days =
				Math.abs(
					Date.parse(candidate.date.slice(0, 10)) - Date.parse(transaction.date.slice(0, 10))
				) / 86400000;
			if (!Number.isFinite(days) || days > 7) return [];
			const reference = [...tokens(candidate)].find((token) => references.has(token)) ?? null;
			return [{ transaction: candidate, strong: reference !== null, reference, days }];
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

export function suggestTransferGroups<T extends TransferTransaction>(pool: T[]) {
	const available = pool.filter(
		(item) => !item.transfer_id && !item.excluded && item.amount_cents !== 0
	);
	const proposals: { key: string; reference: string | null; members: T[] }[] = [];
	const key = (members: T[]) =>
		JSON.stringify(members.map((item) => [item.account_id, item.id]).sort());
	const payouts = new Map<string, T[]>();
	for (const item of available) {
		if (item.record_type !== 'virement' || item.amount_cents >= 0) continue;
		const id = item.attributes?.payout_id?.toUpperCase().match(/\bPID\d+\b/)?.[0];
		if (!id) continue;
		const members = payouts.get(id) ?? [];
		members.push(item);
		payouts.set(id, members);
	}
	for (const [reference, outgoing] of payouts) {
		for (const credit of available.filter(
			(item) => item.record_type === 'bank' && item.amount_cents > 0 && tokens(item).has(reference)
		)) {
			const members = [...outgoing, credit];
			if (
				new Set(members.map((item) => item.account_id)).size >= 2 &&
				members.reduce((sum, item) => sum + item.amount_cents, 0) === 0
			)
				proposals.push({ key: key(members), reference, members });
		}
	}
	const pairs = available
		.flatMap((first) =>
			rankTransferCandidates(first, available).map((match) => ({ first, ...match }))
		)
		.sort((a, b) => Number(b.strong) - Number(a.strong) || a.days - b.days);
	for (const pair of pairs) {
		const members = [pair.first, pair.transaction];
		proposals.push({ key: key(members), reference: pair.reference, members });
	}
	const used = new Set<string>();
	return proposals.filter((proposal) => {
		const keys = proposal.members.map((item) => JSON.stringify([item.account_id, item.id]));
		if (keys.some((item) => used.has(item))) return false;
		for (const item of keys) used.add(item);
		return true;
	});
}
