import { AsyncLocalStorage } from 'node:async_hooks';

export interface GitIdentity {
	name: string;
	email: string;
}

interface UserIdentity {
	name: string;
	displayName?: string;
	email?: string;
}

const authors = new AsyncLocalStorage<GitIdentity>();

export function identityForUser(user: UserIdentity): GitIdentity {
	const cleanName = (value: string) =>
		value
			.replace(/[\p{Cc}<>]/gu, ' ')
			.replace(/\s+/g, ' ')
			.trim();
	const username = cleanName(user.name) || 'user';
	const name = cleanName(user.displayName ?? '') || username;
	const localPart = username.replace(/[^a-zA-Z0-9._+-]/g, '-').slice(0, 64) || 'user';
	const email = user.email?.trim() ?? '';
	return {
		name,
		email:
			email.length <= 254 && /^[^\s<>@\p{Cc}]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/u.test(email)
				? email
				: `${localPart}@users.invalid`
	};
}

export function withCommitAuthor<T>(user: UserIdentity, work: () => T): T {
	return authors.run(identityForUser(user), work);
}

export function getCommitAuthor(): GitIdentity | undefined {
	return authors.getStore();
}
