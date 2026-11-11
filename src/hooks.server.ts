import type { Handle } from '@sveltejs/kit/hooks';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { getTextDirection } from '$lib/paraglide/runtime';
import { getSessionUser } from '$lib/server/auth';

const PUBLIC_PATHS = new Set(['/healthz', '/robots.txt', '/favicon.svg']);

const paraglideHandle: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request: localizedRequest, locale }) => {
		return resolve(
			{ ...event, request: localizedRequest },
			{
				transformPageChunk: ({ html }) => {
					return html.replace('%lang%', locale).replace('%dir%', getTextDirection(locale));
				}
			}
		);
	});

export const handle: Handle = ({ event, resolve }) => {
	if (PUBLIC_PATHS.has(event.url.pathname)) {
		return resolve(event);
	}
	const user = getSessionUser(event);
	if (!user) {
		if (event.request.headers.get('remote-user')?.trim())
			return new Response('Forbidden', { status: 403 });
		return new Response('Unauthorized', { status: 401 });
	}
	event.locals.user = user;
	return paraglideHandle({ event, resolve });
};
