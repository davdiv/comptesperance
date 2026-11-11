import { readConfig } from '#lib/server/config.ts';
import { ensureDataRepo } from '#lib/server/repository.ts';
import type { LayoutServerLoad } from './$types';
import { getEnv } from '#lib/server/env.ts';
import { authRedirectUrl } from '#lib/server/auth.ts';

export const load: LayoutServerLoad = async ({ locals, url }) => ({
	user: locals.user,
	logoutUrl: getEnv().authDisabled ? null : authRedirectUrl(getEnv().authLogoutUrl, url.origin),
	config: await readConfig(await ensureDataRepo())
});
