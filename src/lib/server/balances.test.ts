import { expect, it } from 'vitest';
import type { BalanceCheckpoint } from '#lib/types.ts';
import { calculateBalance } from './balances';

const checkpoint = (
	id: string,
	date: string,
	balance: number,
	source: BalanceCheckpoint['source'] = 'manual'
): BalanceCheckpoint => ({ id, date, balance_cents: balance, source });

it('starts at zero without a checkpoint and ignores excluded transactions', () => {
	expect(calculateBalance([], [])).toMatchObject({
		current_balance_cents: 0,
		anchor: null,
		checkpoints: [],
		mismatch_count: 0
	});
	expect(
		calculateBalance(
			[],
			[
				{ date: '2026-10-01', amount_cents: 1000 },
				{ date: '2026-10-02', amount_cents: -300 },
				{ date: '2026-10-03', amount_cents: 9000, excluded: true }
			]
		).current_balance_cents
	).toBe(700);
});
it('selects the latest checkpoint, then adds only transactions on later days', () => {
	const latest = checkpoint('latest', '2026-10-02', 1000);
	const result = calculateBalance(
		[checkpoint('earlier-statement', '2026-10-01', 500, 'statement'), latest],
		[
			{ date: '2026-09-30', amount_cents: 7000 },
			{ date: '2026-10-02', amount_cents: 300 },
			{ date: '2026-10-02T23:59:59Z', amount_cents: 200 },
			{ date: '2026-10-03T00:00:00Z', amount_cents: -100 },
			{ date: '2026-10-04', amount_cents: 9000, excluded: true }
		]
	);
	expect(result.anchor).toEqual(latest);
	expect(result.current_balance_cents).toBe(900);
	expect(result.mismatch_count).toBe(0);
});
it('prefers a statement on the same date regardless of input order and reconciles the manual count', () => {
	const manual = checkpoint('manual', '2026-10-02', 1100);
	const statement = checkpoint('statement', '2026-10-02', 1000, 'statement');
	for (const entries of [
		[manual, statement],
		[statement, manual]
	]) {
		const result = calculateBalance(entries, [{ date: '2026-10-02T12:00:00Z', amount_cents: 400 }]);
		expect(result.anchor).toEqual(statement);
		expect(result.current_balance_cents).toBe(1000);
		expect(result.checkpoints.find((c) => c.id === 'manual')).toMatchObject({
			computed_balance_cents: 1000,
			difference_cents: 100
		});
	}
});
it('reconciles earlier checkpoints against the anchor, including same-day datetimes and exclusions', () => {
	const result = calculateBalance(
		[
			checkpoint('anchor', '2026-10-03', 1300),
			checkpoint('ok', '2026-10-01', 1000),
			checkpoint('wrong', '2026-10-02', 1250, 'statement')
		],
		[
			{ date: '2026-10-01T23:59:59Z', amount_cents: 8000 },
			{ date: '2026-10-02', amount_cents: 400 },
			{ date: '2026-10-03T23:59:59Z', amount_cents: -100 },
			{ date: '2026-10-03', amount_cents: 9000, excluded: true },
			{ date: '2026-10-04', amount_cents: 600 }
		]
	);
	expect(result.current_balance_cents).toBe(1900);
	expect(result.checkpoints.find((c) => c.id === 'ok')).toMatchObject({
		computed_balance_cents: 1000,
		difference_cents: 0
	});
	expect(result.checkpoints.find((c) => c.id === 'wrong')).toMatchObject({
		computed_balance_cents: 1400,
		difference_cents: -150
	});
	expect(result.mismatch_count).toBe(1);
});
it('selects same-source same-day anchors deterministically without dropping duplicates', () => {
	const a = checkpoint('a', '2026-10-02', 1000, 'statement');
	const b = checkpoint('b', '2026-10-02', 1200, 'statement');
	for (const entries of [
		[b, a],
		[a, b]
	]) {
		const result = calculateBalance(entries, []);
		expect(result.anchor?.id).toBe('a');
		expect(result.checkpoints).toHaveLength(2);
		expect(result.mismatch_count).toBe(1);
	}
});
