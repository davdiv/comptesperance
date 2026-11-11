import type { TransactionAnnotation } from '#lib/types.ts';
import type { TransactionView } from './queries';

export function annotationFromTransaction(
	transaction: TransactionView,
	overrides: Partial<TransactionAnnotation> = {}
): TransactionAnnotation {
	return {
		notes: transaction.notes || undefined,
		category_id: transaction.category_is_guessed ? undefined : transaction.category_id,
		payment_mode_id: transaction.payment_mode_is_guessed ? undefined : transaction.payment_mode_id,
		allocations: transaction.allocations,
		third_party_id: transaction.third_party_id,
		transfer_id: transaction.transfer_id,
		evidence: transaction.evidence,
		excluded: transaction.excluded,
		...overrides
	};
}

export function editedClassification(transaction: TransactionView, form: FormData) {
	const category = String(form.get('category_id') ?? '').trim();
	const mode = String(form.get('payment_mode_id') ?? '').trim();
	return {
		category_id:
			transaction.category_is_guessed && category === transaction.category_id
				? undefined
				: category,
		payment_mode_id:
			transaction.payment_mode_is_guessed && mode === transaction.payment_mode_id ? undefined : mode
	};
}
