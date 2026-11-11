import path from 'node:path';

export interface AppEnv {
	dataRepoPath: string;
	cacheDbPath: string;
	authDisabled: boolean;
	authLoginUrl: string;
	authLogoutUrl: string;
	readwriteGroup: string;
	readonlyGroup: string;
	gitAuthorName: string;
	gitAuthorEmail: string;
	maxEvidenceBytes: number;
}

export function getEnv(): AppEnv {
	const dataRepoPath = process.env.DATA_REPO_PATH?.trim() || './data';
	const cacheDbPath = process.env.CACHE_DB_PATH?.trim() || './.data/comptes.sqlite';
	return {
		dataRepoPath: path.resolve(process.cwd(), dataRepoPath),
		cacheDbPath: path.resolve(process.cwd(), cacheDbPath),
		authDisabled: process.env.AUTH_DISABLED === 'true',
		authLoginUrl: process.env.AUTH_LOGIN_URL?.trim() || 'https://auth.comptes.localhost:8443/',
		authLogoutUrl:
			process.env.AUTH_LOGOUT_URL?.trim() || 'https://auth.comptes.localhost:8443/logout',
		readwriteGroup: process.env.AUTH_READWRITE_GROUP?.trim() || 'comptes-readwrite',
		readonlyGroup: process.env.AUTH_READONLY_GROUP?.trim() || 'comptes-readonly',
		gitAuthorName: process.env.GIT_AUTHOR_NAME?.trim() || 'comptes app',
		gitAuthorEmail: process.env.GIT_AUTHOR_EMAIL?.trim() || 'comptes@app.local',
		maxEvidenceBytes: Number(process.env.MAX_EVIDENCE_BYTES ?? 25 * 1024 * 1024)
	};
}
