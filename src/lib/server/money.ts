export function parseDecimalToCents(value: string | null | undefined): number | null {
	if (!value?.trim()) return null;
	const normalized = value.trim().replace(/\s/g, '').replace(',', '.');
	if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) return null;
	const sign = normalized.startsWith('-') ? -1 : 1;
	const [whole, fraction = ''] = normalized.replace(/^-/, '').split('.');
	const cents = sign * (Number(whole) * 100 + Number(fraction.padEnd(2, '0')));
	return Number.isFinite(cents) ? Math.round(cents) : null;
}
