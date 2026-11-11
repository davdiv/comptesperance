import { readConfig } from '$lib/server/config';
import { ensureDataRepo } from '$lib/server/repository';
import type { LayoutServerLoad } from './$types';
import { getEnv } from '$lib/server/env';
import { authRedirectUrl } from '$lib/server/auth';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const env = getEnv();
	return {
		user: locals.user,
		logoutUrl:
			env.authDisabled || !env.authLogoutUrl
				? null
				: authRedirectUrl(env.authLogoutUrl, url.origin),
		config: await readConfig(await ensureDataRepo())
	};
};
