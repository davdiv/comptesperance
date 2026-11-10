import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { detectCsvFormat, parseCsvStatement } from './index';

const ccpSample = readFileSync(new URL('./testdata/ccp-sample.csv', import.meta.url), 'utf8');
const sumupSample = readFileSync(new URL('./testdata/sumup-sample.csv', import.meta.url), 'utf8');

describe('csv parsing', () => {
	it('detects and parses the CCP sample', () => {
		expect(detectCsvFormat(ccpSample)).toBe('ccp');
		const result = parseCsvStatement(ccpSample, 'ccp');
		expect(result.errors).toEqual([]);
		expect(result.transactions.length).toBeGreaterThan(0);
		expect(new Set(result.transactions.map((transaction) => transaction.id)).size).toBe(
			result.transactions.length
		);
		for (const transaction of result.transactions) {
			expect(Number.isInteger(transaction.amount_cents)).toBe(true);
		}
	});

	it('detects and parses the SumUp sample', () => {
		expect(detectCsvFormat(sumupSample)).toBe('sumup');
		const result = parseCsvStatement(sumupSample, 'sumup');
		expect(result.errors).toEqual([]);
		expect(result.transactions.length).toBeGreaterThan(0);
		expect(new Set(result.transactions.map((transaction) => transaction.id)).size).toBe(
			result.transactions.length
		);
		for (const transaction of result.transactions) {
			expect(Number.isInteger(transaction.amount_cents)).toBe(true);
		}
	});
});
