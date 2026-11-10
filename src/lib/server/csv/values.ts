import { decode } from 'he';

export function text(value: unknown): string {
	if (value === null || value === undefined) return '';
	return String(value).trim();
}

export function decodeHtmlEntities(value: string, maxPasses = 5): string {
	let current = value;
	for (let index = 0; index < maxPasses; index += 1) {
		const next = decode(current);
		if (next === current) break;
		current = next;
	}
	return current;
}

export function parseFrenchDate(value: string): string | null {
	const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
	if (!match) return null;
	const [, day, month, year] = match;
	const iso = `${year}-${month}-${day}`;
	return isValidDateOnly(iso) ? iso : null;
}

export function parseIsoDate(value: string): string | null {
	const trimmed = value.trim();
	const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
	if (dateOnly) {
		const iso = `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}`;
		return isValidDateOnly(iso) ? iso : null;
	}
	const dateTime = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
	if (!dateTime) return null;
	const [, year, month, day, hour, minute, second = '00'] = dateTime;
	const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
	return isValidDateTime(iso) ? iso : null;
}

export function parseAmountToCents(value: string, decimalSeparator: ',' | '.'): number | null {
	let normalized = value.trim().replace(/[\s\u00A0\u202F]/g, '');
	if (!normalized) return null;
	let negative = false;
	if (normalized.startsWith('-')) {
		negative = true;
		normalized = normalized.slice(1);
	} else if (normalized.startsWith('+')) {
		normalized = normalized.slice(1);
	}
	if (decimalSeparator === ',') {
		normalized = normalized.replace(/\./g, '').replace(',', '.');
	} else {
		normalized = normalized.replace(/,/g, '');
	}
	if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
	const cents = Math.round(Number.parseFloat(normalized) * 100);
	if (!Number.isFinite(cents)) return null;
	return negative ? -cents : cents;
}

function isValidDateOnly(value: string): boolean {
	const [year, month, day] = value.split('-').map(Number);
	const date = new Date(Date.UTC(year, month - 1, day));
	return (
		date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
	);
}

function isValidDateTime(value: string): boolean {
	const [datePart, timePart] = value.split('T');
	if (!isValidDateOnly(datePart)) return false;
	const [hour, minute, second] = timePart.split(':').map(Number);
	return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 && second >= 0 && second <= 59;
}
