import { error, type RequestEvent } from '@sveltejs/kit';
import { getEnv } from './env';
import { m } from '$lib/paraglide/messages.js';

export const EDIT_MODE_COOKIE = 'comptes_edit_mode';

export function authRedirectUrl(base: string, destination: string): string {
	const url = new URL(base);
	url.searchParams.set('rd', destination);
	return url.href;
}

export interface SessionUser {
	name: string;
	groups: string[];
	canWrite: boolean;
	canEdit: boolean;
	editMode: boolean;
}

export function getSessionUser(event: RequestEvent): SessionUser | null {
	const env = getEnv();
	const editMode = event.cookies.get(EDIT_MODE_COOKIE) === '1';
	if (env.authDisabled) {
		return {
			name: 'dev',
			groups: [env.readwriteGroup],
			canEdit: true,
			editMode,
			canWrite: editMode
		};
	}
	const remoteUser = event.request.headers.get('remote-user')?.trim();
	if (!remoteUser) return null;
	const groupsHeader = event.request.headers.get('remote-groups') ?? '';
	const groups = groupsHeader
		.split(',')
		.map((group) => group.trim())
		.filter(Boolean);
	if (!groups.includes(env.readwriteGroup) && !groups.includes(env.readonlyGroup)) return null;
	const canEdit = groups.includes(env.readwriteGroup);
	return {
		name: remoteUser,
		groups,
		canEdit,
		editMode: canEdit && editMode,
		canWrite: canEdit && editMode
	};
}

export function requireWrite(user: SessionUser | null): asserts user is SessionUser {
	if (!user) error(401, 'Unauthorized');
	if (!user.canEdit) error(403, 'Forbidden');
	if (!user.editMode || !user.canWrite) error(403, m.auth_enable_edit_mode());
}
