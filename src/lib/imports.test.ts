import { expect, it } from 'vitest';
import * as lib from '#lib';
import { parseDecimalToCents } from '#lib/server/money.ts';

it('resolves the bare and wildcard package subpath imports', () => {
	expect(lib).toBeDefined();
	expect(parseDecimalToCents('12.34')).toBe(1234);
});
