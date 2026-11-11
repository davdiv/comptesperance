import { readConfig } from '$lib/server/config';
import { ensureDataRepo } from '$lib/server/repository';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => ({
	user: locals.user,
	config: await readConfig(await ensureDataRepo())
});
