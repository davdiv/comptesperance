import { parse } from 'csv-parse/sync';
import type { ParsedStatement } from './types';
import type { ParsedTransaction } from '$lib/types';
import { fingerprint } from './fingerprint';
import { parseAmountToCents, parseIsoDate, text } from './values';

/** Maps canonical English field names onto SumUp French CSV headers. */
const HEADER_NAMES = {
	email: 'Email',
	date: 'Date',
	transaction_ref: 'Réf. transaction',
	transaction_type: 'Type de transaction',
	status: 'Status',
	card_type: 'Type de carte',
	card_last4: '4 derniers chiffres',
	treat_as: 'Traiter en tant que',
	payment_method: 'Méthode de paiement',
	entry_mode: 'Mode de saisie',
	auth_code: "Code d'authentification",
	description: 'Description',
	total_amount_cents: 'Montant total',
	net_price_cents: 'Prix net',
	tax_cents: 'Montant des taxes',
	tip_cents: 'Montant du pourboire',
	fee_cents: 'Frais',
	payout_cents: 'Virement',
	payout_date: 'Date du virement',
	payout_id: 'ID du versement',
	reference: 'Référence'
} as const satisfies Record<string, string>;

type Field = keyof typeof HEADER_NAMES;
const FIELDS = Object.keys(HEADER_NAMES) as Field[];
const RAW_FIELDS: Field[] = FIELDS;

/** Parses a SumUp POS report. Every data row is kept as a transaction. */
export function parseSumupReport(input: string): ParsedStatement {
	const errors: string[] = [];
	const raw = parse(input, {
		delimiter: ',',
		bom: true,
		skip_empty_lines: true,
		relax_quotes: true,
		relax_column_count: true
	}) as string[][];

	if (raw.length === 0) {
		return { transactions: [], errors: ['File is empty.'] };
	}

	const header = raw[0].map((name) => text(name).replaceAll(' ', ' '));
	const indices = {} as Record<Field, number>;
	const missing: string[] = [];
	for (const field of FIELDS) {
		const index = header.indexOf(HEADER_NAMES[field]);
		if (index === -1) missing.push(HEADER_NAMES[field]);
		else indices[field] = index;
	}
	if (missing.length > 0) {
		return { transactions: [], errors: [`Missing expected column(s): ${missing.join(', ')}.`] };
	}

	const cell = (record: string[], field: Field): string => text(record[indices[field]]);
	const transactions: ParsedTransaction[] = [];

	for (const [offset, record] of raw.slice(1).entries()) {
		const rawFields = RAW_FIELDS.map((field) => cell(record, field));
		const value = (field: Field): string => rawFields[RAW_FIELDS.indexOf(field)];
		const line = offset + 2;
		const date = parseIsoDate(value('date')) ?? parseIsoDate(value('payout_date'));
		if (!date) {
			errors.push(`Transaction (line ${line}): unparseable date.`);
			continue;
		}

		const recordType = normalizeRecordType(value('transaction_type'));
		const status = value('status') || undefined;
		const amount = sumupAmountCents(value, recordType);
		const attributes = buildAttributes(value);

		transactions.push({
			id: fingerprint(rawFields),
			raw: rawFields,
			date,
			value_date: parseIsoDate(value('payout_date')) ?? undefined,
			amount_cents: amount,
			label: [value('transaction_type'), value('transaction_ref')].filter(Boolean).join(' · '),
			description: value('description') || value('reference') || undefined,
			record_type: recordType,
			status,
			attributes,
			excluded: status === 'Annulé'
		});
	}

	return { transactions, errors };
}

/** Whether the contents look like a SumUp report. */
export function detectSumup(input: string): boolean {
	const line = (input.split(/\r?\n/, 1)[0] ?? '').trim();
	return (
		line.includes(',') && line.includes('Type de transaction') && line.includes('Réf. transaction')
	);
}

function normalizeRecordType(value: string): string {
	const normalized = value.trim().toLowerCase();
	if (normalized === 'vente') return 'vente';
	if (normalized === 'virement') return 'virement';
	return normalized || 'unknown';
}

function sumupAmountCents(value: (field: Field) => string, recordType: string): number {
	const payout = parseAmountToCents(value('payout_cents'), '.');
	if (recordType === 'virement') return payout === null ? 0 : -payout;
	if (payout !== null) return payout;
	const total = parseAmountToCents(value('total_amount_cents'), '.');
	const fee = parseAmountToCents(value('fee_cents'), '.') ?? 0;
	if (total === null) return 0;
	return total - fee;
}

function buildAttributes(value: (field: Field) => string): Record<string, string> {
	const fields: Field[] = [
		'email',
		'transaction_ref',
		'transaction_type',
		'status',
		'card_type',
		'card_last4',
		'treat_as',
		'payment_method',
		'entry_mode',
		'payout_date',
		'payout_id',
		'reference'
	];
	const attributes: Record<string, string> = {};
	for (const field of fields) {
		const fieldValue = value(field);
		if (fieldValue) attributes[field] = fieldValue;
	}
	return attributes;
}
