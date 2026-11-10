export function formatMoney(cents: number, currency = 'EUR'): string {
	return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);
}

export function formatDate(value: string | null | undefined): string {
	if (!value) return '—';
	const date = new Date(`${value}T00:00:00`);
	if (Number.isNaN(date.getTime())) return value;
	return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}
