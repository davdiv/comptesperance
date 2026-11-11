import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parseCsvStatement } from './csv';
import {
	rankTransferCandidates,
	suggestedTransferPairs,
	type TransferTransaction
} from './transfer-matcher';
const first: TransferTransaction = {
	id: 'first',
	account_id: 'cash',
	date: '2026-10-02',
	amount_cents: -1000,
	label: 'Outgoing PID9000007'
};
const candidate = (patch: Partial<TransferTransaction> = {}): TransferTransaction => ({
	id: 'other',
	account_id: 'bank',
	date: '2026-10-02',
	amount_cents: 1000,
	label: 'Incoming',
	...patch
});
it('matches the real SumUp payout reference to CCP even when the amounts differ', () => {
	const sample = (name: string) =>
		readFileSync(new URL('./csv/testdata/' + name + '-sample.csv', import.meta.url), 'utf8');
	const sumup = parseCsvStatement(sample('sumup'), 'sumup').transactions.find(
		(t) => t.record_type === 'virement' && t.label.includes('TZZZ90001')
	)!;
	const ccp = parseCsvStatement(sample('ccp'), 'ccp').transactions.find((t) =>
		t.description?.includes('PID9000007')
	)!;
	expect(sumup).toBeDefined();
	expect(ccp).toBeDefined();
	const a = { ...sumup, account_id: 'sumup' },
		b = { ...ccp, account_id: 'ccp' };
	const matches = rankTransferCandidates(a, [b]);
	expect(matches[0]).toMatchObject({
		strong: true,
		reference: 'PID9000007',
		difference_cents: 3534
	});
	expect(suggestedTransferPairs([a, b])).toHaveLength(1);
});
it('ranks reference matches first, then calendar-day proximity', () => {
	const matches = rankTransferCandidates(first, [
		candidate({ id: 'far', date: '2026-10-09' }),
		candidate({ id: 'near' }),
		candidate({ id: 'reference', date: '2026-10-05', label: 'PID9000007', amount_cents: 1200 })
	]);
	expect(matches.map((m) => m.transaction.id)).toEqual(['reference', 'near', 'far']);
	expect(matches[0].difference_cents).toBe(200);
});
it('filters ineligible candidates and accepts the seven-day boundary', () => {
	const pool = [
		candidate({ id: 'same-account', account_id: 'cash' }),
		candidate({ id: 'linked', transfer_id: 'transfer' }),
		candidate({ id: 'excluded', excluded: true }),
		candidate({ id: 'same-sign', amount_cents: -1000 }),
		candidate({ id: 'zero', amount_cents: 0 }),
		candidate({ id: 'too-far', date: '2026-10-10', label: 'PID9000007' }),
		candidate({ id: 'invalid', date: 'invalid' }),
		candidate({ id: 'unequal', amount_cents: 1200 }),
		candidate({ id: 'boundary', date: '2026-09-25T23:59:59' })
	];
	expect(rankTransferCandidates(first, pool).map((m) => m.transaction.id)).toEqual(['boundary']);
	expect(rankTransferCandidates({ ...first, transfer_id: 'linked' }, pool)).toEqual([]);
	expect(rankTransferCandidates({ ...first, excluded: true }, pool)).toEqual([]);
	expect(rankTransferCandidates(first, [])).toEqual([]);
	expect(suggestedTransferPairs([first, candidate()])).toEqual([]);
});
