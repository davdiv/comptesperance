import type { ParsedTransaction, PaymentMode } from '#lib/types.ts';
const rules: [RegExp, string][] = [
	[/^(VIREMENT|VIR)\b/, 'virement'],
	[/^(VERSEMENT ESPECES|RETRAIT)\b/, 'especes'],
	[/^(CHEQUE|REMISE CHEQUE)\b/, 'cheque'],
	[/^PRELEVEMENT\b/, 'prelevement'],
	[/^(CB|CARTE|ACHAT CB)\b/, 'carte']
];
export function guessPaymentMode(
	transaction: Pick<ParsedTransaction, 'label' | 'description' | 'record_type'>,
	modes: PaymentMode[]
): string {
	const normalize = (value: string) =>
		value
			.normalize('NFD')
			.replace(/\p{Diacritic}/gu, '')
			.trim()
			.toUpperCase();
	const id =
		transaction.record_type === 'vente'
			? 'carte'
			: transaction.record_type === 'virement'
				? 'virement'
				: rules.find(([pattern]) =>
						[transaction.label, transaction.description ?? ''].some((text) =>
							pattern.test(normalize(text))
						)
					)?.[1];
	return modes.some((mode) => mode.id === id && !mode.archived) ? id! : '';
}
