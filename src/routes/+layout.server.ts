import { readConfig } from '$lib/server/config';
import { ensureDataRepo } from '$lib/server/repository';
import type { LayoutServerLoad } from './$types';
import { getEnv } from '$lib/server/env';
import { authRedirectUrl } from '$lib/server/auth';

export const load: LayoutServerLoad = async ({ locals, url }) => ({
	user: locals.user,
	logoutUrl: getEnv().authDisabled ? null : authRedirectUrl(getEnv().authLogoutUrl, url.origin),
	config: await readConfig(await ensureDataRepo())
});
