import { afterEach, expect, it, vi } from 'vitest';
import { isHttpError, isRedirect, type RequestEvent } from '@sveltejs/kit';
import { getSessionUser, requireWrite, EDIT_MODE_COOKIE, authRedirectUrl } from './auth';
import { handle } from '../../hooks.server';
import { POST } from '../../routes/edit-mode/+server';
import { getCommitAuthor } from './commit-author';

vi.mock('#lib/paraglide/server.js', () => ({
	paraglideMiddleware: (request: Request, next: (value: unknown) => unknown) =>
		next({ request, locale: 'en' })
}));
afterEach(() => vi.unstubAllEnvs());

it('builds logout links with the app origin as the encoded return destination', () => {
	const url = new URL(
		authRedirectUrl('https://auth.comptes.localhost:8443/logout', 'https://comptes.localhost:8443')
	);
	expect(url.pathname).toBe('/logout');
	expect(url.searchParams.get('rd')).toBe('https://comptes.localhost:8443');
});

function event(headers: Record<string, string> = {}, cookie?: string, method = 'GET') {
	const request = new Request('https://comptes.localhost:8443/accounts/caisse?search=one', {
		method,
		headers
	});
	return {
		request,
		url: new URL(request.url),
		locals: {},
		cookies: { get: vi.fn(() => cookie), set: vi.fn(), delete: vi.fn() }
	} as unknown as RequestEvent;
}
it('defaults writers and development users to read mode; a cookie never grants a reader write rights', () => {
	vi.stubEnv('AUTH_DISABLED', 'false');
	for (const cookie of [undefined, '1']) {
		const writer = getSessionUser(
			event({ 'remote-user': 'alice', 'remote-groups': 'comptes-readwrite' }, cookie)
		)!;
		expect(writer).toMatchObject({
			canEdit: true,
			editMode: cookie === '1',
			canWrite: cookie === '1'
		});
		if (cookie) expect(() => requireWrite(writer)).not.toThrow();
		else expect(() => requireWrite(writer)).toThrow();
		expect(
			getSessionUser(event({ 'remote-user': 'bob', 'remote-groups': 'comptes-readonly' }, cookie))
		).toMatchObject({ canEdit: false, editMode: false, canWrite: false });
	}
	vi.stubEnv('AUTH_DISABLED', 'true');
	expect(getSessionUser(event())).toMatchObject({ name: 'dev', canEdit: true, canWrite: false });
	expect(getSessionUser(event({}, '1'))).toMatchObject({ canWrite: true, editMode: true });
});
it('rejects missing identities with 401 for all methods and users outside allowed groups with 403', async () => {
	vi.stubEnv('AUTH_DISABLED', 'false');
	const resolve = vi.fn(async () => new Response('Page'));
	for (const method of ['GET', 'HEAD', 'POST']) {
		const response = await handle({ event: event({}, undefined, method), resolve } as never);
		expect(response.status).toBe(401);
		expect(response.headers.has('location')).toBe(false);
	}
	expect(
		(
			await handle({
				event: event({ 'remote-user': 'outsider', 'remote-groups': 'other' }),
				resolve
			} as never)
		).status
	).toBe(403);
	expect(resolve).not.toHaveBeenCalled();
});

it('sets effective permissions on authenticated page requests', async () => {
	vi.stubEnv('AUTH_DISABLED', 'false');
	const request = event({ 'remote-user': 'alice', 'remote-groups': 'comptes-readwrite' }, '1');
	const resolve = vi.fn(async () => new Response('Page'));
	expect((await handle({ event: request, resolve } as never)).status).toBe(200);
	expect(request.locals.user).toMatchObject({ canWrite: true, editMode: true });
});

it('scopes sanitized proxy identity to the whole request and fixes the development identity', async () => {
	vi.stubEnv('AUTH_DISABLED', 'false');
	const request = event(
		{
			'remote-user': 'alice',
			'remote-groups': 'comptes-readwrite',
			'remote-name': 'Alice <Read-write>',
			'remote-email': 'alice@example.local'
		},
		'1'
	);
	const resolve = vi.fn(async () => {
		expect(getCommitAuthor()).toEqual({ name: 'Alice Read-write', email: 'alice@example.local' });
		await Promise.resolve();
		expect(getCommitAuthor()?.email).toBe('alice@example.local');
		return new Response('Page');
	});
	expect((await handle({ event: request, resolve } as never)).status).toBe(200);
	expect(request.locals.user).toMatchObject({
		displayName: 'Alice Read-write',
		email: 'alice@example.local'
	});
	expect(getCommitAuthor()).toBeUndefined();
	vi.stubEnv('AUTH_DISABLED', 'true');
	expect(getSessionUser(event())).toMatchObject({
		displayName: 'Development user',
		email: 'dev@users.invalid'
	});
});
it('requires edit mode even when a caller supplies canWrite=true', () => {
	expect(() =>
		requireWrite({ name: 'alice', groups: [], canEdit: true, canWrite: true, editMode: false })
	).toThrow();
});
it('toggles a session cookie and only redirects within the app', async () => {
	for (const [mode, returnTo, destination] of [
		['on', '/accounts/caisse?x=1', '/accounts/caisse?x=1'],
		['off', 'https://example.org/', '/']
	]) {
		const request = event();
		request.locals.user = {
			name: 'alice',
			groups: [],
			canEdit: true,
			canWrite: false,
			editMode: false
		};
		const form = new FormData();
		form.set('mode', mode);
		form.set('return_to', returnTo);
		try {
			await POST({
				...request,
				request: new Request(request.url, { method: 'POST', body: form })
			} as never);
			expect.fail('Expected redirect');
		} catch (result) {
			expect(isRedirect(result)).toBe(true);
			expect(result).toMatchObject({ status: 303, location: destination });
		}
		if (mode === 'on')
			expect(request.cookies.set).toHaveBeenCalledWith(EDIT_MODE_COOKIE, '1', {
				path: '/',
				httpOnly: true,
				sameSite: 'strict',
				secure: true
			});
		else expect(request.cookies.delete).toHaveBeenCalledWith(EDIT_MODE_COOKIE, { path: '/' });
	}
});
it('rejects read-only toggles and invalid mode values without setting cookies', async () => {
	for (const canEdit of [false, true]) {
		const request = event();
		request.locals.user = { name: 'user', groups: [], canEdit, canWrite: false, editMode: false };
		const form = new FormData();
		form.set('mode', 'invalid');
		try {
			await POST({
				...request,
				request: new Request(request.url, { method: 'POST', body: form })
			} as never);
			expect.fail('Expected error');
		} catch (error) {
			expect(isHttpError(error, canEdit ? 400 : 403)).toBe(true);
		}
		expect(request.cookies.set).not.toHaveBeenCalled();
	}
});
