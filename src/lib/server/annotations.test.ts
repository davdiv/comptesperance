import { expect, it } from 'vitest';
import { annotationFromTransaction, editedClassification } from './annotations';
import type { TransactionView } from './queries';
const transaction = {
	category_id: 'frais-bancaires',
	payment_mode_id: 'carte',
	category_is_guessed: true,
	payment_mode_is_guessed: true,
	notes: '',
	allocations: [],
	evidence: ['doc.pdf'],
	excluded: false
} as unknown as TransactionView;
it('does not copy effective classifications into non-edit annotation rewrites', () => {
	expect(annotationFromTransaction(transaction, { evidence: [] })).toMatchObject({
		category_id: undefined,
		payment_mode_id: undefined,
		evidence: []
	});
	expect(
		annotationFromTransaction({
			...transaction,
			category_is_guessed: false,
			payment_mode_is_guessed: false,
			category_id: '',
			payment_mode_id: ''
		})
	).toMatchObject({ category_id: '', payment_mode_id: '' });
});
it('keeps unchanged defaults dynamic but persists changed, cleared or existing explicit classifications', () => {
	for (const [category, mode, expected] of [
		['frais-bancaires', 'carte', { category_id: undefined, payment_mode_id: undefined }],
		['achats', 'cheque', { category_id: 'achats', payment_mode_id: 'cheque' }],
		['', '', { category_id: '', payment_mode_id: '' }]
	] as const) {
		const form = new FormData();
		form.set('category_id', category);
		form.set('payment_mode_id', mode);
		expect(editedClassification(transaction, form)).toEqual(expected);
	}
	const form = new FormData();
	form.set('category_id', 'frais-bancaires');
	form.set('payment_mode_id', 'carte');
	expect(
		editedClassification(
			{ ...transaction, category_is_guessed: false, payment_mode_is_guessed: false },
			form
		)
	).toEqual({ category_id: 'frais-bancaires', payment_mode_id: 'carte' });
});
