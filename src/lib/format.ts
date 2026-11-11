import { getLocale } from '#lib/paraglide/runtime.js';

function locale(): string {
	return getLocale() === 'fr' ? 'fr-FR' : 'en-GB';
}

export function formatMoney(cents: number): string {
	return new Intl.NumberFormat(locale(), { style: 'currency', currency: 'EUR' }).format(
		cents / 100
	);
}

export function formatDate(value: string | null | undefined): string {
	if (!value) return '—';
	const match = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}(?::\d{2})?))?/.exec(value);
	if (!match) return value;
	const date = new Date(`${match[1]}T${match[2] ?? '00:00:00'}`);
	if (Number.isNaN(date.getTime())) return value;
	return new Intl.DateTimeFormat(locale(), {
		dateStyle: 'medium',
		...(match[2] ? { timeStyle: 'short' } : {})
	}).format(date);
}
