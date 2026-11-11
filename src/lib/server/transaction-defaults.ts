import type { Category, ParsedTransaction } from '#lib/types.ts';

export function defaultCategory(
	transaction: Pick<ParsedTransaction, 'record_type'>,
	categories: Category[]
): string {
	if (transaction.record_type !== 'fee') return '';
	return (
		categories.find(
			(category) =>
				category.kind === 'expense' &&
				!category.archived &&
				/frais bancaires|bank fees|frais-bancaires/i.test(category.name + ' ' + category.id)
		)?.id ?? ''
	);
}
