import type { RequestEvent } from '@sveltejs/kit';
import { getEnv } from './env';

export interface SessionUser {
	name: string;
	groups: string[];
	canWrite: boolean;
}

export function getSessionUser(event: RequestEvent): SessionUser | null {
	const env = getEnv();
	if (env.authDisabled) {
		return { name: 'dev', groups: [env.readwriteGroup], canWrite: true };
	}
	const remoteUser = event.request.headers.get('remote-user')?.trim();
	if (!remoteUser) return null;
	const groupsHeader = event.request.headers.get('remote-groups') ?? '';
	const groups = groupsHeader
		.split(',')
		.map((group) => group.trim())
		.filter(Boolean);
	if (!groups.includes(env.readwriteGroup) && !groups.includes(env.readonlyGroup)) return null;
	const canWrite = groups.includes(env.readwriteGroup);
	return {
		name: remoteUser,
		groups,
		canWrite
	};
}

export function requireWrite(user: SessionUser | null): asserts user is SessionUser {
	if (!user) throw new Error('Unauthorized');
	if (!user.canWrite) throw new Error('Forbidden');
}
