import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { promisify } from 'node:util';
import { getEnv } from './env';
import { getCommitAuthor, identityForUser } from './commit-author';

const execFileAsync = promisify(execFile);

export interface GitResult {
	stdout: string;
	stderr: string;
}

export async function git(
	root: string,
	args: string[],
	envOverrides: NodeJS.ProcessEnv = {}
): Promise<GitResult> {
	try {
		const result = await execFileAsync('git', ['-C', root, ...args], {
			env: { ...process.env, ...envOverrides, GIT_TERMINAL_PROMPT: '0' },
			maxBuffer: 10 * 1024 * 1024
		});
		return { stdout: result.stdout.trim(), stderr: result.stderr.trim() };
	} catch (error) {
		const err = error as { stderr?: string; message?: string };
		throw new Error(err.stderr?.trim() || err.message || `git ${args.join(' ')} failed`, {
			cause: error
		});
	}
}

export async function ensureGitRepo(root: string): Promise<void> {
	await mkdir(root, { recursive: true });
	if (existsSync(`${root}/.git`)) return;
	await execFileAsync('git', ['init', '-b', 'main', root], {
		env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
	});
}

export async function commitAll(root: string, message: string): Promise<boolean> {
	const status = await git(root, ['status', '--porcelain']);
	if (!status.stdout) return false;
	await git(root, ['add', '-A']);
	const env = getEnv();
	const committer = identityForUser({ name: env.gitAuthorName, email: env.gitAuthorEmail });
	const author = getCommitAuthor() ?? committer;
	await git(root, ['commit', '-m', message], {
		GIT_AUTHOR_NAME: author.name,
		GIT_AUTHOR_EMAIL: author.email,
		GIT_COMMITTER_NAME: committer.name,
		GIT_COMMITTER_EMAIL: committer.email
	});
	return true;
}

export async function currentHead(root: string): Promise<string | null> {
	try {
		const result = await git(root, ['rev-parse', 'HEAD']);
		return result.stdout || null;
	} catch {
		return null;
	}
}

export async function statusFingerprint(root: string): Promise<string> {
	const head = await currentHead(root);
	const [status, diff] = await Promise.all([
		git(root, ['status', '--porcelain']),
		head ? git(root, ['diff', '--binary', 'HEAD']) : git(root, ['diff', '--binary'])
	]);
	return `${head ?? 'unborn'}\n${status.stdout}\n${diff.stdout}`;
}
