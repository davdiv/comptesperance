import { expect, it } from 'vitest';
import { getCommitAuthor, identityForUser, withCommitAuthor } from './commit-author';

it('uses display name and email, falling back to the username and reserved invalid domain', () => {
	expect(
		identityForUser({ name: 'alice', displayName: ' Alice Smith ', email: ' alice@example.local ' })
	).toEqual({ name: 'Alice Smith', email: 'alice@example.local' });
	expect(identityForUser({ name: 'alice' })).toEqual({
		name: 'alice',
		email: 'alice@users.invalid'
	});
	expect(identityForUser({ name: '', displayName: ' <>\n ' })).toEqual({
		name: 'user',
		email: 'user@users.invalid'
	});
});

it.each([
	'evil\nOther <other@example.com>',
	'bad@example.com\r\nInjected',
	'<alice@example.com>',
	'not-an-email',
	'a'.repeat(255) + '@example.com'
])('rejects invalid email identities: %s', (email) => {
	expect(identityForUser({ name: 'alice', displayName: 'Alice\n<Admin>\u0000', email })).toEqual({
		name: 'Alice Admin',
		email: 'alice@users.invalid'
	});
});

it('sanitizes fallback emails as well as names', () => {
	expect(identityForUser({ name: 'a<b>\nc' })).toEqual({
		name: 'a b c',
		email: 'a-b-c@users.invalid'
	});
});

it('keeps concurrent asynchronous authors separate and clears context after failure', async () => {
	await Promise.all(
		['alice', 'bob'].map((name) =>
			withCommitAuthor({ name }, async () => {
				await Promise.resolve();
				expect(getCommitAuthor()).toEqual({ name, email: `${name}@users.invalid` });
			})
		)
	);
	expect(getCommitAuthor()).toBeUndefined();
	expect(() =>
		withCommitAuthor({ name: 'alice' }, () => {
			throw new Error('failure');
		})
	).toThrow('failure');
	expect(getCommitAuthor()).toBeUndefined();
});
