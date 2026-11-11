import { isHttpError, type Actions } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import { requireWrite } from './auth';

const routes = import.meta.glob<{ actions?: Actions }>('/src/routes/**/+page.server.ts', {
	eager: true
});

describe('write authorization', () => {
	it('denies unauthenticated users with 401', () => {
		try {
			requireWrite(null);
		} catch (error) {
			expect(isHttpError(error, 401)).toBe(true);
			return;
		}
		expect.fail('Expected denial');
	});
	it('allows writers', () => {
		expect(() =>
			requireWrite({ name: 'writer', groups: [], canWrite: true, canEdit: true, editMode: true })
		).not.toThrow();
	});
	for (const [path, route] of Object.entries(routes)) {
		for (const [name, action] of Object.entries(route.actions ?? {})) {
			it(`${path} ${name} denies read-only users with 403 before doing work`, async () => {
				try {
					await action({
						locals: { user: { name: 'reader', groups: [], canWrite: false } }
					} as never);
				} catch (error) {
					expect(isHttpError(error, 403)).toBe(true);
					return;
				}
				expect.fail('Expected denial');
			});
		}
	}
});
