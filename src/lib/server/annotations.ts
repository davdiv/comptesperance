import type { TransactionAnnotation } from '#lib/types.ts';
import type { TransactionView } from './queries';

export function annotationFromTransaction(
	transaction: TransactionView,
	overrides: Partial<TransactionAnnotation> = {}
): TransactionAnnotation {
	void transaction;
	return overrides;
}

export function editedClassification(transaction: TransactionView, form: FormData) {
	const category = String(form.get('category_id') ?? '').trim();
	const mode = String(form.get('payment_mode_id') ?? '').trim();
	return {
		category_id:
			transaction.sources.category_id.source !== 'explicit' && category === transaction.category_id
				? undefined
				: category,
		payment_mode_id:
			transaction.sources.payment_mode_id.source !== 'explicit' &&
			mode === transaction.payment_mode_id
				? undefined
				: mode
	};
}
