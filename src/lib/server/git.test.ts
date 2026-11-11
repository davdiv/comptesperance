import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { commitAll, ensureGitRepo, git, statusFingerprint } from './git';
import { withCommitAuthor } from './commit-author';

const roots: string[] = [];
it('invalidates the cache fingerprint when import rule content or order changes', async () => {
	const root = await mkdtemp(path.join(tmpdir(), 'comptes-rules-fingerprint-'));
	roots.push(root);
	await ensureGitRepo(root);
	await mkdir(path.join(root, 'config'));
	const file = path.join(root, 'config/rules.json');
	await writeFile(file, '[]');
	await commitAll(root, 'initialize rules');
	const initial = await statusFingerprint(root);
	await writeFile(file, '[{"id":"a"},{"id":"b"}]');
	const edited = await statusFingerprint(root);
	expect(edited).not.toBe(initial);
	await writeFile(file, '[{"id":"b"},{"id":"a"}]');
	expect(await statusFingerprint(root)).not.toBe(edited);
});
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

it('shares initialization across concurrent first requests to a fresh repository', async () => {
	const root = await mkdtemp(path.join(tmpdir(), 'comptes-git-init-'));
	roots.push(root);
	const initializations = Array.from({ length: 20 }, () => ensureGitRepo(root));
	expect(new Set(initializations).size).toBe(1);
	await Promise.all(initializations);
	expect((await git(root, ['symbolic-ref', 'HEAD'])).stdout).toBe('refs/heads/main');
	await ensureGitRepo(root);
	expect((await git(root, ['status', '--porcelain'])).stdout).toBe('');
});

it('allows initialization to be retried after failure', async () => {
	const root = await mkdtemp(path.join(tmpdir(), 'comptes-git-retry-'));
	roots.push(root);
	const target = path.join(root, 'repo');
	await writeFile(target, 'not a directory');
	await expect(ensureGitRepo(target)).rejects.toThrow();
	await rm(target);
	await ensureGitRepo(target);
	expect((await git(target, ['symbolic-ref', 'HEAD'])).stdout).toBe('refs/heads/main');
});
