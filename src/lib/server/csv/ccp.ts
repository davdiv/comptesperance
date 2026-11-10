import { parse } from 'csv-parse/sync';
import type { ParsedTransaction } from '$lib/types';
import { fingerprint } from './fingerprint';
import { decodeHtmlEntities, parseAmountToCents, parseFrenchDate, text } from './values';
import type { ParsedStatement } from './types';

export interface CcpAccountMeta {
	account_label: string;
	account_number: string;
	statement_date: string | null;
	closing_balance_cents: number | null;
}

export interface CcpParseResult extends ParsedStatement {
	account: CcpAccountMeta | null;
}

const ATTRIBUTE_KEYS = [
	'FRM',
	'BEN',
	'RNF',
	'EID',
	'REF',
	'REFDO',
	'MOTIF',
	'MMO',
	'BIC',
	'EXCH',
	'VERS',
	'UDN'
];

/**
 * Parses a CCP bank statement: semicolon-delimited, first line is an account
 * header, remaining lines are 6-field transactions.
 */
export function parseCcpReport(input: string): CcpParseResult {
	const records = parse(input, {
		delimiter: ';',
		quote: '"',
		bom: true,
		skip_empty_lines: true,
		relax_column_count: true
	}) as string[][];

	const errors: string[] = [];
	let account: CcpAccountMeta | null = null;
	const transactions: ParsedTransaction[] = [];
	const seen = new Map<string, number>();

	if (records.length === 0) {
		return { account, transactions, errors: ['File is empty.'] };
	}

	records.forEach((record, index) => {
		if (index === 0) {
			if (record.length < 6) {
				errors.push(`Account header (line 1): expected 6 fields, got ${record.length}.`);
				return;
			}
			const [label1, label2, number, date, , balance] = record;
			account = {
				account_label: decodeHtmlEntities(text(label1), 4) || decodeHtmlEntities(text(label2), 4),
				account_number: text(number),
				statement_date: parseFrenchDate(text(date)),
				closing_balance_cents: parseAmountToCents(text(balance), ',')
			};
			return;
		}

		if (record.length !== 6) {
			errors.push(`Transaction (line ${index + 1}): expected 6 fields, got ${record.length}.`);
			return;
		}

		const raw = record.map((cell) => text(cell));
		const [bookingDate, operationLabel, , description, valueDate, amount] = raw;
		const booking = parseFrenchDate(bookingDate);
		const value = parseFrenchDate(valueDate);
		const amountCents = parseAmountToCents(amount, ',');
		const date = booking ?? value;

		if (amountCents === null) {
			errors.push(`Transaction (line ${index + 1}): unparseable amount.`);
			return;
		}
		if (!date) {
			errors.push(`Transaction (line ${index + 1}): unparseable date.`);
			return;
		}

		const baseId = fingerprint(raw);
		const occurrence = (seen.get(baseId) ?? 0) + 1;
		seen.set(baseId, occurrence);
		const id = occurrence === 1 ? baseId : `${baseId}-${occurrence}`;

		transactions.push({
			id,
			raw,
			date,
			value_date: value ?? undefined,
			amount_cents: amountCents,
			currency: 'EUR',
			label: operationLabel,
			description,
			record_type: 'bank',
			attributes: parseSlashAttributes(description),
			counts_in_total: true
		});
	});

	return { account, transactions, errors };
}

/** Whether the contents look like a CCP statement. */
export function detectCcp(input: string): boolean {
	const line = (input.split(/\r?\n/, 1)[0] ?? '').trim();
	if (!line.includes(';')) return false;
	return !line.includes('Type de transaction') && !line.includes('Réf. transaction');
}

function parseSlashAttributes(description: string): Record<string, string> {
	const attributes: Record<string, string> = {};
	for (const key of ATTRIBUTE_KEYS) {
		const pattern = new RegExp(`/${key}\\s+([^/]*?)(?=\\s+/${ATTRIBUTE_KEYS.join('|')}\\s|$)`, 'g');
		for (const match of description.matchAll(pattern)) {
			const value = text(match[1]);
			if (value) attributes[key] = value;
		}
	}
	return attributes;
}
