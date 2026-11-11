import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { commitAll, ensureGitRepo, git } from './git';
import { withCommitAuthor } from './commit-author';

const roots: string[] = [];
afterEach(async () => {
	vi.unstubAllEnvs();
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

it('records request authors and a fixed app committer, without leaking into later commits', async () => {
	vi.stubEnv('GIT_AUTHOR_NAME', 'Accounting app');
	vi.stubEnv('GIT_AUTHOR_EMAIL', 'app@example.local');
	vi.stubEnv('GIT_COMMITTER_NAME', 'Untrusted inherited committer');
	vi.stubEnv('GIT_COMMITTER_EMAIL', 'inherited@example.local');
	const root = await mkdtemp(path.join(tmpdir(), 'comptes-authors-'));
	roots.push(root);
	await ensureGitRepo(root);
	await writeFile(path.join(root, 'data.json'), '{}');
	const user = { name: 'alice', displayName: 'Alice Read-write', email: 'alice@example.local' };
	expect(await withCommitAuthor(user, () => commitAll(root, 'writer action'))).toBe(true);
	const format = ['log', '-1', '--format=%an <%ae>|%cn <%ce>'];
	expect((await git(root, format)).stdout).toBe(
		'Alice Read-write <alice@example.local>|Accounting app <app@example.local>'
	);
	expect(await withCommitAuthor({ name: 'bob' }, () => commitAll(root, 'no change'))).toBe(false);
	await writeFile(path.join(root, 'data.json'), '{"changed":true}');
	expect(await commitAll(root, 'outside request')).toBe(true);
	expect((await git(root, format)).stdout).toBe(
		'Accounting app <app@example.local>|Accounting app <app@example.local>'
	);
});
