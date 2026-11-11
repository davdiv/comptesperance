import { error, redirect } from '@sveltejs/kit';
import { EDIT_MODE_COOKIE } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals, cookies, url }) => {
	if (!locals.user) error(401, 'Unauthorized');
	if (!locals.user.canEdit) error(403, 'Forbidden');
	const form = await request.formData();
	const mode = String(form.get('mode') ?? '');
	if (mode !== 'on' && mode !== 'off') error(400, 'Invalid edit mode');
	if (mode === 'on')
		cookies.set(EDIT_MODE_COOKIE, '1', {
			path: '/',
			httpOnly: true,
			sameSite: 'strict',
			secure: url.protocol === 'https:'
		});
	else cookies.delete(EDIT_MODE_COOKIE, { path: '/' });
	let destination = '/';
	try {
		const target = new URL(String(form.get('return_to') ?? '/'), url.origin);
		if (target.origin === url.origin) destination = target.pathname + target.search;
	} catch {
		destination = '/';
	}
	redirect(303, destination);
};
