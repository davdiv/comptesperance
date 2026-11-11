import { expect, it } from 'vitest';
import { documentDisplayName } from './documents';

it('strips storage prefixes from names and paths', () => {
	const name = '1794356306306-6e0fee78-3c84-461d-991d-bfb9214f8e12-multi-evidence-one.pdf';
	expect(documentDisplayName(name)).toBe('multi-evidence-one.pdf');
	expect(documentDisplayName(`documents/${name}`)).toBe('multi-evidence-one.pdf');
	expect(documentDisplayName(`documents\\${name}`)).toBe('multi-evidence-one.pdf');
});

it('preserves ordinary and malformed filenames', () => {
	expect(documentDisplayName('documents/receipt.pdf')).toBe('receipt.pdf');
	expect(documentDisplayName('1794356306306-not-a-uuid-receipt.pdf')).toBe(
		'1794356306306-not-a-uuid-receipt.pdf'
	);
	expect(documentDisplayName('')).toBe('');
});
